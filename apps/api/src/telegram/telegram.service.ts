import { Injectable, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../common/logger.service';
import { AttributionService } from '../attribution/attribution.service';
import { ConversionService } from '../conversion/conversion.service';
import { CryptoService } from '../crypto/crypto.service';
import { LeadMagnetService } from '../lead-magnet/lead-magnet.service';
import { InviteLinkService } from './invite-link.service';
import { hashExternalId } from '@cleartg/shared';
import { Bot, webhookCallback } from 'grammy';
import { MembershipEventType } from '@cleartg/database';

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
    this.setupHandlers();

    const staging = this.config.get<string>('STAGING_MODE') === 'true';
    const usePolling = this.config.get<string>('TELEGRAM_USE_POLLING') !== 'false';
    if (!staging || !usePolling) return;

    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });
      void this.bot.start({
        allowed_updates: ['message', 'my_chat_member', 'chat_member'],
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

      if (payload.startsWith('owner_')) {
        await ctx.reply(
          'Вітаємо в ClearTG Analytics UA!\n\n' +
            'Цей бот допомагає відстежувати джерела підписок на ваш Telegram-канал.\n\n' +
            'Щоб підключити канал:\n' +
            '1. Додайте бота адміністратором каналу\n' +
            '2. Надайте права на перегляд учасників\n' +
            '3. Поверніться до панелі керування ClearTG',
        );
        return;
      }

      await ctx.reply(
        'Вітаємо! Ви запустили бота ClearTG Analytics.\n\n' +
          'Ми не надсилаємо повідомлення без вашої згоди.\n' +
          'Щоб відписатися від бота, надішліть /stop',
      );

      await this.prisma.subscriberProfile.updateMany({
        where: { telegramUserId: userId },
        data: { botStarted: true, botOptedOut: false },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'bot_started',
          entityType: 'telegram_user',
          entityId: userId,
          metadata: { username: ctx.from?.username },
        },
      });
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
      const result = await this.leadMagnet.handleConsentMessage(userId, ctx.message.text);
      if (result) {
        await ctx.reply(result.text);
      }
    });

    this.bot.on('my_chat_member', async (ctx) => {
      const chat = ctx.myChatMember.chat;
      if (chat.type !== 'channel') return;

      const newStatus = ctx.myChatMember.new_chat_member.status;
      const isAdmin = newStatus === 'administrator';
      const telegramChatId = String(chat.id);
      const username = 'username' in chat ? chat.username ?? null : null;

      const existing = await this.prisma.channel.findFirst({
        where: { telegramChatId },
      });

      if (!existing && isAdmin && process.env.STAGING_MODE === 'true') {
        const workspace = await this.resolveStagingWorkspace();
        if (workspace) {
          await this.prisma.channel.create({
            data: {
              workspaceId: workspace.id,
              telegramChatId,
              title: chat.title ?? 'Channel',
              username,
              botIsAdmin: true,
            },
          });
          this.logger.log(`Auto-registered channel ${telegramChatId} for workspace ${workspace.id}`, 'Telegram');
        }
      }

      await this.prisma.channel.updateMany({
        where: { telegramChatId },
        data: { botIsAdmin: isAdmin, title: chat.title ?? 'Channel', username },
      });

      this.logger.log(`Bot status in channel ${chat.id}: ${newStatus}`, 'Telegram');
    });

    this.bot.on('chat_member', async (ctx) => {
      await this.handleChatMemberUpdate(ctx);
    });
  }

  private async handleChatMemberUpdate(ctx: {
    chatMember: {
      chat: { id: number; type: string };
      new_chat_member: { status: string; user: { id: number; username?: string } };
      old_chat_member: { status: string };
      invite_link?: { invite_link: string } | null;
    };
    update: { update_id: number };
  }) {
    const { chatMember } = ctx;
    if (chatMember.chat.type !== 'channel') return;

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
        ctx.update.update_id,
        inviteUrl,
      );
      this.logger.log(
        `Підписка: user ${telegramUserId} на канал ${channel.title}`,
        'Telegram',
      );
    } else {
      await this.processUnsubscribe(channel.workspaceId, channel.id, telegramUserId);
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
    updateId: number,
    telegramInviteUrl?: string | null,
  ) {
    const existing = await this.prisma.subscriberProfile.findFirst({
      where: { workspaceId, channelId, telegramUserId },
    });
    if (existing) return;

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
        inviteLinkId,
        rawUpdateId: String(updateId),
      },
    });

    const externalIdHash = hashExternalId(telegramUserId, workspaceId, this.crypto.getHashSalt());

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

    await this.attribution.attributeMembership(membershipEvent.id, inviteLinkId);
    await this.conversion.createSubscribeEvent(membershipEvent.id);
  }

  private async processUnsubscribe(
    workspaceId: string,
    channelId: string,
    telegramUserId: string,
  ) {
    const profile = await this.prisma.subscriberProfile.findFirst({
      where: { workspaceId, channelId, telegramUserId },
    });

    await this.prisma.membershipEvent.create({
      data: {
        workspaceId,
        channelId,
        eventType: MembershipEventType.UNSUBSCRIBE,
        telegramUserId,
      },
    });

    await this.prisma.unsubscribeEvent.create({
      data: {
        workspaceId,
        channelId,
        subscriberProfileId: profile?.id,
        telegramUserId,
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
