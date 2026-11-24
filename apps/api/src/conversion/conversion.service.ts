import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildConversionEligibility,
  resolveConversionDelayMinutes,
  resolveConversionStatus,
  generateEventId,
  CONVERSION_EVENTS,
  ConsentSnapshot,
  DEFAULT_CONSENT,
  type ConversionPlatform,
} from '@cleartg/shared';
import { ClickEvent, ConversionEventStatus, EventSource } from '@cleartg/database';

export const CONVERSION_QUEUE = 'conversion-delivery';

interface CreateEventInput {
  workspaceId: string;
  channelId: string | null;
  campaignId: string | null;
  clickEvent: ClickEvent | null;
  attributionId: string | null;
  subscriberProfileId: string | null;
  eventName: string;
  eventTime: Date;
  eventSource: EventSource;
  delayMinutes?: number;
  payloadPreview?: Record<string, unknown>;
}

/**
 * Створення подій для рекламних кабінетів (етап 03).
 *
 * Єдиний шлях для всіх цілей — підписка, утримання, «дійшов до Telegram»,
 * «забрав подарок»: подія створюється лише якщо є куди її відправити
 * (підключена й увімкнена платформа), а відправляється тільки туди, де в
 * рекламному кліку є ідентифікатор цієї платформи. Підписка без рекламного
 * кліку (органіка, невизначене джерело) нікуди не йде.
 */
