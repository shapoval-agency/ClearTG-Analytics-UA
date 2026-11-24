import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService, type ConversionPayload, type DeliveryResult } from '../integrations/meta/meta.service';
import { GA4Service } from '../integrations/ga4/ga4.service';
import { GoogleAdsService } from '../integrations/google-ads/google-ads.service';
import { TikTokService } from '../integrations/tiktok/tiktok.service';
import { CONVERSION_QUEUE } from './conversion.service';
import { ConversionEventStatus, ConversionPlatform } from '@cleartg/database';
import { CONVERSION_EVENTS, ConsentSnapshot, getPublicLinkPath, type LinkMode } from '@cleartg/shared';
import { resolveFrontendUrl } from '../common/public-app-url';

type Sender = (workspaceId: string, payload: ConversionPayload) => Promise<DeliveryResult>;

@Processor(CONVERSION_QUEUE)
export class ConversionDeliveryProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private meta: MetaService,
    private ga4: GA4Service,
    private googleAds: GoogleAdsService,
    private tiktok: TikTokService,
  ) {
    super();
  }

  async process(job: Job<{ conversionEventId: string }>) {
    const event = await this.prisma.conversionEvent.findUnique({
      where: { id: job.data.conversionEventId },
      include: {
        workspace: { select: { skipQuickUnsubscribes: true } },
        subscriberProfile: { include: { _count: { select: { unsubscribeEvents: true } } } },
      },
    });
    if (!event || event.status !== ConversionEventStatus.PENDING) return;

    // S3-10: реклама не повинна вчитися на тих, хто підписався й одразу пішов.
    // Перевіряємо в момент відправки — тобто після затримки S3-09.
    if (
      event.eventName === CONVERSION_EVENTS.subscribe &&
      event.workspace.skipQuickUnsubscribes &&
      (event.subscriberProfile?._count.unsubscribeEvents ?? 0) > 0
    ) {
      await this.prisma.conversionEvent.update({
        where: { id: event.id },
        data: { status: ConversionEventStatus.SKIPPED_UNSUBSCRIBED },
      });
      return;
    }

    const click = event.clickEventId
      ? await this.prisma.clickEvent.findUnique({
          where: { id: event.clickEventId },
          include: { trackingLink: { select: { slug: true, linkMode: true } } },
        })
      : null;
    const eventSourceUrl = click?.trackingLink
      ? `${resolveFrontendUrl()}${getPublicLinkPath(click.trackingLink.linkMode as LinkMode, click.trackingLink.slug)}`
      : undefined;

    const payload: ConversionPayload = {
      eventName: event.eventName,
      eventTime: event.eventTime,
      eventId: event.eventId,
      consent: event.consentSnapshot as unknown as ConsentSnapshot,
      click,
      externalIdHash: event.subscriberProfile?.externalIdHash,
      eventSourceUrl,
    };

    const eligibility = event.eligibilityFlags as Record<string, { eligible: boolean }>;
    const senders: Array<[string, ConversionPlatform, Sender]> = [
      ['meta', ConversionPlatform.META, (w, p) => this.meta.sendEvent(w, p)],
      ['ga4', ConversionPlatform.GA4, (w, p) => this.ga4.sendEvent(w, p)],
      ['google_ads', ConversionPlatform.GOOGLE_ADS, (w, p) => this.googleAds.sendEvent(w, p)],
      ['tiktok', ConversionPlatform.TIKTOK, (w, p) => this.tiktok.sendEvent(w, p)],
    ];

    const deliveries: Array<{ platform: ConversionPlatform; result: DeliveryResult }> = [];
    for (const [key, platform, send] of senders) {
      if (!eligibility?.[key]?.eligible) continue;
      deliveries.push({ platform, result: await send(event.workspaceId, payload) });
    }

    // «Пропущено» (інтеграцію вимкнули, немає дії для цієї цілі) — не помилка.
    const attempted = deliveries.filter((d) => !d.result.skipped);
    const status =
      attempted.length === 0
        ? ConversionEventStatus.SKIPPED_NO_IDENTIFIER
        : attempted.some((d) => d.result.success)
          ? ConversionEventStatus.SENT
          : ConversionEventStatus.FAILED;

    await this.prisma.conversionEvent.update({ where: { id: event.id }, data: { status } });

    for (const { platform, result } of deliveries) {
      await this.prisma.conversionDeliveryLog.create({
        data: {
          conversionEventId: event.id,
          platform,
          status: result.success
            ? ConversionEventStatus.SENT
            : result.skipped
              ? ConversionEventStatus.SKIPPED_POLICY_RESTRICTION
              : ConversionEventStatus.FAILED,
          requestPayload: result.requestPayload as object,
          responseStatus: result.responseStatus,
          responseBody: result.responseBody as object,
          errorMessage: result.error,
        },
      });
    }
  }
}
