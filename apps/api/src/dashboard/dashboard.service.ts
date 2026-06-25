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

    return {
      clicks,
      subscribers,
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
        const clicks = await this.prisma.clickEvent.count({
          where: { trackingLinkId: link.id },
        });
        const subscribers = await this.prisma.attribution.count({
          where: {
            trackingLinkId: link.id,
            membershipEvent: { eventType: MembershipEventType.SUBSCRIBE },
          },
        });

        return {
          id: link.id,
          slug: link.slug,
          name: link.name,
          campaignName: link.campaign?.name ?? null,
          channelTitle: link.channel.title,
          clicks,
          subscribers,
          conversionRate: clicks > 0 ? subscribers / clicks : 0,
          autoRedirect: link.autoRedirect,
        };
      }),
    );
  }
}