@Injectable()
export class ConversionService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(CONVERSION_QUEUE) private deliveryQueue: Queue,
  ) {}

  async createSubscribeEvent(membershipEventId: string) {
    const event = await this.prisma.membershipEvent.findUnique({
      where: { id: membershipEventId },
      include: {
        attribution: { include: { clickEvent: true, campaign: { select: { conversionDelayMinutes: true } } } },
        subscriberProfile: true,
        workspace: { select: { conversionDelayHours: true } },
      },
    });
    if (!event) return null;

    return this.createEvent({
      workspaceId: event.workspaceId,
      channelId: event.channelId,
      campaignId: event.attribution?.campaignId ?? null,
      clickEvent: event.attribution?.clickEvent ?? null,
      attributionId: event.attribution?.id ?? null,
      subscriberProfileId: event.subscriberProfile?.id ?? null,
      eventName: CONVERSION_EVENTS.subscribe,
      eventTime: event.occurredAt,
      eventSource: EventSource.TELEGRAM_SUBSCRIPTION,
      delayMinutes: resolveConversionDelayMinutes(
        event.attribution?.campaign?.conversionDelayMinutes,
        event.workspace.conversionDelayHours,
      ),
    });
  }

  async createRetentionEvent(subscriberProfileId: string, day: 1 | 7 | 30) {
    const profile = await this.loadProfile(subscriberProfileId);
    if (!profile) return null;

    const eventName = day === 1 ? 'TG_Qualified_Subscribe_D1'
      : day === 7 ? 'TG_Qualified_Subscribe_D7'
      : 'TG_Qualified_Subscribe_D30';

    return this.createEvent({
      ...this.fromProfile(profile),
      eventName,
      eventTime: new Date(),
      eventSource: EventSource.TELEGRAM_RETENTION,
    });
  }

  /** S3-16: «забрав подарок» — окрема ціль, лише якщо її увімкнено в кабінеті. */
  async createLeadMagnetEvent(subscriberProfileId: string, leadMagnetId: string) {
    const profile = await this.loadProfile(subscriberProfileId);
    if (!profile || !profile.workspace.sendGiftEvent) return null;

    return this.createEvent({
      ...this.fromProfile(profile),
      eventName: CONVERSION_EVENTS.gift,
      eventTime: new Date(),
      eventSource: EventSource.LEAD_MAGNET,
      payloadPreview: { leadMagnetId },
    });
  }

  /**
   * S3-12: «дійшов до Telegram» — окрема ціль. Лише для кліків, де перехід
   * справді вимірювався (людина натиснула кнопку на сторінці, S2-10/S2-11).
   * Одна подія на клік: повторний маячок нічого не дублює.
   */
  async createReachEvent(clickEventId: string) {
    const click = await this.prisma.clickEvent.findUnique({
      where: { id: clickEventId },
      include: { workspace: { select: { sendReachEvent: true } } },
    });
    if (!click || !click.reachTracked || !click.telegramOpenedAt || !click.workspace.sendReachEvent) {
      return null;
    }
    const existing = await this.prisma.conversionEvent.findFirst({
      where: { workspaceId: click.workspaceId, clickEventId, eventName: CONVERSION_EVENTS.reach },
      select: { id: true },
    });
    if (existing) return null;

    const { workspace: _workspace, ...clickEvent } = click;
    return this.createEvent({
      workspaceId: click.workspaceId,
      channelId: click.channelId,
      campaignId: click.campaignId,
      clickEvent,
      attributionId: null,
      subscriberProfileId: null,
      eventName: CONVERSION_EVENTS.reach,
      eventTime: click.telegramOpenedAt,
      eventSource: EventSource.TELEGRAM_REACH,
    });
  }

  async getDeliveryStats(workspaceId: string) {
    const stats = await this.prisma.conversionEvent.groupBy({
      by: ['status'],
      where: { workspaceId },
      _count: true,
    });

    return stats.map((s) => ({ status: s.status, count: s._count }));
  }

  /**
   * Налаштування цілей + зведення за 30 днів: скільки відправлено, чекає,
   * відсіяно, пропущено і з помилкою. Останні помилки — щоб було що виправляти.
   */
  async getSettings(workspaceId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [workspace, connected, byStatus, byEvent, recentFailures] = await Promise.all([
      this.prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { conversionDelayHours: true, skipQuickUnsubscribes: true, sendReachEvent: true, sendGiftEvent: true },
      }),
      this.getConnectedPlatforms(workspaceId),
      this.prisma.conversionEvent.groupBy({
        by: ['status'],
        where: { workspaceId, createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.conversionEvent.groupBy({
        by: ['eventName', 'status'],
        where: { workspaceId, createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.conversionDeliveryLog.findMany({
        where: { status: ConversionEventStatus.FAILED, conversionEvent: { workspaceId }, deliveredAt: { gte: since } },
        orderBy: { deliveredAt: 'desc' },
        take: 5,
        select: { platform: true, errorMessage: true, deliveredAt: true, conversionEvent: { select: { eventName: true } } },
      }),
    ]);

    return {
      ...workspace,
      connected: [...connected],
      last30Days: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byEvent: byEvent.map((e) => ({ eventName: e.eventName, status: e.status, count: e._count })),
      recentFailures: recentFailures.map((f) => ({
        platform: f.platform,
        eventName: f.conversionEvent.eventName,
        error: f.errorMessage?.slice(0, 300) ?? null,
        at: f.deliveredAt,
      })),
    };
  }

  async updateSettings(
    workspaceId: string,
    data: { conversionDelayHours?: number; skipQuickUnsubscribes?: boolean; sendReachEvent?: boolean; sendGiftEvent?: boolean },
  ) {
    await this.prisma.workspace.update({ where: { id: workspaceId }, data });
    return this.getSettings(workspaceId);
  }

  /** Платформи, які підключені та увімкнені (S3-03: GA4, Ads або обидві). */
  async getConnectedPlatforms(workspaceId: string): Promise<Set<ConversionPlatform>> {
    const where = { workspaceId, isActive: true };
    const [meta, googleAds, ga4, tiktok] = await Promise.all([
      this.prisma.metaIntegration.count({ where }),
      this.prisma.googleAdsIntegration.count({ where }),
      this.prisma.gA4Integration.count({ where }),
      this.prisma.tikTokIntegration.count({ where }),
    ]);
    const connected = new Set<ConversionPlatform>();
    if (meta) connected.add('meta');
    if (googleAds) connected.add('google_ads');
    if (ga4) connected.add('ga4');
    if (tiktok) connected.add('tiktok');
    return connected;
  }

  private async createEvent(input: CreateEventInput) {
    const connected = await this.getConnectedPlatforms(input.workspaceId);
    const consent =
      (input.clickEvent?.consentSnapshot as unknown as ConsentSnapshot | undefined) ?? DEFAULT_CONSENT;
    const eligibility = buildConversionEligibility({ consent, click: input.clickEvent, connected });
    const status = resolveConversionStatus(eligibility);
    if (status === null) return null; // жодна платформа не підключена — нічого фіксувати

    const conversionEvent = await this.prisma.conversionEvent.create({
      data: {
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        campaignId: input.campaignId,
        clickEventId: input.clickEvent?.id ?? null,
        attributionId: input.attributionId,
        subscriberProfileId: input.subscriberProfileId,
        eventName: input.eventName,
        eventTime: input.eventTime,
        eventSource: input.eventSource,
        eventId: generateEventId(),
        consentSnapshot: consent as object,
        eligibilityFlags: eligibility as object,
        status: status as ConversionEventStatus,
        ...(input.payloadPreview ? { payloadPreview: input.payloadPreview as object } : {}),
      },
    });

    if (conversionEvent.status === ConversionEventStatus.PENDING) {
      const delayMs = (input.delayMinutes ?? 0) * 60 * 1000;
      await this.deliveryQueue.add(
        'deliver',
        { conversionEventId: conversionEvent.id },
        delayMs > 0 ? { delay: delayMs } : {},
      );
    }

    return conversionEvent;
  }

  private loadProfile(subscriberProfileId: string) {
    return this.prisma.subscriberProfile.findUnique({
      where: { id: subscriberProfileId },
      include: {
        workspace: { select: { sendGiftEvent: true } },
        membershipEvent: { include: { attribution: { include: { clickEvent: true } } } },
      },
    });
  }

  private fromProfile(profile: NonNullable<Awaited<ReturnType<ConversionService['loadProfile']>>>) {
    const attribution = profile.membershipEvent.attribution;
    return {
      workspaceId: profile.workspaceId,
      channelId: profile.channelId,
      campaignId: attribution?.campaignId ?? null,
      clickEvent: attribution?.clickEvent ?? null,
      attributionId: attribution?.id ?? null,
      subscriberProfileId: profile.id,
    };
  }
}
