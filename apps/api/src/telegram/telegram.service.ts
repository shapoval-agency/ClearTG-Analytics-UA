import { Injectable, Inject, forwardRef } from '@nestjs/common';
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
export class TelegramService {
  private bot: Bot | null = null;

  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private attribution: AttributionService,
    private conversion: ConversionService,
    private crypto: CryptoService,
    @Inject(forwardRef(() => LeadMagnetService))
    private leadMagnet: LeadMagnetService,
    @Inject(forwardRef(() => InviteLinkService))
    private inviteLinks: InviteLinkService,
  ) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      this.bot = new Bot(token);
      this.setupHandlers();
    }
  }

  getBot() {
    return this.bot;
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
        const workspace = await this.prisma.workspace.findFirst({
          orderBy: { createdAt: 'asc' },
        });
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
    } else {
      await this.processUnsubscribe(channel.workspaceId, channel.id, telegramUserId);
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
}
