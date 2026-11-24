import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Bot, Context, GrammyError } from 'grammy';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { LoggerService } from '../common/logger.service';
import { TelegramService } from '../telegram/telegram.service';
import { BotAdminService } from '../telegram/bot-admin.service';
import {
  parseClickStartPayload,
  didUserBlockBot,
  didUserUnblockBot,
  classifyBotStartError,
  isRecoverableBotError,
  BOT_START_RETRY_DELAYS_SEC,
} from '@cleartg/shared';
import { BotStartEventStatus } from '@cleartg/database';

/**
 * Один грамYy Bot на кожне підключення клієнтського бота (блок 1.2 ТЗ) — окремо
 * від TelegramService (той адмінить канали). Дані з різних клієнтських ботів
 * ізольовані одне від одного через botConnectionId.
 */
@Injectable()
export class ClientBotRuntimeService implements OnModuleInit, OnModuleDestroy {
  private bots = new Map<string, Bot>();
  /** Заплановані повторні спроби старту — скасовуються при зупинці. */
  private retries = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private logger: LoggerService,
    private telegram: TelegramService,
    private botAdmin: BotAdminService,
  ) {}

  async onModuleInit() {
    // Весь метод обгорнутий у try/catch навмисно: якщо БД ще не має потрібних
    // колонок/таблиць (наприклад, забули prisma db push перед рестартом) або
    // тимчасово недоступна — ця фіча просто не піднімається, а НЕ валить весь
    // застосунок при старті. Саме так впав прод: findMany() був поза catch.
    try {
      // Крім активних, піднімаємо й ботів, яких раніше вимкнула тимчасова помилка
      // 409 (перекриття процесів під час деплою), — вони не потребують дій клієнта.
      const candidates = await this.prisma.telegramBotConnection.findMany({
        where: { OR: [{ isActive: true }, { isActive: false, lastError: { contains: '409' } }] },
      });
      const connections = candidates.filter((c) => c.isActive || isRecoverableBotError(c.lastError));
      for (const connection of connections) {
        try {
          const token = this.crypto.decrypt(connection.tokenEnc);
          await this.startBot(connection.id, token);
        } catch (err) {
          this.logger.error(
            `Не вдалося запустити клієнтський бот ${connection.id}: ${err instanceof Error ? err.message : err}`,
            'ClientBot',
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Не вдалося завантажити список клієнтських ботів (можлива причина: схема БД не оновлена — prisma db push): ${
          err instanceof Error ? err.message : err
        }`,
        'ClientBot',
      );
    }
  }

  async onModuleDestroy() {
    for (const timer of this.retries.values()) clearTimeout(timer);
    this.retries.clear();
    for (const bot of this.bots.values()) {
      try {
        await bot.stop();
      } catch {
        /* ignore */
      }
    }
  }

  async startBot(connectionId: string, token: string, attempt = 0) {
    if (this.bots.has(connectionId)) return;
    this.clearRetry(connectionId);

    const bot = new Bot(token);

    bot.catch((err) => {
      this.logger.error(
        `Клієнтський бот ${connectionId} — помилка обробки update ${err.ctx.update.update_id}: ${
          err.error instanceof Error ? err.error.message : String(err.error)
        }`,
        'ClientBot',
      );
    });

    bot.command('start', async (ctx) => {
      await this.handleStart(connectionId, ctx);
    });

    bot.on('my_chat_member', async (ctx) => {
      await this.handleMyChatMember(connectionId, ctx);
    });

    this.bots.set(connectionId, bot);

    bot
      .start({
        allowed_updates: ['message', 'my_chat_member'],
        onStart: () => {
          this.logger.log(`Клієнтський бот ${connectionId} запущено`, 'ClientBot');
          // Відновлення після тимчасової помилки — знімаємо позначку «відключено».
          void this.prisma.telegramBotConnection
            .updateMany({
              where: { id: connectionId, OR: [{ isActive: false }, { lastError: { not: null } }] },
              data: { isActive: true, lastError: null, lastErrorAt: null },
            })
            .catch(() => null);
        },
      })
      .catch((err) => this.handleStartFailure(connectionId, token, attempt, err));
  }

  /**
   * Раніше будь-яка помилка старту назавжди вимикала бота в спільній БД. Під час
   * деплою старий процес ще опитує Telegram, новий отримує 409 — і бот лишався
   * «відключеним» після кожного деплою. Тепер вимикаємо лише тоді, коли без
   * клієнта не обійтися (відкликаний токен, чужий webhook), решту повторюємо.
   */
  private async handleStartFailure(connectionId: string, token: string, attempt: number, err: unknown) {
    this.bots.delete(connectionId);
    const message = err instanceof Error ? err.message : String(err);
    const failure = classifyBotStartError(
      err instanceof GrammyError ? { code: err.error_code, description: err.description } : {},
    );
    const delay = BOT_START_RETRY_DELAYS_SEC[attempt];

    if (failure === 'retry' && delay !== undefined) {
      this.logger.warn(
        `Клієнтський бот ${connectionId} не стартував (${message}). Повтор через ${delay} с (спроба ${attempt + 1}/${BOT_START_RETRY_DELAYS_SEC.length}).`,
        'ClientBot',
      );
      this.retries.set(
        connectionId,
        setTimeout(() => {
          this.retries.delete(connectionId);
          void this.startBot(connectionId, token, attempt + 1);
        }, delay * 1000),
      );
      return;
    }

    this.logger.error(`Клієнтський бот ${connectionId} не зміг стартувати: ${message}`, 'ClientBot');
    try {
      const updated = await this.prisma.telegramBotConnection.update({
        where: { id: connectionId },
        data: { isActive: false, lastError: message, lastErrorAt: new Date() },
      });
      await this.notifyDisconnected(updated.workspaceId, updated.botUsername);
    } catch (dbErr) {
      this.logger.error(
        `Не вдалося позначити клієнтського бота ${connectionId} відключеним: ${dbErr instanceof Error ? dbErr.message : dbErr}`,
        'ClientBot',
      );
    }
  }

  private clearRetry(connectionId: string) {
    const timer = this.retries.get(connectionId);
    if (timer) clearTimeout(timer);
    this.retries.delete(connectionId);
  }

  async stopBot(connectionId: string) {
    this.clearRetry(connectionId);
    const bot = this.bots.get(connectionId);
    if (!bot) return;
    try {
      await bot.stop();
    } catch {
      /* ignore */
    }
    this.bots.delete(connectionId);
  }

  /**
   * Поллінг клієнтського бота обірвався фатально (найчастіше 401 — токен
   * відкликано через @BotFather). DB вже помічена isActive:false в місці
   * виклику; тут лише активно попереджаємо власника, а не чекаємо, поки
   * він сам зайде на сторінку «Свій бот» і побачить червоний бейдж.
   */
  private async notifyDisconnected(workspaceId: string, botUsername: string) {
    const mainBot = this.telegram.getBot();
    if (!mainBot) return;
    try {
      await this.botAdmin.notifyClientBotDisconnected(workspaceId, botUsername, mainBot);
    } catch (err) {
      this.logger.error(
        `Не вдалося сповістити про відключення клієнтського бота @${botUsername}: ${
          err instanceof Error ? err.message : err
        }`,
        'ClientBot',
      );
    }
  }

  private async handleStart(connectionId: string, ctx: Context) {
    const telegramUserId = String(ctx.from?.id ?? '');
    if (!telegramUserId) return;

    const connection = await this.prisma.telegramBotConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) return;

    const payload = String(ctx.match ?? '');
    const clickId = parseClickStartPayload(payload);

    let validClickEventId: string | null = null;
    if (clickId) {
      const click = await this.prisma.clickEvent.findFirst({
        where: { id: clickId, workspaceId: connection.workspaceId },
      });
      if (click) validClickEventId = click.id;
    }

    const existing = await this.prisma.botStartEvent.findUnique({
      where: {
        botConnectionId_telegramUserId: { botConnectionId: connectionId, telegramUserId },
      },
    });

    if (existing) {
      // Повторний /start того самого користувача — не створюємо другий перехід,
      // не перезаписуємо clickEventId (перше джерело атрибуції лишається чинним).
      await this.prisma.botStartEvent.update({
        where: { id: existing.id },
        data: { status: BotStartEventStatus.ACTIVE },
      });
    } else {
      await this.prisma.botStartEvent.create({
        data: {
          workspaceId: connection.workspaceId,
          botConnectionId: connectionId,
          clickEventId: validClickEventId,
          telegramUserId,
          telegramUsername: ctx.from?.username,
          status: BotStartEventStatus.ACTIVE,
        },
      });
    }

    await ctx.reply('Дякуємо! Заявку прийнято, з вами зв\'яжуться найближчим часом.');
  }

  private async handleMyChatMember(connectionId: string, ctx: Context) {
    const myChatMember = ctx.myChatMember;
    if (!myChatMember || myChatMember.chat.type !== 'private') return;

    const oldStatus = myChatMember.old_chat_member.status;
    const newStatus = myChatMember.new_chat_member.status;
    const telegramUserId = String(myChatMember.chat.id);

    if (didUserBlockBot({ oldStatus, newStatus })) {
      await this.prisma.botStartEvent.updateMany({
        where: { botConnectionId: connectionId, telegramUserId },
        data: { status: BotStartEventStatus.BLOCKED },
      });
    } else if (didUserUnblockBot({ oldStatus, newStatus })) {
      await this.prisma.botStartEvent.updateMany({
        where: { botConnectionId: connectionId, telegramUserId },
        data: { status: BotStartEventStatus.ACTIVE },
      });
    }
  }
}
