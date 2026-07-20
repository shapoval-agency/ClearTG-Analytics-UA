import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { ConversionService } from '../conversion/conversion.service';
import { TelegramService } from '../telegram/telegram.service';
import { AuditService } from '../audit/audit.service';
import { generateSlug, isActiveMemberStatus } from '@cleartg/shared';

const CONSENT_KEYWORD = 'ПОГОДЖУЮСЬ';
const PENDING_TTL_SEC = 30 * 60;

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

  async create(
    workspaceId: string,
    data: {
      channelId: string;
      name: string;
      description?: string;
      contentUrl?: string;
      consentText: string;
    },
  ) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: data.channelId, workspaceId },
    });
    if (!channel) throw new BadRequestException('Channel not found in workspace');

    const slug = generateSlug(10);
    return this.prisma.leadMagnet.create({
      data: {
        workspaceId,
        channelId: data.channelId,
        slug,
        name: data.name,
        description: data.description,
        contentUrl: data.contentUrl,
        consentText: data.consentText,
      },
      include: { channel: { select: { title: true, username: true } } },
    });
  }

  async list(workspaceId: string) {
    return this.prisma.leadMagnet.findMany({
      where: { workspaceId },
      include: {
        channel: { select: { title: true } },
        _count: { select: { claims: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBotLink(slug: string): Promise<string> {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? 'cleartg_bot';
    return `https://t.me/${botUsername}?start=lm_${slug}`;
  }

  async handleStart(telegramUserId: string, slug: string) {
    const leadMagnet = await this.prisma.leadMagnet.findFirst({
      where: { slug, isActive: true },
      include: { channel: true },
    });
    if (!leadMagnet) {
      return { text: 'Lead magnet не знайдено або неактивний.' };
    }

    await this.redis.set(
      `lm_pending:${telegramUserId}`,
      JSON.stringify({ slug, workspaceId: leadMagnet.workspaceId }),
      'EX',
      PENDING_TTL_SEC,
    );

    await this.prisma.subscriberProfile.updateMany({
      where: { telegramUserId, workspaceId: leadMagnet.workspaceId },
      data: { botStarted: true, botOptedOut: false },
    });

    return {
      text:
        `${leadMagnet.name}\n\n` +
        `${leadMagnet.consentText}\n\n` +
        `Щоб отримати матеріал, спочатку підпишіться на канал, потім надішліть боту: ${CONSENT_KEYWORD}\n\n` +
        `Розсилки приходять лише тим, хто сам запустив бота і не відписався.\n` +
        `Відписатися: /stop`,
      channelLink: leadMagnet.channel.username
        ? `https://t.me/${leadMagnet.channel.username}`
        : undefined,
    };
  }

  async handleConsentMessage(telegramUserId: string, text: string) {
    if (text.trim().toUpperCase() !== CONSENT_KEYWORD) return null;

    const pending = await this.redis.get(`lm_pending:${telegramUserId}`);
    if (!pending) return null;

    const { slug } = JSON.parse(pending) as { slug: string };
    const leadMagnet = await this.prisma.leadMagnet.findFirst({
      where: { slug, isActive: true },
      include: { channel: true },
    });
    if (!leadMagnet) return { text: 'Lead magnet більше не доступний.' };

    const memberStatus = await this.telegram.getMemberStatus(
      leadMagnet.channel.telegramChatId,
      telegramUserId,
    );

    if (!memberStatus || !isActiveMemberStatus(memberStatus)) {
      const channelUrl = leadMagnet.channel.username
        ? `https://t.me/${leadMagnet.channel.username}`
        : 'канал';
      return {
        text:
          `Спочатку підпишіться на канал вручну в Telegram.\n` +
          `Підписка відбувається тільки вручну — ми вас не додаємо автоматично.\n` +
          (leadMagnet.channel.username ? `Канал: https://t.me/${leadMagnet.channel.username}` : ''),
      };
    }

    const profile = await this.prisma.subscriberProfile.findFirst({
      where: {
        workspaceId: leadMagnet.workspaceId,
        channelId: leadMagnet.channelId,
        telegramUserId,
      },
      orderBy: { subscribedAt: 'desc' },
    });

    if (!profile) {
      return {
        text: 'Підписку підтверджено. Зачекайте кілька хвилин і надішліть ПОГОДЖУЮСЬ знову — ми фіксуємо подію підписки.',
      };
    }

    const existingClaim = await this.prisma.leadMagnetClaim.findFirst({
      where: { leadMagnetId: leadMagnet.id, subscriberProfileId: profile.id },
    });
    if (existingClaim) {
      return {
        text: `Ви вже отримали цей матеріал.\n${leadMagnet.contentUrl ?? ''}`,
      };
    }

    await this.prisma.leadMagnetClaim.create({
      data: {
        leadMagnetId: leadMagnet.id,
        subscriberProfileId: profile.id,
        consentRecorded: true,
      },
    });

    await this.conversion.createLeadMagnetEvent(profile.id, leadMagnet.id);
    await this.redis.del(`lm_pending:${telegramUserId}`);

    await this.audit.log({
      workspaceId: leadMagnet.workspaceId,
      action: 'lead_magnet_claimed',
      entityType: 'lead_magnet',
      entityId: leadMagnet.id,
      metadata: { subscriberProfileId: profile.id },
    });

    return {
      text:
        `Дякуємо! Ось ваш матеріал:\n${leadMagnet.contentUrl ?? '(посилання буде надано адміністратором)'}\n\n` +
        `Ви можете запросити видалення даних через Політику конфіденційності.`,
    };
  }
}
