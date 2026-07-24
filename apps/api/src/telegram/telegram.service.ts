import { Injectable, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../common/logger.service';
import { AttributionService } from '../attribution/attribution.service';
import { ConversionService } from '../conversion/conversion.service';
import { CryptoService } from '../crypto/crypto.service';
import { LeadMagnetService } from '../lead-magnet/lead-magnet.service';
import { InviteLinkService } from './invite-link.service';
import { BotAdminService } from './bot-admin.service';
import { tryPublicAppUrl } from '../common/public-app-url';
import {
  hashExternalId,
  isTrackableChatType,
  didBotBecomeAdmin,
  didBotLoseAdmin,
  isMissingInvitePermission,
} from '@cleartg/shared';
import { Bot, webhookCallback } from 'grammy';
import { MembershipEventType, Prisma } from '@cleartg/database';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Bot | null = null;

  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private config: ConfigService,
    private attribution: AttributionService,
    private conversion: ConversionService,
    private crypto: CryptoService,
    @Inject(forwardRef(() => LeadMagnetService))
    private leadMagnet: LeadMagnetService,
    @Inject(forwardRef(() => InviteLinkService))
    private inviteLinks: InviteLinkService,
    private botAdmin: BotAdminService,
  ) {}

  getBot() {
    return this.bot;
  }

  /** Ініціалізація бота + polling (staging) */
  async onModuleInit() {
    const token =
      process.env.TELEGRAM_BOT_TOKEN?.trim() ||
      this.config.get<string>('TELEGRAM_BOT_TOKEN')?.trim();
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN не задано — бот вимкнено', 'Telegram');
      return;
    }

    this.bot = new Bot(token);

    // Без цього необроблена помилка в будь-якому update (webhook чи polling)
    // валить весь Node-процес (unhandled rejection) — весь API та бот падають
    // через збій обробки ОДНОГО апдейту.
    this.bot.catch((err) => {
      this.logger.error(
        `Помилка обробки Telegram update ${err.ctx.update.update_id}: ${
          err.error instanceof Error ? err.error.message : String(err.error)
        }`,
        'Telegram',
      );
    });

    this.setupHandlers();

    const staging = this.config.get<string>('STAGING_MODE') === 'true';
    const usePolling = this.config.get<string>('TELEGRAM_USE_POLLING') !== 'false';
    if (!staging || !usePolling) return;

    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });
      void this.bot.start({
        allowed_updates: ['message', 'my_chat_member', 'chat_member', 'callback_query'],
        onStart: () => {
          this.logger.log('Telegram polling активний (staging)', 'Telegram');
        },
      });
      this.logger.log(
        'Режим polling: підписки/відписки в каналі фіксуються автоматично',
        'Telegram',
      );
    } catch (err) {
      this.logger.error(
        `Не вдалося запустити polling: ${err instanceof Error ? err.message : err}`,
        'Telegram',
      );
    }
  }

  private setupHandlers() {
    if (!this.bot) return;

    this.bot.command('start', async (ctx) => {
      const payload = String(ctx.match ?? '');
      const userId = String(ctx.from?.id ?? '');

      if (payload.startsWith('lm_')) {
        const slug = payload.replace('lm_', '');
        const result = await this.leadMagnet.handleStart(userId, slug);
        await ctx.reply(result.text);
        if (result.channelLink) {
          await ctx.reply(`Підпишіться на канал: ${result.channelLink}`);
        }
        return;
      }

      if (payload.startsWith('bind_')) {
        const token = payload.replace('bind_', '');
        const result = await this.botAdmin.bindTelegramAccount(
          token,
          userId,
          ctx.from?.username,
        );
        if (!result.ok) {
          await ctx.reply(result.message);
          return;
        }
        await ctx.reply(
          '✅ Telegram привʼязано до кабінету ClearTG!\n\n' +
            'Тепер ви будете отримувати щоденні звіти та зможете дивитись досьє підписників.',
        );
        await this.botAdmin.sendWelcomeMenu(ctx, true);
        return;
      }

      const linked = Boolean(await this.botAdmin.getLinkedUser(userId));
      await this.botAdmin.sendWelcomeMenu(ctx, linked);

      await this.prisma.subscriberProfile.updateMany({
        where: { telegramUserId: userId },
        data: { botStarted: true, botOptedOut: false },
      });
    });

    this.bot.command('menu', async (ctx) => {
      const userId = String(ctx.from?.id ?? '');
      const linked = Boolean(await this.botAdmin.getLinkedUser(userId));
      await this.botAdmin.sendWelcomeMenu(ctx, linked);
    });

    this.bot.command('help', async (ctx) => {
      const userId = String(ctx.from?.id ?? '');
      await ctx.reply(this.botAdmin.helpText(), {
        reply_markup: (await this.botAdmin.getLinkedUser(userId))
          ? this.botAdmin.mainMenuKeyboard()
          : undefined,
      });
    });

    this.bot.command('report', async (ctx) => {
      await this.botAdmin.sendReportToChat(ctx, String(ctx.from?.id ?? ''), 'yesterday');
    });

    this.bot.command('channels', async (ctx) => {
      await this.botAdmin.sendChannelsList(ctx, String(ctx.from?.id ?? ''));
    });

    this.bot.command('subscribers', async (ctx) => {
      await this.botAdmin.sendRecentSubscribers(ctx, String(ctx.from?.id ?? ''));
    });

    this.bot.command('cabinet', async (ctx) => {
      const url = tryPublicAppUrl(this.config);
      if (!url) {
        await ctx.reply(
          'Кабінет: задайте NEXT_PUBLIC_APP_URL на API (https://clear-tg-analytics-ua-web.vercel.app)',
        );
        return;
      }
      await ctx.reply(`🖥 Кабінет ClearTG:\n${url}/dashboard`);
    });

    this.bot.callbackQuery(/^menu:/, async (ctx) => {
      const action = ctx.callbackQuery.data?.replace('menu:', '') ?? '';
      const userId = String(ctx.from?.id ?? '');
      await ctx.answerCallbackQuery();

      if (action === 'report_yesterday') {
        await this.botAdmin.sendReportToChat(ctx, userId, 'yesterday');
      } else if (action === 'report_24h') {
        await this.botAdmin.sendReportToChat(ctx, userId, '24h');
      } else if (action === 'channels') {
        await this.botAdmin.sendChannelsList(ctx, userId);
      } else if (action === 'recent_subs') {
        await this.botAdmin.sendRecentSubscribers(ctx, userId);
      } else if (action === 'cabinet') {
        const url = tryPublicAppUrl(this.config);
        await ctx.reply(
          url
            ? `🖥 Кабінет ClearTG:\n${url}/dashboard`
            : 'Задайте NEXT_PUBLIC_APP_URL на API (URL Vercel кабінету).',
        );
      } else if (action === 'help') {
        await ctx.reply(this.botAdmin.helpText(), {
          reply_markup: this.botAdmin.mainMenuKeyboard(),
        });
      }
    });

    this.bot.command('stop', async (ctx) => {
      const userId = String(ctx.from?.id ?? '');
      await ctx.reply(
        'Ви відписалися від бота. Розсилки приходять лише тим, хто сам запустив бота і не відписався.\n' +
          'Ви можете запросити видалення даних через Політику конфіденційності.',
      );

      await this.prisma.subscriberProfile.updateMany({
        where: { telegramUserId: userId },
        data: { botOptedOut: true },
      });
    });

    this.bot.on('message:text', async (ctx) => {
      const userId = String(ctx.from?.id ?? '');
      const text = ctx.message.text;

      const lm = await this.leadMagnet.handleConsentMessage(userId, text);
      if (lm) {
        await ctx.reply(lm.text);
        return;
      }

      const linked = await this.botAdmin.getLinkedUser(userId);
      if (!linked) return;

      const usernameMatch = text.match(/@([a-zA-Z0-9_]{4,})/);
      if (usernameMatch) {
        const dossier = await this.botAdmin.lookupDossier(userId, usernameMatch[1]);
        if (dossier) {
          await ctx.reply(dossier, { reply_markup: this.botAdmin.mainMenuKeyboard() });
        } else {
          await ctx.reply('Підписника не знайдено у ваших каналах.');
        }
        return;
      }

      const forwardId =
        ctx.message.forward_origin &&
        'sender_user' in ctx.message.forward_origin &&
        ctx.message.forward_origin.sender_user
          ? String(ctx.message.forward_origin.sender_user.id)
          : null;

      if (forwardId) {
        const dossier = await this.botAdmin.lookupDossier(userId, undefined, forwardId);
        if (dossier) {
          await ctx.reply(dossier, { reply_markup: this.botAdmin.mainMenuKeyboard() });
        } else {
          await ctx.reply('Підписника не знайдено.');
        }
      }
    });

    this.bot.on('my_chat_member', async (ctx) => {
      const chat = ctx.myChatMember.chat;
      if (!isTrackableChatType(chat.type)) return;

      const oldStatus = ctx.myChatMember.old_chat_member.status;
      const newMember = ctx.myChatMember.new_chat_member;
      const newStatus = newMember.status;
      const isAdmin = newStatus === 'administrator';
      const telegramChatId = String(chat.id);
      const username = 'username' in chat ? chat.username ?? null : null;
      const title = chat.title ?? 'Channel';
      const fromId = ctx.from?.id ? String(ctx.from.id) : undefined;

      const existing = await this.prisma.channel.findFirst({
        where: { telegramChatId },
      });

      if (!existing && isAdmin) {
        const workspaceId = await this.botAdmin.resolveWorkspaceForChannelRegistration(fromId);
        if (workspaceId) {
          await this.prisma.channel.create({
            data: {
              workspaceId,
              telegramChatId,
              title,
              username,
              botIsAdmin: true,
            },
          });
          this.logger.log(`Auto-registered channel ${telegramChatId}`, 'Telegram');
          if (fromId) {
            await this.botAdmin.notifyChannelConnected(fromId, title, this.bot!);
          }
        }
      }

      await this.prisma.channel.updateMany({
        where: { telegramChatId },
        data: { botIsAdmin: isAdmin, title: chat.title ?? 'Channel', username },
      });

      if (fromId && didBotBecomeAdmin({ oldStatus, newStatus })) {
        const canInviteUsers = 'can_invite_users' in newMember ? newMember.can_invite_users : undefined;
        if (isMissingInvitePermission({ status: newStatus, can_invite_users: canInviteUsers })) {
          await this.botAdmin.notifyMissingInvitePermission(fromId, title, this.bot!);
        }
      }

      if (fromId && didBotLoseAdmin({ oldStatus, newStatus })) {
        await this.botAdmin.notifyChannelDisconnected(fromId, existing?.title ?? title, this.bot!);
      }

      this.logger.log(`Bot status in channel ${chat.id}: ${newStatus}`, 'Telegram');
    });

    this.bot.on('chat_member', async (ctx) => {
      await this.handleChatMemberUpdate(ctx);
    });

    // Перейменування групи/супергрупи — Telegram шле службове повідомлення
    // new_chat_title (на відміну від my_chat_member, це не зміна прав бота).
    // Для каналів такої події не існує — там назва оновлюється лише при
    // наступній зміні прав бота, або вручну кнопкою «Синхронізувати» в кабінеті.
    this.bot.on('message:new_chat_title', async (ctx) => {
      const telegramChatId = String(ctx.chat.id);
      const newTitle = ctx.message.new_chat_title;
      const result = await this.prisma.channel.updateMany({
        where: { telegramChatId },
        data: { title: newTitle },
      });
      if (result.count > 0) {
        this.logger.log(`Channel ${telegramChatId} renamed to "${newTitle}"`, 'Telegram');
      }
    });
  }

  private async handleChatMemberUpdate(ctx: {
    chatMember: {
      chat: { id: number; type: string };
      new_chat_member: {
        status: string;
        user: { id: number; username?: string; first_name: string; last_name?: string };
      };
      old_chat_member: { status: string };
      invite_link?: { invite_link: string } | null;
    };
    update: { update_id: number };
  }) {
    const { chatMember } = ctx;
    if (!isTrackableChatType(chatMember.chat.type)) return;

    const channel = await this.prisma.channel.findFirst({
      where: { telegramChatId: String(chatMember.chat.id) },
    });
    if (!channel) return;

    const newStatus = chatMember.new_chat_member.status;
    const oldStatus = chatMember.old_chat_member.status;
    const user = chatMember.new_chat_member.user;
    const telegramUserId = String(user.id);

    let eventType: MembershipEventType | null = null;

    if (
      (oldStatus === 'left' || oldStatus === 'kicked') &&
      (newStatus === 'member' || newStatus === 'administrator')
    ) {
      eventType = MembershipEventType.SUBSCRIBE;
    } else if (
      (oldStatus === 'member' || oldStatus === 'administrator') &&
      (newStatus === 'left' || newStatus === 'kicked')
    ) {
      eventType = MembershipEventType.UNSUBSCRIBE;
    }

    if (!eventType) return;

    await this.prisma.webhookEventRaw.create({
      data: {
        source: 'telegram',
        eventType: eventType.toLowerCase(),
        payload: chatMember as object,
      },
    });

    if (eventType === MembershipEventType.SUBSCRIBE) {
      const inviteUrl = chatMember.invite_link?.invite_link ?? null;
      await this.processSubscribe(
        channel.workspaceId,
        channel.id,
        telegramUserId,
        user.username,
        user.first_name,
        user.last_name,
        ctx.update.update_id,
        inviteUrl,
      );
      this.logger.log(
        `Підписка: user ${telegramUserId} на канал ${channel.title}`,
        'Telegram',
      );
    } else {
      await this.processUnsubscribe(
        channel.workspaceId,
        channel.id,
        telegramUserId,
        user.username,
        user.first_name,
        user.last_name,
      );
      this.logger.log(
        `Відписка: user ${telegramUserId} з каналу ${channel.title}`,
        'Telegram',
      );
    }
  }

  private async processSubscribe(
    workspaceId: string,
    channelId: string,
    telegramUserId: string,
    username: string | undefined,
    firstName: string | undefined,
    lastName: string | undefined,
    updateId: number,
    telegramInviteUrl?: string | null,
  ) {
    const lastProfile = await this.prisma.subscriberProfile.findFirst({
      where: { workspaceId, channelId, telegramUserId },
      orderBy: { subscribedAt: 'desc' },
      include: { _count: { select: { unsubscribeEvents: true } } },
    });

    // Дублікат того самого chat_member update (Telegram шле кілька підряд) —
    // не створюємо другий профіль, якщо останній ще активний (без відписки).
    // Якщо останній профіль вже має відписку — це повторна підписка (resubscribe):
    // створюємо новий профіль з новою атрибуцією джерела.
    if (lastProfile && lastProfile._count.unsubscribeEvents === 0) return;

    let inviteLinkId: string | null = null;
    if (telegramInviteUrl) {
      const invite = await this.inviteLinks.findByTelegramUrl(telegramInviteUrl);
      inviteLinkId = invite?.id ?? null;
    }

    const membershipEvent = await this.prisma.membershipEvent.create({
      data: {
        workspaceId,
        channelId,
        eventType: MembershipEventType.SUBSCRIBE,
        telegramUserId,
        telegramUsername: username,
        telegramFirstName: firstName,
        telegramLastName: lastName,
        inviteLinkId,
        rawUpdateId: String(updateId),
      },
    });

    const externalIdHash = hashExternalId(telegramUserId, workspaceId, this.crypto.getHashSalt());

    try {
      await this.prisma.subscriberProfile.create({
        data: {
          workspaceId,
          channelId,
          membershipEventId: membershipEvent.id,
          externalIdHash,
          telegramUserId,
          subscribedAt: membershipEvent.occurredAt,
        },
      });
    } catch (err) {
      // Захист від гонки/розсинхрону схеми: якщо стара unique(workspace,channel,user)
      // ще діє на БД (наприклад, міграція ще не прогнана на цьому інстансі) — не валимо
      // весь процес, а тільки логуємо і виходимо без атрибуції для цього апдейту.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.error(
          `subscriberProfile.create P2002 (workspace/channel/user) — можливо, стара БД-схема ще не оновлена (prisma db push): ${telegramUserId}`,
          'Telegram',
        );
        return;
      }
      throw err;
    }

    await this.attribution.attributeMembership(membershipEvent.id, inviteLinkId);
    await this.conversion.createSubscribeEvent(membershipEvent.id);
  }

  private async processUnsubscribe(
    workspaceId: string,
    channelId: string,
    telegramUserId: string,
    username?: string,
    firstName?: string,
    lastName?: string,
  ) {
    // Беремо найновіший профіль (може бути кілька — по одному на цикл підписки).
    const profile = await this.prisma.subscriberProfile.findFirst({
      where: { workspaceId, channelId, telegramUserId },
      orderBy: { subscribedAt: 'desc' },
      include: { _count: { select: { unsubscribeEvents: true } } },
    });

    // Дублікат того самого update (Telegram шле кілька chat_member підряд) —
    // це саме той випадок, коли У ЦЬОГО профілю вже Є прив'язана відписка.
    // ВАЖЛИВО: раніше тут була перевірка "чи була БУДЬ-ЯКА відписка за останні
    // 60 секунд" — без прив'язки до профілю. Якщо людина встигала пройти
    // кілька циклів підписка→відписка швидко (типово під час ручного тесту),
    // друга відписка потрапляла в те саме 60-секундне вікно першої і
    // вважалася дублем, тому НЕ записувалася. А без запису відписки на
    // другому профілі третя підписка бачила "останній профіль ще активний"
    // і теж не створювала запис — три цикли схлопувались в один-два.
    if (profile && profile._count.unsubscribeEvents > 0) {
      return;
    }

    await this.prisma.membershipEvent.create({
      data: {
        workspaceId,
        channelId,
        eventType: MembershipEventType.UNSUBSCRIBE,
        telegramUserId,
        telegramUsername: username,
        telegramFirstName: firstName,
        telegramLastName: lastName,
      },
    });

    await this.prisma.unsubscribeEvent.create({
      data: {
        workspaceId,
        channelId,
        subscriberProfileId: profile?.id ?? null,
        telegramUserId,
        telegramUsername: username,
        telegramFirstName: firstName,
        telegramLastName: lastName,
      },
    });
  }

  async getMemberStatus(chatId: string, telegramUserId: string): Promise<string | null> {
    if (!this.bot) return null;
    try {
      const member = await this.bot.api.getChatMember(chatId, parseInt(telegramUserId, 10));
      return member.status;
    } catch {
      return null;
    }
  }

  getWebhookHandler() {
    if (!this.bot) return null;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    return webhookCallback(this.bot, 'fastify', {
      secretToken: secret || undefined,
    });
  }

  async verifyChannelAdmin(chatId: string, userId: string): Promise<boolean> {
    if (!this.bot) return false;
    try {
      const member = await this.bot.api.getChatMember(chatId, parseInt(userId, 10));
      return member.status === 'administrator' || member.status === 'creator';
    } catch {
      return false;
    }
  }

  async getBotPermissions(chatId: string) {
    if (!this.bot) {
      return {
        isAdmin: false,
        canInviteUsers: false,
        canManageChat: false,
        issues: ['Бот не налаштований (TELEGRAM_BOT_TOKEN)'],
        ready: false,
      };
    }

    try {
      const me = await this.bot.api.getMe();
      const member = await this.bot.api.getChatMember(chatId, me.id);
      const isAdmin =
        member.status === 'administrator' || member.status === 'creator';
      const canInviteUsers =
        isAdmin &&
        member.status === 'administrator' &&
        'can_invite_users' in member &&
        member.can_invite_users === true;
      const canManageChat =
        isAdmin &&
        member.status === 'administrator' &&
        'can_manage_chat' in member &&
        member.can_manage_chat === true;

      const issues: string[] = [];
      if (!isAdmin) issues.push('Додайте бота адміністратором каналу');
      if (isAdmin && !canInviteUsers) {
        issues.push('Увімкніть право «Додавання учасників» для точних invite-лінків');
      }

      return {
        isAdmin,
        canInviteUsers: Boolean(canInviteUsers),
        canManageChat: Boolean(canManageChat),
        issues,
        ready: isAdmin,
      };
    } catch {
      return {
        isAdmin: false,
        canInviteUsers: false,
        canManageChat: false,
        issues: ['Канал не знайдено або бот не має доступу'],
        ready: false,
      };
    }
  }

  /** Workspace тестового користувача (STAGING), не demo */
  private async resolveStagingWorkspace() {
    const stagingEmail = process.env.STAGING_LOGIN_EMAIL?.trim().toLowerCase();
    if (stagingEmail) {
      const user = await this.prisma.user.findUnique({ where: { email: stagingEmail } });
      if (user) {
        const member = await this.prisma.workspaceMember.findFirst({
          where: { userId: user.id },
          include: { workspace: true },
          orderBy: { createdAt: 'asc' },
        });
        if (member) return member.workspace;
      }
    }
    return this.prisma.workspace.findFirst({
      where: { slug: 'main' },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Підтягнути канал, де бот уже адмін (якщо webhook пропустив подію) */
  async syncChannelByIdentifier(workspaceId: string, rawInput: string) {
    if (!this.bot) throw new Error('Telegram bot not configured');
    const input = rawInput.trim();
    if (!input) throw new Error('Channel username or chat id required');

    const chat = /^-?\d+$/.test(input)
      ? await this.bot.api.getChat(input)
      : await this.bot.api.getChat(`@${input.replace(/^@/, '')}`);
    if (chat.type !== 'channel') throw new Error('Not a channel');

    const me = await this.bot.api.getMe();
    const member = await this.bot.api.getChatMember(chat.id, me.id);
    const isAdmin =
      member.status === 'administrator' || member.status === 'creator';
    if (!isAdmin) throw new Error('Bot is not admin in this channel');

    const telegramChatId = String(chat.id);
    const title = 'title' in chat ? (chat.title ?? 'Channel') : 'Channel';
    const chatUsername = 'username' in chat ? (chat.username ?? null) : null;

    return this.prisma.channel.upsert({
      where: {
        workspaceId_telegramChatId: { workspaceId, telegramChatId },
      },
      create: {
        workspaceId,
        telegramChatId,
        title,
        username: chatUsername,
        botIsAdmin: true,
      },
      update: {
        title,
        username: chatUsername,
        botIsAdmin: true,
      },
    });
  }
}
