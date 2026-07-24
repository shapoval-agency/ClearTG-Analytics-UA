import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Bot, Context } from 'grammy';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { LoggerService } from '../common/logger.service';
import { parseClickStartPayload, didUserBlockBot, didUserUnblockBot } from '@cleartg/shared';
import { BotStartEventStatus } from '@cleartg/database';

/**
 * Один грамYy Bot на кожне підключення клієнтського бота (блок 1.2 ТЗ) — окремо
 * від TelegramService (той адмінить канали). Дані з різних клієнтських ботів
 * ізольовані одне від одного через botConnectionId.
 */
@Injectable()
export class ClientBotRuntimeService implements OnModuleInit, OnModuleDestroy {
  private bots = new Map<string, Bot>();

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private logger: LoggerService,
  ) {}

  async onModuleInit() {
    // Весь метод обгорнутий у try/catch навмисно: якщо БД ще не має потрібних
    // колонок/таблиць (наприклад, забули prisma db push перед рестартом) або
    // тимчасово недоступна — ця фіча просто не піднімається, а НЕ валить весь
    // застосунок при старті. Саме так впав прод: findMany() був поза catch.
    try {
      const connections = await this.prisma.telegramBotConnection.findMany({
        where: { isActive: true },
      });
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
    for (const bot of this.bots.values()) {
      try {
        await bot.stop();
      } catch {
        /* ignore */
      }
    }
  }

  async startBot(connectionId: string, token: string) {
    if (this.bots.has(connectionId)) return;

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
        },
      })
      .catch(async (err) => {
        this.bots.delete(connectionId);
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Клієнтський бот ${connectionId} не зміг стартувати: ${message}`, 'ClientBot');
        await this.prisma.telegramBotConnection.update({
          where: { id: connectionId },
          data: { isActive: false, lastError: message, lastErrorAt: new Date() },
        });
      });
  }

  async stopBot(connectionId: string) {
    const bot = this.bots.get(connectionId);
    if (!bot) return;
    try {
      await bot.stop();
    } catch {
      /* ignore */
    }
    this.bots.delete(connectionId);
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
