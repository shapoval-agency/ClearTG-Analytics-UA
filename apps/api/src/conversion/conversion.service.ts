import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  checkDeliveryEligibility,
  generateEventId,
  ConsentSnapshot,
  DEFAULT_CONSENT,
} from '@cleartg/shared';
import { ConversionEventStatus, EventSource } from '@cleartg/database';

export const CONVERSION_QUEUE = 'conversion-delivery';

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
        attribution: {
          include: { clickEvent: true },
        },
        subscriberProfile: true,
      },
    });
    if (!event) return null;

    const click = event.attribution?.clickEvent;
    const consent = (click?.consentSnapshot as unknown as ConsentSnapshot) ?? DEFAULT_CONSENT;

    const eligibility = this.buildEligibilityFlags(consent, {
      hasClickId: !!(click?.fbclid || click?.gclid || click?.ttclid),
      hasExternalId: !!event.subscriberProfile?.externalIdHash,
      hasGaClientId: !!click?.gaClientId,
    });

    const conversionEvent = await this.prisma.conversionEvent.create({
      data: {
        workspaceId: event.workspaceId,
        channelId: event.channelId,
        campaignId: event.attribution?.campaignId,
        clickEventId: event.attribution?.clickEventId,
        attributionId: event.attribution?.id,
        subscriberProfileId: event.subscriberProfile?.id,
        eventName: 'TG_Subscribe',
        eventTime: event.occurredAt,
        eventSource: EventSource.TELEGRAM_SUBSCRIPTION,
        eventId: generateEventId(),
        consentSnapshot: consent as object,
        eligibilityFlags: eligibility as object,
        status: this.resolveStatus(eligibility),
      },
    });

    if (conversionEvent.status === ConversionEventStatus.PENDING) {
      await this.deliveryQueue.add('deliver', { conversionEventId: conversionEvent.id });
    }

    return conversionEvent;
  }

  async createRetentionEvent(subscriberProfileId: string, day: 1 | 7 | 30) {
    const profile = await this.prisma.subscriberProfile.findUnique({
      where: { id: subscriberProfileId },
      include: {
        membershipEvent: {
          include: {
            attribution: { include: { clickEvent: true } },
          },
        },
      },
    });
    if (!profile) return null;

    const eventName = day === 1 ? 'TG_Qualified_Subscribe_D1'
      : day === 7 ? 'TG_Qualified_Subscribe_D7'
      : 'TG_Qualified_Subscribe_D30';

    const click = profile.membershipEvent.attribution?.clickEvent;
    const consent = (click?.consentSnapshot as unknown as ConsentSnapshot) ?? DEFAULT_CONSENT;

    const eligibility = this.buildEligibilityFlags(consent, {
      hasClickId: !!(click?.fbclid || click?.gclid || click?.ttclid),
      hasExternalId: !!profile.externalIdHash,
      hasGaClientId: !!click?.gaClientId,
    });

    const conversionEvent = await this.prisma.conversionEvent.create({
      data: {
        workspaceId: profile.workspaceId,
        channelId: profile.channelId,
        campaignId: profile.membershipEvent.attribution?.campaignId,
        clickEventId: profile.membershipEvent.attribution?.clickEventId,
        attributionId: profile.membershipEvent.attribution?.id,
        subscriberProfileId: profile.id,
        eventName,
        eventTime: new Date(),
        eventSource: EventSource.TELEGRAM_RETENTION,
        eventId: generateEventId(),
        consentSnapshot: consent as object,
        eligibilityFlags: eligibility as object,
        status: this.resolveStatus(eligibility),
      },
    });

    if (conversionEvent.status === ConversionEventStatus.PENDING) {
      await this.deliveryQueue.add('deliver', { conversionEventId: conversionEvent.id });
    }

    return conversionEvent;
  }

  async createLeadMagnetEvent(subscriberProfileId: string, leadMagnetId: string) {
    const profile = await this.prisma.subscriberProfile.findUnique({
      where: { id: subscriberProfileId },
      include: {
        membershipEvent: {
          include: {
            attribution: { include: { clickEvent: true } },
          },
        },
      },
    });
    if (!profile) return null;

    const click = profile.membershipEvent.attribution?.clickEvent;
    const consent = (click?.consentSnapshot as unknown as ConsentSnapshot) ?? DEFAULT_CONSENT;

    const eligibility = this.buildEligibilityFlags(consent, {
      hasClickId: !!(click?.fbclid || click?.gclid || click?.ttclid),
      hasExternalId: !!profile.externalIdHash,
      hasGaClientId: !!click?.gaClientId,
    });

    const conversionEvent = await this.prisma.conversionEvent.create({
      data: {
        workspaceId: profile.workspaceId,
        channelId: profile.channelId,
        campaignId: profile.membershipEvent.attribution?.campaignId,
        clickEventId: profile.membershipEvent.attribution?.clickEventId,
        attributionId: profile.membershipEvent.attribution?.id,
        subscriberProfileId: profile.id,
        eventName: 'LeadMagnet_Claimed',
        eventTime: new Date(),
        eventSource: EventSource.LEAD_MAGNET,
        eventId: generateEventId(),
        consentSnapshot: consent as object,
        eligibilityFlags: eligibility as object,
        status: this.resolveStatus(eligibility),
        payloadPreview: { leadMagnetId } as object,
      },
    });

    if (conversionEvent.status === ConversionEventStatus.PENDING) {
      await this.deliveryQueue.add('deliver', { conversionEventId: conversionEvent.id });
    }

    return conversionEvent;
  }

  private buildEligibilityFlags(
    consent: ConsentSnapshot,
    identifiers: { hasClickId?: boolean; hasExternalId?: boolean; hasGaClientId?: boolean },
  ) {
    return {
      meta: checkDeliveryEligibility('meta', consent, identifiers),
      google_ads: checkDeliveryEligibility('google_ads', consent, identifiers),
      ga4: checkDeliveryEligibility('ga4', consent, identifiers),
      tiktok: checkDeliveryEligibility('tiktok', consent, identifiers),
    };
  }

  private resolveStatus(eligibility: Record<string, { eligible: boolean; status: string }>): ConversionEventStatus {
    const anyEligible = Object.values(eligibility).some((e) => e.eligible);
    if (anyEligible) return ConversionEventStatus.PENDING;

    const allNoConsent = Object.values(eligibility).every((e) => e.status === 'skipped_no_consent');
    if (allNoConsent) return ConversionEventStatus.SKIPPED_NO_CONSENT;

    const allNoId = Object.values(eligibility).every((e) => e.status === 'skipped_no_identifier');
    if (allNoId) return ConversionEventStatus.SKIPPED_NO_IDENTIFIER;

    return ConversionEventStatus.SKIPPED_POLICY_RESTRICTION;
  }

  async getDeliveryStats(workspaceId: string) {
    const stats = await this.prisma.conversionEvent.groupBy({
      by: ['status'],
      where: { workspaceId },
      _count: true,
    });

    return stats.map((s) => ({ status: s.status, count: s._count }));
  }
}
