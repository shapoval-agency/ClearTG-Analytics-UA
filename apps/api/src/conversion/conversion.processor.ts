import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../integrations/meta/meta.service';
import { GA4Service } from '../integrations/ga4/ga4.service';
import { GoogleAdsService } from '../integrations/google-ads/google-ads.service';
import { TikTokService } from '../integrations/tiktok/tiktok.service';
import { CONVERSION_QUEUE } from './conversion.service';
import { ConversionEventStatus, ConversionPlatform } from '@cleartg/database';
import { ConsentSnapshot } from '@cleartg/shared';

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
        subscriberProfile: true,
        attribution: { include: { clickEvent: true } },
      },
    });
    if (!event) return;

    if (event.eventName === 'TG_Subscribe' && event.subscriberProfileId && event.campaignId) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: event.campaignId },
        select: { conversionDelayMinutes: true },
      });
      const delayMin = campaign?.conversionDelayMinutes ?? 0;
      if (delayMin > 0) {
        const quickUnsub = await this.prisma.unsubscribeEvent.findFirst({
          where: {
            subscriberProfileId: event.subscriberProfileId,
            occurredAt: {
              lte: new Date(event.eventTime.getTime() + delayMin * 60 * 1000),
            },
          },
        });
        if (quickUnsub) {
          await this.prisma.conversionEvent.update({
            where: { id: event.id },
            data: { status: ConversionEventStatus.SKIPPED_POLICY_RESTRICTION },
          });
          return;
        }
      }
    }

    const consent = event.consentSnapshot as unknown as ConsentSnapshot;
    const eligibility = event.eligibilityFlags as Record<string, { eligible: boolean }>;
    const click = event.attribution?.clickEvent;

    const deliveries: Array<{ platform: ConversionPlatform; result: Awaited<ReturnType<MetaService['sendEvent']>> }> = [];

    if (eligibility?.meta?.eligible) {
      const result = await this.meta.sendEvent(event.workspaceId, {
        eventName: event.eventName,
        eventTime: event.eventTime,
        eventId: event.eventId,
        consent,
        click,
        externalIdHash: event.subscriberProfile?.externalIdHash,
      });
      deliveries.push({ platform: ConversionPlatform.META, result });
    }

    if (eligibility?.ga4?.eligible) {
      const result = await this.ga4.sendEvent(event.workspaceId, {
        eventName: event.eventName,
        eventTime: event.eventTime,
        eventId: event.eventId,
        consent,
        click,
        externalIdHash: event.subscriberProfile?.externalIdHash,
      });
      deliveries.push({ platform: ConversionPlatform.GA4, result });
    }

    if (eligibility?.google_ads?.eligible) {
      const result = await this.googleAds.sendEvent(event.workspaceId, {
        eventName: event.eventName,
        eventTime: event.eventTime,
        eventId: event.eventId,
        consent,
        click,
        externalIdHash: event.subscriberProfile?.externalIdHash,
      });
      deliveries.push({ platform: ConversionPlatform.GOOGLE_ADS, result });
    }

    if (eligibility?.tiktok?.eligible) {
      const result = await this.tiktok.sendEvent(event.workspaceId, {
        eventName: event.eventName,
        eventTime: event.eventTime,
        eventId: event.eventId,
        consent,
        click,
        externalIdHash: event.subscriberProfile?.externalIdHash,
      });
      deliveries.push({ platform: ConversionPlatform.TIKTOK, result });
    }

    const anySuccess = deliveries.some((d) => d.result.success);
    const allSkipped = deliveries.length === 0;

    await this.prisma.conversionEvent.update({
      where: { id: event.id },
      data: {
        status: allSkipped
          ? event.status
          : anySuccess
            ? ConversionEventStatus.SENT
            : ConversionEventStatus.FAILED,
      },
    });

    for (const { platform, result } of deliveries) {
      await this.prisma.conversionDeliveryLog.create({
        data: {
          conversionEventId: event.id,
          platform,
          status: result.success ? ConversionEventStatus.SENT : ConversionEventStatus.FAILED,
          requestPayload: result.requestPayload as object,
          responseStatus: result.responseStatus,
          responseBody: result.responseBody as object,
          errorMessage: result.error,
        },
      });
    }
  }
}
