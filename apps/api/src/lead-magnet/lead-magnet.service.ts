import { Injectable, BadRequestException, Inject, NotFoundException, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GrammyError } from 'grammy';
import type { InlineKeyboardButton } from 'grammy/types';
import { PrismaService } from '../prisma/prisma.service';
import { ConversionService } from '../conversion/conversion.service';
import { TelegramService } from '../telegram/telegram.service';
import { AuditService } from '../audit/audit.service';
import { generateSlug, isActiveMemberStatus } from '@cleartg/shared';
import {
  NOT_SUBSCRIBED_TEXT,
  aggregateClaimsBySource,
  claimCallbackData,
  claimSourceLabel,
  giftBotLink,
  giftDeliveryText,
  giftIntroText,
} from './lead-magnet-content';

/** Старий сценарій: людина пише слово згоди. Лишаємо, щоб не зламати вже опубліковані інструкції. */
const CONSENT_KEYWORD = 'ПОГОДЖУЮСЬ';
const PENDING_TTL_SEC = 30 * 60;
const INVITE_CACHE_TTL_SEC = 7 * 24 * 60 * 60;

export interface GiftInput {
  channelId: string;
  name: string;
  description?: string | null;
  contentUrl?: string | null;
  contentText?: string | null;
  buttonText?: string | null;
  consentText: string;
}

/** Відповідь бота: текст + (необов'язково) inline-кнопки. */
export interface BotReply {
  text: string;
  keyboard?: InlineKeyboardButton[][];
}

const attributionInclude = {
  membershipEvent: {
    select: {
      attribution: {
        select: {
          attributionType: true,
          trackingLink: { select: { name: true } },
          campaign: { select: { name: true } },
        },
      },
    },
  },
} as const;

type ProfileWithAttribution = {
  membershipEvent: {
    attribution: {
      attributionType: string;
      trackingLink: { name: string | null } | null;
      campaign: { name: string } | null;
    } | null;
  };
};

function sourceOf(profile: ProfileWithAttribution | null): string {
  const a = profile?.membershipEvent.attribution;
  return claimSourceLabel({
    hasProfile: Boolean(profile),
    trackingLinkName: a?.trackingLink?.name,
    campaignName: a?.campaign?.name,
    attributionType: a?.attributionType,
  });
}

