import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttributionService } from '../attribution/attribution.service';
import { ConversionService } from '../conversion/conversion.service';
import { MembershipEventType } from '@cleartg/database';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private attribution: AttributionService,
    private conversion: ConversionService,
  ) {}

  async getOverview(workspaceId: string) {
    const [clicks, subscribers, unsubscribes, attributions, deliveryStats] = await Promise.all([
      this.prisma.clickEvent.count({ where: { workspaceId } }),
      this.prisma.membershipEvent.count({
        where: { workspaceId, eventType: MembershipEventType.SUBSCRIBE },
      }),
      this.prisma.unsubscribeEvent.count({ where: { workspaceId } }),
      this.attribution.getAttributionStats(workspaceId),
      this.conversion.getDeliveryStats(workspaceId),
    ]);

    const clickToSubscribeRate = clicks > 0 ? subscribers / clicks : 0;

    const retention = await this.getRetentionStats(workspaceId);

    const activeSubscribers = await this.prisma.subscriberProfile.count({
      where: { workspaceId, unsubscribeEvents: { none: {} } },
    });

    return {
      clicks,
      subscribers,
      activeSubscribers,
      unsubscribes,
      clickToSubscribeRate,
      retention,
      attributions,
      deliveryStats,
    };
  }

  private async getRetentionStats(workspaceId: string) {
    const profiles = await this.prisma.subscriberProfile.findMany({
      where: { workspaceId },
      select: { retainedD1: true, retainedD7: true, retainedD30: true },
    });

    const total = profiles.length;
    if (total === 0) return { d1: 0, d7: 0, d30: 0 };

    const d1 = profiles.filter((p) => p.retainedD1 === true).length;
    const d7 = profiles.filter((p) => p.retainedD7 === true).length;
    const d30 = profiles.filter((p) => p.retainedD30 === true).length;

    return {
      d1: d1 / total,
      d7: d7 / total,
      d30: d30 / total,
      d1Count: d1,
      d7Count: d7,
      d30Count: d30,
      total,
    };
  }

  async getPixelDelivery(workspaceId: string) {
    return this.prisma.conversionDeliveryLog.findMany({
      where: { conversionEvent: { workspaceId } },
      include: {
        conversionEvent: {
          select: { eventName: true, eventTime: true, status: true },
        },
      },
      orderBy: { deliveredAt: 'desc' },
      take: 100,
    });
  }

  async getCampaignReports(workspaceId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { workspaceId, isActive: true },
      include: { channel: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      campaigns.map(async (campaign) => {
        const [clicks, subscribers, unsubscribes] = await Promise.all([
          this.prisma.clickEvent.count({ where: { campaignId: campaign.id } }),
          this.prisma.attribution.count({
            where: {
              campaignId: campaign.id,
              membershipEvent: { eventType: MembershipEventType.SUBSCRIBE },
            },
          }),
          this.prisma.unsubscribeEvent.count({
            where: { channelId: campaign.channelId },
          }),
        ]);

        return {
          id: campaign.id,
          name: campaign.name,
          adPlatform: campaign.adPlatform,
          channelTitle: campaign.channel.title,
          clicks,
          subscribers,
          unsubscribes,
          conversionRate: clicks > 0 ? subscribers / clicks : 0,
          spendAmount: campaign.spendAmount,
        };
      }),
    );
  }

  async getTrackingLinkReports(workspaceId: string) {
    const links = await this.prisma.trackingLink.findMany({
      where: { workspaceId },
      include: {
        campaign: { select: { name: true } },
        channel: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      links.map(async (link) => {
        const [clicks, subscribers, unsubscribes] = await Promise.all([
          this.prisma.clickEvent.count({ where: { trackingLinkId: link.id } }),
          this.prisma.attribution.count({
            where: {
              trackingLinkId: link.id,
              membershipEvent: { eventType: MembershipEventType.SUBSCRIBE },
            },
          }),
          this.prisma.unsubscribeEvent.count({
            where: {
              channelId: link.channelId,
              subscriberProfile: {
                membershipEvent: { attribution: { trackingLinkId: link.id } },
              },
            },
          }),
        ]);

        return {
          id: link.id,
          slug: link.slug,
          name: link.name,
          campaignName: link.campaign?.name ?? null,
          channelTitle: link.channel.title,
          clicks,
          subscribers,
          unsubscribes,
          conversionRate: clicks > 0 ? subscribers / clicks : 0,
          autoRedirect: link.autoRedirect,
        };
      }),
    );
  }

  async getSubscriberFeed(workspaceId: string, limit = 100) {
    const profiles = await this.prisma.subscriberProfile.findMany({
      where: { workspaceId },
      include: {
        channel: { select: { title: true } },
        membershipEvent: {
          include: {
            attribution: {
              include: {
                campaign: { select: { name: true } },
                trackingLink: { select: { slug: true, name: true } },
                clickEvent: {
                  select: {
                    utmSource: true,
                    utmMedium: true,
                    utmCampaign: true,
                  },
                },
              },
            },
          },
        },
        _count: { select: { unsubscribeEvents: true } },
      },
      orderBy: { subscribedAt: 'desc' },
      take: limit,
    });

    return profiles.map((p) => {
      const attr = p.membershipEvent.attribution;
      const hasAdSource =
        attr &&
        ['EXACT_CLICK_INVITE', 'CAMPAIGN_INVITE', 'PROBABILISTIC'].includes(attr.attributionType) &&
        (attr.campaign?.name || attr.trackingLink?.slug);

      let joinSource = 'Telegram (канал)';
      if (hasAdSource) {
        const parts = [attr.campaign?.name, attr.trackingLink?.slug ? `/${attr.trackingLink.slug}` : null].filter(Boolean);
        joinSource = `Реклама: ${parts.join(' ')}`;
      } else if (attr?.attributionType === 'ORGANIC') {
        joinSource = 'Telegram (напряму)';
      }

      return {
        id: p.id,
        subscribedAt: p.subscribedAt,
        channelTitle: p.channel.title,
        telegramUserId: p.telegramUserId,
        telegramUsername: p.membershipEvent.telegramUsername,
        isActive: p._count.unsubscribeEvents === 0,
        joinSource,
        attributionType: attr?.attributionType ?? 'UNKNOWN',
        campaignName: attr?.campaign?.name ?? null,
        trackingLinkSlug: attr?.trackingLink?.slug ?? null,
        trackingLinkName: attr?.trackingLink?.name ?? null,
        confidenceScore: attr?.confidenceScore ?? 0,
        utmSource: attr?.clickEvent?.utmSource ?? null,
        utmCampaign: attr?.clickEvent?.utmCampaign ?? null,
      };
    });
  }

  async getUnsubscribeFeed(workspaceId: string, limit = 100) {
    const events = await this.prisma.unsubscribeEvent.findMany({
      where: { workspaceId },
      include: {
        channel: { select: { title: true } },
        subscriberProfile: {
          include: {
            membershipEvent: {
              include: {
                attribution: {
                  include: {
                    campaign: { select: { name: true } },
                    trackingLink: { select: { slug: true, name: true } },
                    clickEvent: {
                      select: {
                        utmSource: true,
                        utmMedium: true,
                        utmCampaign: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });

    return events.map((e) => {
      const attr = e.subscriberProfile?.membershipEvent.attribution;
      return {
        id: e.id,
        occurredAt: e.occurredAt,
        channelTitle: e.channel.title,
        telegramUsername: e.subscriberProfile?.membershipEvent.telegramUsername ?? null,
        subscribedAt: e.subscriberProfile?.subscribedAt ?? null,
        attributionType: attr?.attributionType ?? null,
        campaignName: attr?.campaign?.name ?? null,
        trackingLinkSlug: attr?.trackingLink?.slug ?? null,
        trackingLinkName: attr?.trackingLink?.name ?? null,
        utmSource: attr?.clickEvent?.utmSource ?? null,
        utmCampaign: attr?.clickEvent?.utmCampaign ?? null,
      };
    });
  }
}
