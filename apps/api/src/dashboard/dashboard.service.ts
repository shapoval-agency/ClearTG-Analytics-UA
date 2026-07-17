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

    // Fallback: профіль могли не привʼязати (підписка до бота / без profile id)
    const missingUserIds = [
      ...new Set(
        events
          .filter((e) => !e.subscriberProfile)
          .map((e) => e.telegramUserId),
      ),
    ];
    const fallbackProfiles =
      missingUserIds.length === 0
        ? []
        : await this.prisma.subscriberProfile.findMany({
            where: {
              workspaceId,
              telegramUserId: { in: missingUserIds },
            },
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
          });
    const profileByUserChannel = new Map(
      fallbackProfiles.map((p) => [`${p.channelId}:${p.telegramUserId}`, p]),
    );

    const unsubMemberships = await this.prisma.membershipEvent.findMany({
      where: {
        workspaceId,
        eventType: MembershipEventType.UNSUBSCRIBE,
        telegramUserId: { in: events.map((e) => e.telegramUserId) },
      },
      select: {
        telegramUserId: true,
        channelId: true,
        telegramUsername: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: 'desc' },
    });
    const usernameByUserChannel = new Map<string, string>();
    for (const m of unsubMemberships) {
      const key = `${m.channelId}:${m.telegramUserId}`;
      if (m.telegramUsername && !usernameByUserChannel.has(key)) {
        usernameByUserChannel.set(key, m.telegramUsername);
      }
    }

    return events.map((e) => {
      const profile =
        e.subscriberProfile ??
        profileByUserChannel.get(`${e.channelId}:${e.telegramUserId}`) ??
        null;
      const attr = profile?.membershipEvent.attribution ?? null;
      const username =
        profile?.membershipEvent.telegramUsername ??
        usernameByUserChannel.get(`${e.channelId}:${e.telegramUserId}`) ??
        null;

      return {
        id: e.id,
        occurredAt: e.occurredAt,
        channelTitle: e.channel.title,
        telegramUserId: e.telegramUserId,
        telegramUsername: username,
        subscribedAt: profile?.subscribedAt ?? null,
        hasSubscriberProfile: Boolean(profile),
        attributionType: attr?.attributionType ?? null,
        campaignName: attr?.campaign?.name ?? null,
        trackingLinkSlug: attr?.trackingLink?.slug ?? null,
        trackingLinkName: attr?.trackingLink?.name ?? null,
        utmSource: attr?.clickEvent?.utmSource ?? null,
        utmCampaign: attr?.clickEvent?.utmCampaign ?? null,
      };
    });
  }

  async getSubscriberDossier(workspaceId: string, profileId: string) {
    const profile = await this.prisma.subscriberProfile.findFirst({
      where: { id: profileId, workspaceId },
      include: {
        channel: { select: { id: true, title: true, username: true } },
        membershipEvent: {
          include: {
            attribution: {
              include: {
                campaign: true,
                trackingLink: true,
                clickEvent: true,
              },
            },
          },
        },
        unsubscribeEvents: { orderBy: { occurredAt: 'desc' } },
        leadMagnetClaims: {
          include: { leadMagnet: { select: { name: true, slug: true } } },
          orderBy: { claimedAt: 'desc' },
        },
        conversionEvents: {
          orderBy: { eventTime: 'desc' },
          take: 20,
        },
      },
    });
    if (!profile) return null;

    const attr = profile.membershipEvent.attribution;
    const daysInChannel = profile.unsubscribeEvents[0]
      ? Math.floor(
          (profile.unsubscribeEvents[0].occurredAt.getTime() - profile.subscribedAt.getTime()) /
            86400000,
        )
      : Math.floor((Date.now() - profile.subscribedAt.getTime()) / 86400000);

    return {
      id: profile.id,
      telegramUserId: profile.telegramUserId,
      telegramUsername: profile.membershipEvent.telegramUsername,
      channel: profile.channel,
      subscribedAt: profile.subscribedAt,
      isActive: profile.unsubscribeEvents.length === 0,
      daysInChannel,
      retainedD1: profile.retainedD1,
      retainedD7: profile.retainedD7,
      retainedD30: profile.retainedD30,
      botStarted: profile.botStarted,
      botOptedOut: profile.botOptedOut,
      attribution: attr
        ? {
            type: attr.attributionType,
            confidence: attr.confidenceScore,
            reason: attr.reason,
            campaign: attr.campaign?.name ?? null,
            trackingLink: attr.trackingLink?.slug ?? null,
            utm: {
              source: attr.clickEvent?.utmSource,
              medium: attr.clickEvent?.utmMedium,
              campaign: attr.clickEvent?.utmCampaign,
              content: attr.clickEvent?.utmContent,
              term: attr.clickEvent?.utmTerm,
            },
            creativeTag: attr.trackingLink?.creativeTag ?? null,
            postNumber: attr.trackingLink?.postNumber ?? null,
            clickedAt: attr.clickEvent?.clickedAt ?? null,
            telegramOpenedAt: attr.clickEvent?.telegramOpenedAt ?? null,
          }
        : null,
      unsubscribes: profile.unsubscribeEvents,
      leadMagnets: profile.leadMagnetClaims.map((c) => ({
        name: c.leadMagnet.name,
        slug: c.leadMagnet.slug,
        claimedAt: c.claimedAt,
      })),
      conversions: profile.conversionEvents.map((e) => ({
        eventName: e.eventName,
        eventTime: e.eventTime,
        status: e.status,
      })),
    };
  }

  async exportSubscribersCsv(workspaceId: string): Promise<string> {
    const rows = await this.getSubscriberFeed(workspaceId, 5000);
    const header =
      'subscribed_at,channel,username,telegram_user_id,status,source,attribution,campaign,utm_source,utm_campaign,confidence';
    const lines = rows.map((r) =>
      [
        r.subscribedAt,
        `"${r.channelTitle.replace(/"/g, '""')}"`,
        r.telegramUsername ?? '',
        r.telegramUserId,
        r.isActive ? 'active' : 'left',
        `"${r.joinSource.replace(/"/g, '""')}"`,
        r.attributionType,
        r.campaignName ?? '',
        r.utmSource ?? '',
        r.utmCampaign ?? '',
        r.confidenceScore,
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  async getDailyDigest(workspaceId: string, date?: string) {
    const day = date ? new Date(date) : new Date();
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);

    const [subs, unsubs, clicks, attributions] = await Promise.all([
      this.prisma.membershipEvent.count({
        where: {
          workspaceId,
          eventType: MembershipEventType.SUBSCRIBE,
          occurredAt: { gte: day, lt: next },
        },
      }),
      this.prisma.unsubscribeEvent.count({
        where: { workspaceId, occurredAt: { gte: day, lt: next } },
      }),
      this.prisma.clickEvent.count({
        where: { workspaceId, clickedAt: { gte: day, lt: next } },
      }),
      this.prisma.attribution.groupBy({
        by: ['attributionType'],
        where: {
          workspaceId,
          membershipEvent: {
            eventType: MembershipEventType.SUBSCRIBE,
            occurredAt: { gte: day, lt: next },
          },
        },
        _count: true,
      }),
    ]);

    return {
      date: day.toISOString().slice(0, 10),
      subscriptions: subs,
      unsubscribes: unsubs,
      netGrowth: subs - unsubs,
      clicks,
      clickToSubscribeRate: clicks > 0 ? subs / clicks : 0,
      sources: attributions.map((a) => ({
        type: a.attributionType,
        count: a._count,
      })),
    };
  }
}