@Injectable()
export class LeadMagnetService {
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private conversion: ConversionService,
    @Inject(forwardRef(() => TelegramService))
    private telegram: TelegramService,
    private audit: AuditService,
    config: ConfigService,
  ) {
    this.redis = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
  }

  private botUsername() {
    return process.env.TELEGRAM_BOT_USERNAME ?? 'cleartg_bot';
  }

  async getBotLink(slug: string): Promise<string> {
    return giftBotLink(this.botUsername(), slug);
  }

  private normalize(data: Partial<GiftInput>) {
    const clean = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
    return {
      name: data.name?.trim(),
      description: clean(data.description),
      contentUrl: clean(data.contentUrl),
      contentText: clean(data.contentText),
      buttonText: data.buttonText?.trim() || undefined,
      consentText: data.consentText?.trim(),
    };
  }

  async create(workspaceId: string, data: GiftInput) {
    const channel = await this.prisma.channel.findFirst({ where: { id: data.channelId, workspaceId } });
    if (!channel) throw new BadRequestException('Канал не знайдено в цьому кабінеті');
    const n = this.normalize(data);
    if (!n.contentUrl && !n.contentText) throw new BadRequestException('Додайте посилання або текст матеріалу');

    const item = await this.prisma.leadMagnet.create({
      data: {
        workspaceId,
        channelId: data.channelId,
        slug: generateSlug(10),
        name: n.name!,
        description: n.description ?? null,
        contentUrl: n.contentUrl ?? null,
        contentText: n.contentText ?? null,
        ...(n.buttonText ? { buttonText: n.buttonText } : {}),
        consentText: n.consentText!,
      },
    });
    return { ...item, botLink: await this.getBotLink(item.slug) };
  }

  async update(workspaceId: string, id: string, data: Partial<GiftInput> & { isActive?: boolean }) {
    const existing = await this.prisma.leadMagnet.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundException('Подарунок не знайдено');
    const n = this.normalize(data);
    const contentUrl = n.contentUrl !== undefined ? n.contentUrl : existing.contentUrl;
    const contentText = n.contentText !== undefined ? n.contentText : existing.contentText;
    if (!contentUrl && !contentText) throw new BadRequestException('Додайте посилання або текст матеріалу');

    const item = await this.prisma.leadMagnet.update({
      where: { id },
      data: {
        ...(n.name ? { name: n.name } : {}),
        ...(n.description !== undefined ? { description: n.description } : {}),
        contentUrl,
        contentText,
        ...(n.buttonText ? { buttonText: n.buttonText } : {}),
        ...(n.consentText ? { consentText: n.consentText } : {}),
        ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
      },
    });
    return { ...item, botLink: await this.getBotLink(item.slug) };
  }

  async list(workspaceId: string) {
    const items = await this.prisma.leadMagnet.findMany({
      where: { workspaceId },
      include: {
        channel: { select: { id: true, title: true, username: true } },
        _count: { select: { claims: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const botUsername = this.botUsername();
    return items.map((item) => ({ ...item, botLink: giftBotLink(botUsername, item.slug) }));
  }

  /** S4-04: забираємість — підписники з моменту створення подарунка й отримання по джерелах. */
  async getStats(workspaceId: string, id: string) {
    const gift = await this.prisma.leadMagnet.findFirst({ where: { id, workspaceId } });
    if (!gift) throw new NotFoundException('Подарунок не знайдено');

    const [subscribers, claims] = await Promise.all([
      this.prisma.subscriberProfile.findMany({
        where: { workspaceId, channelId: gift.channelId, subscribedAt: { gte: gift.createdAt } },
        select: attributionInclude,
      }),
      this.prisma.leadMagnetClaim.findMany({
        where: { leadMagnetId: gift.id },
        select: { subscriberProfile: { select: attributionInclude } },
      }),
    ]);

    const bySource = aggregateClaimsBySource(
      subscribers.map((p) => sourceOf(p)),
      claims.map((c) => sourceOf(c.subscriberProfile)),
    );
    return {
      since: gift.createdAt,
      subscribers: subscribers.length,
      claims: claims.length,
      claimRate: subscribers.length > 0 ? Math.min(1, claims.length / subscribers.length) : null,
      bySource,
    };
  }

  /** S4-01: бот публікує в канал пост із кнопкою «Отримати подарунок». */
  async publishToChannel(workspaceId: string, id: string, text: string) {
    const gift = await this.prisma.leadMagnet.findFirst({ where: { id, workspaceId }, include: { channel: true } });
    if (!gift) throw new NotFoundException('Подарунок не знайдено');
    if (!gift.isActive) throw new BadRequestException('Подарунок вимкнено — увімкніть його перед публікацією');
    const body = text.trim();
    if (!body) throw new BadRequestException('Напишіть текст поста');

    try {
      const messageId = await this.telegram.postWithUrlButton(
        gift.channel.telegramChatId,
        body,
        gift.buttonText,
        await this.getBotLink(gift.slug),
      );
      await this.audit.log({ workspaceId, action: 'lead_magnet_published', entityType: 'lead_magnet', entityId: gift.id, metadata: { messageId } });
      const postUrl = gift.channel.username ? `https://t.me/${gift.channel.username}/${messageId}` : null;
      return { messageId, postUrl };
    } catch (err) {
      if (err instanceof GrammyError) {
        const d = err.description.toLowerCase();
        if (d.includes('not enough rights') || d.includes('need administrator rights') || d.includes('chat_write_forbidden')) {
          throw new BadRequestException('Бот не може публікувати в цей канал. Дайте йому право «Публікація повідомлень» в адмінах каналу.');
        }
        throw new BadRequestException(`Telegram відхилив публікацію: ${err.description}`);
      }
      throw err;
    }
  }

  private async channelJoinUrl(gift: { id: string; channel: { username: string | null; telegramChatId: string } }) {
    if (gift.channel.username) return `https://t.me/${gift.channel.username}`;
    const key = `lm_invite:${gift.id}`;
    const cached = await this.redis.get(key);
    if (cached) return cached;
    const link = await this.telegram.createNamedInviteLink(gift.channel.telegramChatId, 'Подарунок');
    if (link) await this.redis.set(key, link, 'EX', INVITE_CACHE_TTL_SEC);
    return link;
  }

  private async claimKeyboard(gift: { id: string; slug: string; channel: { username: string | null; telegramChatId: string } }) {
    const joinUrl = await this.channelJoinUrl(gift);
    const rows: NonNullable<BotReply['keyboard']> = [];
    if (joinUrl) rows.push([{ text: 'Підписатися на канал', url: joinUrl }]);
    rows.push([{ text: '✅ Отримати', callback_data: claimCallbackData(gift.slug) }]);
    return rows;
  }

  /** /start lm_<slug>: показуємо подарунок і кнопки. */
  async handleStart(telegramUserId: string, slug: string): Promise<BotReply> {
    const gift = await this.prisma.leadMagnet.findFirst({ where: { slug, isActive: true }, include: { channel: true } });
    if (!gift) return { text: 'Цей подарунок більше не доступний.' };

    // Для старого сценарію зі словом згоди.
    await this.redis.set(`lm_pending:${telegramUserId}`, JSON.stringify({ slug }), 'EX', PENDING_TTL_SEC);
    await this.prisma.subscriberProfile.updateMany({
      where: { telegramUserId, workspaceId: gift.workspaceId },
      data: { botStarted: true, botOptedOut: false },
    });

    return { text: giftIntroText(gift), keyboard: await this.claimKeyboard(gift) };
  }

  /** Кнопка «Отримати»: перевіряємо підписку й видаємо матеріал. Натискання = згода. */
  async handleClaim(telegramUserId: string, slug: string): Promise<BotReply> {
    const gift = await this.prisma.leadMagnet.findFirst({ where: { slug, isActive: true }, include: { channel: true } });
    if (!gift) return { text: 'Цей подарунок більше не доступний.' };

    const status = await this.telegram.getMemberStatus(gift.channel.telegramChatId, telegramUserId);
    if (!status || !isActiveMemberStatus(status)) {
      return { text: NOT_SUBSCRIBED_TEXT, keyboard: await this.claimKeyboard(gift) };
    }

    // Активний профіль підписки (останній цикл). Його може не бути, якщо людина
    // підписалась до підключення бота, — тоді видаємо подарунок без профілю.
    const profile = await this.prisma.subscriberProfile.findFirst({
      where: { workspaceId: gift.workspaceId, channelId: gift.channelId, telegramUserId },
      orderBy: { subscribedAt: 'desc' },
    });

    const existing = await this.prisma.leadMagnetClaim.findFirst({
      where: {
        leadMagnetId: gift.id,
        OR: [
          { telegramUserId },
          ...(profile ? [{ subscriberProfile: { telegramUserId } }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing) return { text: giftDeliveryText(gift, true) };

    const claim = await this.prisma.leadMagnetClaim.create({
      data: {
        leadMagnetId: gift.id,
        subscriberProfileId: profile?.id ?? null,
        telegramUserId,
        consentRecorded: true,
      },
    });
    await this.prisma.subscriberProfile.updateMany({
      where: { telegramUserId, workspaceId: gift.workspaceId },
      data: { botStarted: true, botOptedOut: false },
    });
    if (profile) await this.conversion.createLeadMagnetEvent(profile.id, gift.id);
    await this.redis.del(`lm_pending:${telegramUserId}`);
    await this.audit.log({
      workspaceId: gift.workspaceId,
      action: 'lead_magnet_claimed',
      entityType: 'lead_magnet',
      entityId: gift.id,
      metadata: { claimId: claim.id, subscriberProfileId: profile?.id ?? null },
    });

    return { text: giftDeliveryText(gift) };
  }

  /** Старий сценарій: людина надіслала слово згоди замість натискання кнопки. */
  async handleConsentMessage(telegramUserId: string, text: string): Promise<BotReply | null> {
    if (text.trim().toUpperCase() !== CONSENT_KEYWORD) return null;
    const pending = await this.redis.get(`lm_pending:${telegramUserId}`);
    if (!pending) return null;
    const { slug } = JSON.parse(pending) as { slug: string };
    return this.handleClaim(telegramUserId, slug);
  }
}
