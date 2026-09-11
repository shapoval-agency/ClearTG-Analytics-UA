import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttributionService } from '../attribution/attribution.service';
import { ConversionService } from '../conversion/conversion.service';
import { MembershipEventType, Prisma, ConversionPlatform, ConversionEventStatus, AttributionType } from '@cleartg/database';
import { kyivDayStart, kyivDateRange } from '@cleartg/shared';

/** Необов'язковий період і канал — спільна форма фільтра для звітів `/v2/reports`. */
export interface ReportFilterOpts {
  from?: string;
  to?: string;
  channelId?: string;
}

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private attribution: AttributionService,
    private conversion: ConversionService,
  ) {}

  /**
   * `from`/`to`/`channelId` — необов'язкові й адитивні (S1-21/S2-01 з
   * MVP_TECHNICAL_PLAN.md). Без них поведінка ідентична попередній: весь
   * час, усі канали воркспейсу — жоден існуючий виклик (наразі єдиний —
   * `DashboardController.overview()`) не ламається.
   *
   * Період застосовується скрізь як "подія СТАЛАСЬ у цьому проміжку", а не
   * "стан станом на кінець проміжку" — так усі числа в одній відповіді
   * лишаються порівнянними між собою (важливо для dataIntegrity нижче).
   * `deliveryStats` — виняток: доставка в рекламу поза межами MVP `/v2/reports`,
   * період/канал на неї свідомо не поширюємо.
   */
  async getOverview(workspaceId: string, opts: ReportFilterOpts = {}) {
    const { channelId } = opts;
    const range = kyivDateRange(opts.from, opts.to);

    const clickWhere: Prisma.ClickEventWhereInput = { workspaceId };
    if (channelId) clickWhere.channelId = channelId;
    if (range) clickWhere.clickedAt = range;

    const subscribeWhere: Prisma.MembershipEventWhereInput = {
      workspaceId,
      eventType: MembershipEventType.SUBSCRIBE,
    };
    if (channelId) subscribeWhere.channelId = channelId;
    if (range) subscribeWhere.occurredAt = range;

    const unsubscribeWhere: Prisma.UnsubscribeEventWhereInput = { workspaceId };
    if (channelId) unsubscribeWhere.channelId = channelId;
    if (range) unsubscribeWhere.occurredAt = range;

    const [clicks, reached, subscribers, unsubscribes, attributions, deliveryStats] = await Promise.all([
      this.prisma.clickEvent.count({ where: clickWhere }),
      // S2-12: частка кліків, що дійсно дійшли до Telegram (ClickEvent.telegramOpenedAt).
      this.prisma.clickEvent.count({ where: { ...clickWhere, telegramOpenedAt: { not: null } } }),
      this.prisma.membershipEvent.count({ where: subscribeWhere }),
      this.prisma.unsubscribeEvent.count({ where: unsubscribeWhere }),
      this.attribution.getAttributionStats(workspaceId, { channelId, from: opts.from, to: opts.to }),
      this.conversion.getDeliveryStats(workspaceId),
    ]);

    const clickToSubscribeRate = this.safeDivide(subscribers, clicks);
    const reachRate = this.safeDivide(reached, clicks);

    const retention = await this.getRetentionStats(workspaceId, { channelId, from: opts.from, to: opts.to });

    const activeSubscribersWhere: Prisma.SubscriberProfileWhereInput = {
      workspaceId,
      unsubscribeEvents: { none: {} },
    };
    if (channelId) activeSubscribersWhere.channelId = channelId;
    if (range) activeSubscribersWhere.subscribedAt = range;

    const activeSubscribers = await this.prisma.subscriberProfile.count({
      where: activeSubscribersWhere,
    });

    // П.17 з ТЗ: сума по всіх типах атрибуції (включно з "джерело невідоме")
    // має дорівнювати загальній кількості підписок — якщо ні, десь губимо
    // людей (наприклад, вже траплялось: гонка при одночасній підписці збігом
    // блокує створення Attribution, а MembershipEvent лишається без пари,
    // див. telegram.service.ts processSubscribe). Рахуємо тут же, без
    // додаткового запиту — обидва числа вже отримані вище. attributions вже
    // відфільтровані по тому самому period/channelId (getAttributionStats
    // вище), інакше при застосованому фільтрі periodу це порівняння
    // помилково показувало б "губимо людей" там, де насправді просто
    // порівнювались фільтровані підписки з нефільтрованою атрибуцією.
    const attributedCount = attributions.reduce((sum, a) => sum + a.count, 0);
    const dataIntegrity = {
      subscribers,
      attributed: attributedCount,
      missing: Math.max(0, subscribers - attributedCount),
      ok: attributedCount >= subscribers,
    };

    return {
      clicks,
      reached,
      reachRate,
      subscribers,
      activeSubscribers,
      unsubscribes,
      clickToSubscribeRate,
      retention,
      attributions,
      dataIntegrity,
      deliveryStats,
    };
  }

  /** `denominator <= 0` → 0, а не `NaN`/`Infinity` — той самий запобіжник, що вже був для `conversionRate`. */
  private safeDivide(numerator: number, denominator: number): number {
    return denominator > 0 ? numerator / denominator : 0;
  }

  private async getRetentionStats(workspaceId: string, opts: ReportFilterOpts = {}) {
    const range = kyivDateRange(opts.from, opts.to);
    const where: Prisma.SubscriberProfileWhereInput = { workspaceId };
    if (opts.channelId) where.channelId = opts.channelId;
    // Ретеншн лічимо для тих, хто ПІДПИСАВСЯ в цьому періоді — узгоджено з
    // тим, як period застосовується до решти getOverview (розділ вище).
    if (range) where.subscribedAt = range;

    const profiles = await this.prisma.subscriberProfile.findMany({
      where,
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

  async getPixelDelivery(
    workspaceId: string,
    opts: { limit?: number; platform?: ConversionPlatform; status?: ConversionEventStatus } = {},
  ) {
    const { limit = 100, platform, status } = opts;

    const where: Prisma.ConversionDeliveryLogWhereInput = { conversionEvent: { workspaceId } };
    if (platform) where.platform = platform;
    if (status) where.status = status;

    return this.prisma.conversionDeliveryLog.findMany({
      where,
      include: {
        conversionEvent: {
          select: { eventName: true, eventTime: true, status: true },
        },
      },
      orderBy: { deliveredAt: 'desc' },
      take: limit,
    });
  }

  async getCampaignReports(workspaceId: string, opts: ReportFilterOpts = {}) {
    const range = kyivDateRange(opts.from, opts.to);

    const campaignWhere: Prisma.CampaignWhereInput = { workspaceId, isActive: true };
    if (opts.channelId) campaignWhere.channelId = opts.channelId;

    const campaigns = await this.prisma.campaign.findMany({
      where: campaignWhere,
      include: { channel: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      campaigns.map(async (campaign) => {
        const clickWhere: Prisma.ClickEventWhereInput = { campaignId: campaign.id };
        if (range) clickWhere.clickedAt = range;

        const subscribedWhere: Prisma.AttributionWhereInput = {
          campaignId: campaign.id,
          membershipEvent: {
            eventType: MembershipEventType.SUBSCRIBE,
            ...(range ? { occurredAt: range } : {}),
          },
        };

        // Було: `unsubscribeEvent.count({ where: { channelId: campaign.channelId } })` —
        // рахувало ВСІ відписки каналу на кожен рядок, однаково для будь-якої
        // кампанії того самого каналу. Знайдено 2026-09-11 (v2-reports-plan.md,
        // розділ 4): при двох активних кампаніях на одному каналі обидві
        // показували б однакове число. Фікс — той самий ланцюжок через
        // атрибуцію, що вже коректно працює в getTrackingLinkReports нижче.
        const unsubscribedWhere: Prisma.UnsubscribeEventWhereInput = {
          channelId: campaign.channelId,
          subscriberProfile: {
            membershipEvent: { attribution: { campaignId: campaign.id } },
          },
        };
        if (range) unsubscribedWhere.occurredAt = range;

        const [clicks, reached, subscribers, unsubscribes, uniqueClickers] = await Promise.all([
          this.prisma.clickEvent.count({ where: clickWhere }),
          this.prisma.clickEvent.count({ where: { ...clickWhere, telegramOpenedAt: { not: null } } }),
          this.prisma.attribution.count({ where: subscribedWhere }),
          this.prisma.unsubscribeEvent.count({ where: unsubscribedWhere }),
          this.countUniqueClickers(campaign.id, undefined, range),
        ]);

        return {
          id: campaign.id,
          name: campaign.name,
          adPlatform: campaign.adPlatform,
          channelTitle: campaign.channel.title,
          clicks,
          reached,
          reachRate: this.safeDivide(reached, clicks),
          uniqueClickers,
          subscribers,
          unsubscribes,
          conversionRate: this.safeDivide(subscribers, clicks),
          spendAmount: campaign.spendAmount,
        };
      }),
    );
  }

  /**
   * П.12 з ТЗ: 20 кліків з одного пристрою мають лишитись 20 кліками (для
   * точності CR і рекламних метрик), але в звіті має бути видно, що це одна
   * людина, а не 20 різних. Прямого "device id" в нас немає (ми навмисно не
   * ставимо cookie/fingerprint) — наближаємо унікального відвідувача парою
   * (ipHash, userAgentHash), захешованих ще при записі кліку. Різні люди з
   * однієї мережі й однаковим браузером зіллються в один рядок — це відома
   * похибка методу, а не помилка підрахунку.
   */
  private async countUniqueClickers(
    campaignId?: string,
    trackingLinkId?: string,
    range?: { gte?: Date; lt?: Date },
  ) {
    const where: Prisma.ClickEventWhereInput = { campaignId, trackingLinkId };
    if (range) where.clickedAt = range;
    const groups = await this.prisma.clickEvent.groupBy({
      by: ['ipHash', 'userAgentHash'],
      where,
    });
    return groups.length;
  }

  async getTrackingLinkReports(workspaceId: string, opts: ReportFilterOpts = {}) {
    const range = kyivDateRange(opts.from, opts.to);

    const linkWhere: Prisma.TrackingLinkWhereInput = { workspaceId };
    if (opts.channelId) linkWhere.channelId = opts.channelId;

    const links = await this.prisma.trackingLink.findMany({
      where: linkWhere,
      include: {
        campaign: { select: { name: true } },
        channel: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      links.map(async (link) => {
        const clickWhere: Prisma.ClickEventWhereInput = { trackingLinkId: link.id };
        if (range) clickWhere.clickedAt = range;

        const subscribedWhere: Prisma.AttributionWhereInput = {
          trackingLinkId: link.id,
          membershipEvent: {
            eventType: MembershipEventType.SUBSCRIBE,
            ...(range ? { occurredAt: range } : {}),
          },
        };

        const unsubscribedWhere: Prisma.UnsubscribeEventWhereInput = {
          channelId: link.channelId,
          subscriberProfile: {
            membershipEvent: { attribution: { trackingLinkId: link.id } },
          },
        };
        if (range) unsubscribedWhere.occurredAt = range;

        const [clicks, reached, subscribers, unsubscribes, uniqueClickers] = await Promise.all([
          this.prisma.clickEvent.count({ where: clickWhere }),
          this.prisma.clickEvent.count({ where: { ...clickWhere, telegramOpenedAt: { not: null } } }),
          this.prisma.attribution.count({ where: subscribedWhere }),
          this.prisma.unsubscribeEvent.count({ where: unsubscribedWhere }),
          this.countUniqueClickers(undefined, link.id, range),
        ]);

        return {
          id: link.id,
          slug: link.slug,
          name: link.name,
          campaignName: link.campaign?.name ?? null,
          channelTitle: link.channel.title,
          clicks,
          reached,
          reachRate: this.safeDivide(reached, clicks),
          uniqueClickers,
          subscribers,
          unsubscribes,
          conversionRate: this.safeDivide(subscribers, clicks),
          autoRedirect: link.autoRedirect,
        };
      }),
    );
  }

  async getSubscriberFeed(
    workspaceId: string,
    opts: {
      limit?: number;
      channelId?: string;
      status?: 'active' | 'left';
      search?: string;
      attributionType?: AttributionType;
      from?: string;
      to?: string;
    } = {},
  ) {
    const { limit = 100, channelId, status, search, attributionType, from, to } = opts;
    const range = kyivDateRange(from, to);

    const where: Prisma.SubscriberProfileWhereInput = { workspaceId };
    if (channelId) where.channelId = channelId;
    if (range) where.subscribedAt = range;
    // "Активний" профіль — той, що ще не має пов'язаної UnsubscribeEvent (див. коментар у schema.prisma).
    if (status === 'active') where.unsubscribeEvents = { none: {} };
    if (status === 'left') where.unsubscribeEvents = { some: {} };
    if (attributionType) where.membershipEvent = { attribution: { attributionType } };
    if (search) {
      where.OR = [
        { telegramUserId: { contains: search } },
        { membershipEvent: { telegramUsername: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const profiles = await this.prisma.subscriberProfile.findMany({
      where,
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

      // ORGANIC — приєднався через звичайне посилання на канал (t.me/назва),
      // ми знаємо тільки факт вступу, звідки саме — ні (Тип 1 з ТЗ).
      // UNKNOWN — теж «джерело невідоме», але з іншої причини: були кліки
      // по рекламі за вікном атрибуції, які не вдалось впевнено зіставити.
      // Розрізняємо обидва в UI, щоб не ховати другий випадок під тим самим
      // нейтральним лейблом, що й звичайний прямий вступ.
      let joinSource = 'Джерело невідоме';
      if (hasAdSource) {
        const parts = [attr.campaign?.name, attr.trackingLink?.slug ? `/${attr.trackingLink.slug}` : null].filter(Boolean);
        joinSource = `Реклама: ${parts.join(' ')}`;
      } else if (attr?.attributionType === 'ORGANIC') {
        joinSource = 'Telegram (напряму, без нашого посилання)';
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

  async getUnsubscribeFeed(
    workspaceId: string,
    opts: { limit?: number; channelId?: string; search?: string; from?: string; to?: string } = {},
  ) {
    const { limit = 100, channelId, search, from, to } = opts;
    const range = kyivDateRange(from, to);

    // Фільтруємо тільки по полях, що завжди лежать прямо на UnsubscribeEvent
    // (channelId, telegramUserId/Username, occurredAt) — attributionType навмисно НЕ
    // фільтруємо тут на рівні БД: він береться або з e.subscriberProfile, або з
    // fallback-профілю, знайденого нижче в JS уже після вибірки (коли
    // subscriberProfileId порожній), тож DB-фільтр по вкладеній attribution
    // пропустив би саме ці fallback-випадки.
    const where: Prisma.UnsubscribeEventWhereInput = { workspaceId };
    if (channelId) where.channelId = channelId;
    if (range) where.occurredAt = range;
    if (search) {
      where.OR = [
        { telegramUserId: { contains: search } },
        { telegramUsername: { contains: search, mode: 'insensitive' } },
      ];
    }

    const events = await this.prisma.unsubscribeEvent.findMany({
      where,
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
            // asc: у Map з однаковим ключем останній запис перемагає — лишаємо найновіший профіль
            orderBy: { subscribedAt: 'asc' },
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
    const rows = await this.getSubscriberFeed(workspaceId, { limit: 5000 });
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
    const anchor = date ? new Date(date) : new Date();
    // Межі доби рахуємо за київським часом, а не за TZ процесу (зазвичай UTC на
    // сервері) — інакше події біля півночі потрапляють не в той день.
    const day = kyivDayStart(anchor, 0);
    const next = kyivDayStart(anchor, -1);

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
      // day/next — UTC-інстанти півночі за Києвом; для лейбла дати беремо
      // календарний день анкора САМЕ за київським часом, а не UTC-зріз
      // цього інстанту (він через зсув може показати попередню дату).
      date: anchor.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' }),
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

  /**
   * Блок 1.2 ТЗ: переходи в бота клієнта. Клік (ClickEvent) записується завжди
   * при переході за посиланням; сюди потрапляють лише ті, хто дійшов до /start —
   * різниця між рядками тут і кліками по відповідній посиланню й показує
   * "скільки дійшло / скільки натиснуло Старт" (п.10).
   */
  async getBotStartFeed(
    workspaceId: string,
    opts: { limit?: number; botConnectionId?: string; status?: 'ACTIVE' | 'BLOCKED'; search?: string } = {},
  ) {
    const { limit = 100, botConnectionId, status, search } = opts;

    const where: Prisma.BotStartEventWhereInput = { workspaceId };
    if (botConnectionId) where.botConnectionId = botConnectionId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { telegramUserId: { contains: search } },
        { telegramUsername: { contains: search, mode: 'insensitive' } },
        { clickEvent: { utmCampaign: { contains: search, mode: 'insensitive' } } },
        { clickEvent: { trackingLink: { slug: { contains: search, mode: 'insensitive' } } } },
        { clickEvent: { trackingLink: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [events, totalClicks, totalStarts, blockedStarts] = await Promise.all([
      this.prisma.botStartEvent.findMany({
        where,
        include: {
          botConnection: { select: { botUsername: true } },
          clickEvent: {
            select: {
              utmSource: true,
              utmMedium: true,
              utmCampaign: true,
              utmContent: true,
              trackingLink: { select: { slug: true, name: true, creativeTag: true } },
            },
          },
        },
        orderBy: { occurredAt: 'desc' },
        take: limit,
      }),
      // Кліки по посиланнях, що ведуть у бота клієнта — "дійшли до Telegram",
      // ще до того, як людина натиснула «Старт» (або не натиснула).
      this.prisma.clickEvent.count({
        where: { workspaceId, trackingLink: { destinationMode: 'CLIENT_BOT_START' } },
      }),
      this.prisma.botStartEvent.count({ where: { workspaceId } }),
      this.prisma.botStartEvent.count({ where: { workspaceId, status: 'BLOCKED' } }),
    ]);

    return {
      summary: {
        totalClicks,
        totalStarts,
        blockedStarts,
        // Скільки з тих, хто дійшов до бота, реально натиснули «Старт».
        startRate: totalClicks > 0 ? totalStarts / totalClicks : null,
      },
      rows: events.map((e) => ({
        id: e.id,
        telegramUserId: e.telegramUserId,
        telegramUsername: e.telegramUsername,
        botUsername: e.botConnection.botUsername,
        status: e.status,
        occurredAt: e.occurredAt,
        trackingLinkSlug: e.clickEvent?.trackingLink.slug ?? null,
        trackingLinkName: e.clickEvent?.trackingLink.name ?? null,
        utmSource: e.clickEvent?.utmSource ?? null,
        utmMedium: e.clickEvent?.utmMedium ?? null,
        utmCampaign: e.clickEvent?.utmCampaign ?? null,
        utmContent: e.clickEvent?.utmContent ?? null,
        creativeTag: e.clickEvent?.trackingLink.creativeTag ?? null,
      })),
    };
  }
}
