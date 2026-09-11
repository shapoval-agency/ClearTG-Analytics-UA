import { describe, it, expect, vi } from 'vitest';
import { DashboardService } from './dashboard.service';

/**
 * Юніт-тести на DashboardService — без бази, Prisma підмінена фейками
 * (той самий підхід, що вже є в tracking.service.spec.ts). Мета — закріпити
 * як регрес два факти з v2-reports-backend-review.md:
 *
 *  1. getCampaignReports() рахує відписки по campaignId через ланцюжок
 *     атрибуції, а не по всьому каналу (баг, знайдений 2026-09-11).
 *  2. from/to/channelId — адитивні: без них Prisma-where виглядає так само,
 *     як до цієї задачі.
 *
 * Живу перевірку тих самих сценаріїв проти реального Postgres дивись
 * у apps/api/scripts/qa/smoke-reports.ts (pnpm --filter @cleartg/api qa:smoke-reports) —
 * мокові тести тут швидкі й ганяються в CI, живий скрипт доводить, що те
 * саме працює і на реальних Prisma-джойнах, не тільки на фейках.
 */

type MockCall = { where?: Record<string, unknown> };

function buildCampaignReportsPrisma(
  campaigns: Array<Record<string, unknown>>,
  opts: {
    unsubscribesByCampaignId?: Record<string, number>;
    clicksByCampaignId?: Record<string, number>;
    reachedByCampaignId?: Record<string, number>;
  } = {},
) {
  const { unsubscribesByCampaignId = {}, clicksByCampaignId = {}, reachedByCampaignId = {} } = opts;

  const campaignFindMany = vi.fn().mockResolvedValue(campaigns);
  const clickCount = vi.fn(async (args: MockCall) => {
    const campaignId = args?.where?.campaignId as string | undefined;
    const isReach = args?.where && 'telegramOpenedAt' in args.where;
    if (isReach) return campaignId ? (reachedByCampaignId[campaignId] ?? 0) : 0;
    return campaignId ? (clicksByCampaignId[campaignId] ?? 0) : 0;
  });
  const attributionCount = vi.fn().mockResolvedValue(0);
  const unsubscribeCount = vi.fn(async (args: MockCall) => {
    const subscriberProfile = args?.where?.subscriberProfile as
      | { membershipEvent?: { attribution?: { campaignId?: string } } }
      | undefined;
    const campaignId = subscriberProfile?.membershipEvent?.attribution?.campaignId;
    return campaignId ? (unsubscribesByCampaignId[campaignId] ?? 0) : 0;
  });
  const groupBy = vi.fn().mockResolvedValue([]);

  const prisma = {
    campaign: { findMany: campaignFindMany },
    clickEvent: { count: clickCount, groupBy },
    attribution: { count: attributionCount },
    unsubscribeEvent: { count: unsubscribeCount },
  };
  return { prisma, campaignFindMany, clickCount, unsubscribeCount };
}

function fakeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'camp_1',
    name: 'Campaign 1',
    adPlatform: 'META',
    channelId: 'ch_1',
    channel: { title: 'Channel 1' },
    spendAmount: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('DashboardService.getCampaignReports', () => {
  it('НЕ змішує відписки різних кампаній одного каналу (регрес на баг dashboard.service.ts:125-127)', async () => {
    const campaignA = fakeCampaign({ id: 'camp_a' });
    const campaignB = fakeCampaign({ id: 'camp_b' });
    const { prisma } = buildCampaignReportsPrisma([campaignA, campaignB], {
      unsubscribesByCampaignId: { camp_a: 3 }, // camp_b свідомо відсутній у мапі → фейк поверне 0
    });
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    const rows = await service.getCampaignReports('ws_1');

    expect(rows.find((r) => r.id === 'camp_a')?.unsubscribes).toBe(3);
    expect(rows.find((r) => r.id === 'camp_b')?.unsubscribes).toBe(0);
  });

  it('фільтр відписок іде через subscriberProfile.membershipEvent.attribution.campaignId, а не через голий channelId', async () => {
    const campaign = fakeCampaign();
    const { prisma, unsubscribeCount } = buildCampaignReportsPrisma([campaign]);
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    await service.getCampaignReports('ws_1');

    const where = unsubscribeCount.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.channelId).toBe('ch_1');
    expect(where.subscriberProfile).toEqual({
      membershipEvent: { attribution: { campaignId: 'camp_1' } },
    });
  });

  it('без опцій — where без channelId і без clickedAt, поведінка як була до фільтрів', async () => {
    const { prisma, campaignFindMany, clickCount } = buildCampaignReportsPrisma([fakeCampaign()]);
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    await service.getCampaignReports('ws_1');

    expect(campaignFindMany.mock.calls[0][0].where.channelId).toBeUndefined();
    expect((clickCount.mock.calls[0][0].where as Record<string, unknown>).clickedAt).toBeUndefined();
  });

  it('channelId — фільтрує список кампаній, коли заданий', async () => {
    const { prisma, campaignFindMany } = buildCampaignReportsPrisma([]);
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    await service.getCampaignReports('ws_1', { channelId: 'ch_42' });

    expect(campaignFindMany.mock.calls[0][0].where.channelId).toBe('ch_42');
  });

  it('from/to — додає clickedAt-діапазон до фільтра кліків', async () => {
    const { prisma, clickCount } = buildCampaignReportsPrisma([fakeCampaign()]);
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    await service.getCampaignReports('ws_1', { from: '2026-07-24', to: '2026-07-24' });

    const where = clickCount.mock.calls[0][0].where as Record<string, { gte?: Date; lt?: Date }>;
    expect(where.clickedAt?.gte).toBeInstanceOf(Date);
    expect(where.clickedAt?.lt).toBeInstanceOf(Date);
  });

  it('рахує reached окремо від clicks і виводить reachRate', async () => {
    const { prisma } = buildCampaignReportsPrisma([fakeCampaign()], {
      clicksByCampaignId: { camp_1: 4 },
      reachedByCampaignId: { camp_1: 3 },
    });
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    const [row] = await service.getCampaignReports('ws_1');

    expect(row.clicks).toBe(4);
    expect(row.reached).toBe(3);
    expect(row.reachRate).toBeCloseTo(0.75);
  });

  it('reachRate і conversionRate дорівнюють 0 (не NaN/Infinity), коли кліків немає', async () => {
    const { prisma } = buildCampaignReportsPrisma([fakeCampaign()]);
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    const [row] = await service.getCampaignReports('ws_1');

    expect(row.clicks).toBe(0);
    expect(row.reachRate).toBe(0);
    expect(row.conversionRate).toBe(0);
  });
});

describe('DashboardService.getTrackingLinkReports', () => {
  function buildPrisma(
    links: Array<Record<string, unknown>>,
    opts: { clicksById?: Record<string, number>; reachedById?: Record<string, number> } = {},
  ) {
    const { clicksById = {}, reachedById = {} } = opts;
    const trackingLinkFindMany = vi.fn().mockResolvedValue(links);
    const clickCount = vi.fn(async (args: MockCall) => {
      const id = args?.where?.trackingLinkId as string | undefined;
      const isReach = args?.where && 'telegramOpenedAt' in args.where;
      if (isReach) return id ? (reachedById[id] ?? 0) : 0;
      return id ? (clicksById[id] ?? 0) : 0;
    });
    const prisma = {
      trackingLink: { findMany: trackingLinkFindMany },
      clickEvent: { count: clickCount, groupBy: vi.fn().mockResolvedValue([]) },
      attribution: { count: vi.fn().mockResolvedValue(0) },
      unsubscribeEvent: { count: vi.fn().mockResolvedValue(0) },
    };
    return { prisma, trackingLinkFindMany, clickCount };
  }

  function fakeLink(overrides: Record<string, unknown> = {}) {
    return {
      id: 'link_1',
      slug: 's1',
      name: 'Link 1',
      channelId: 'ch_1',
      channel: { title: 'Channel 1' },
      campaign: null,
      autoRedirect: true,
      ...overrides,
    };
  }

  it('channelId — фільтрує посилання по каналу, коли заданий; без нього — не звужує where', async () => {
    const { prisma, trackingLinkFindMany } = buildPrisma([]);
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    await service.getTrackingLinkReports('ws_1');
    expect(trackingLinkFindMany.mock.calls[0][0].where.channelId).toBeUndefined();

    await service.getTrackingLinkReports('ws_1', { channelId: 'ch_1' });
    expect(trackingLinkFindMany.mock.calls[1][0].where.channelId).toBe('ch_1');
  });

  it('рахує reach окремо від clicks (той самий розрахунок, що й у getCampaignReports)', async () => {
    const { prisma } = buildPrisma([fakeLink()], { clicksById: { link_1: 5 }, reachedById: { link_1: 2 } });
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    const [row] = await service.getTrackingLinkReports('ws_1');

    expect(row.clicks).toBe(5);
    expect(row.reached).toBe(2);
    expect(row.reachRate).toBeCloseTo(0.4);
  });
});

describe('DashboardService.getSubscriberFeed — фільтр періоду', () => {
  it('from/to — додає subscribedAt-діапазон', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { subscriberProfile: { findMany } };
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    await service.getSubscriberFeed('ws_1', { from: '2026-07-24', to: '2026-07-24' });

    const where = findMany.mock.calls[0][0].where;
    expect(where.subscribedAt.gte).toBeInstanceOf(Date);
    expect(where.subscribedAt.lt).toBeInstanceOf(Date);
  });

  it('без from/to — subscribedAt відсутній у where, як було раніше', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { subscriberProfile: { findMany } };
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    await service.getSubscriberFeed('ws_1', { limit: 10 });

    expect(findMany.mock.calls[0][0].where.subscribedAt).toBeUndefined();
  });
});

describe('DashboardService.getUnsubscribeFeed — фільтр періоду', () => {
  it('from/to — додає occurredAt-діапазон', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      unsubscribeEvent: { findMany },
      subscriberProfile: { findMany: vi.fn().mockResolvedValue([]) },
      membershipEvent: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new DashboardService(prisma as never, {} as never, {} as never);

    await service.getUnsubscribeFeed('ws_1', { from: '2026-07-24', to: '2026-07-25' });

    const where = findMany.mock.calls[0][0].where;
    expect(where.occurredAt.gte).toBeInstanceOf(Date);
    expect(where.occurredAt.lt).toBeInstanceOf(Date);
  });
});

describe('DashboardService.getOverview', () => {
  function buildPrisma(
    opts: { clicks?: number; reached?: number; subscribers?: number; unsubscribes?: number; activeSubscribers?: number } = {},
  ) {
    const { clicks = 0, reached = 0, subscribers = 0, unsubscribes = 0, activeSubscribers = 0 } = opts;
    const clickCount = vi.fn(async (args: MockCall) =>
      args?.where && 'telegramOpenedAt' in args.where ? reached : clicks,
    );
    return {
      clickEvent: { count: clickCount },
      membershipEvent: { count: vi.fn().mockResolvedValue(subscribers) },
      unsubscribeEvent: { count: vi.fn().mockResolvedValue(unsubscribes) },
      subscriberProfile: { count: vi.fn().mockResolvedValue(activeSubscribers), findMany: vi.fn().mockResolvedValue([]) },
    };
  }

  it('передає channelId/from/to у getAttributionStats — інакше dataIntegrity порівнював би відфільтровані підписки з нефільтрованою атрибуцією', async () => {
    const prisma = buildPrisma({ clicks: 10, reached: 6, subscribers: 5 });
    const getAttributionStats = vi.fn().mockResolvedValue([{ type: 'ORGANIC', count: 5 }]);
    const attribution = { getAttributionStats };
    const conversion = { getDeliveryStats: vi.fn().mockResolvedValue([]) };
    const service = new DashboardService(prisma as never, attribution as never, conversion as never);

    await service.getOverview('ws_1', { channelId: 'ch_1', from: '2026-07-24', to: '2026-07-24' });

    expect(getAttributionStats).toHaveBeenCalledWith('ws_1', {
      channelId: 'ch_1',
      from: '2026-07-24',
      to: '2026-07-24',
    });
  });

  it('reached/reachRate у відповіді, dataIntegrity сходиться, коли атрибуція покриває всі підписки', async () => {
    const prisma = buildPrisma({ clicks: 10, reached: 6, subscribers: 5 });
    const attribution = { getAttributionStats: vi.fn().mockResolvedValue([{ type: 'ORGANIC', count: 5 }]) };
    const conversion = { getDeliveryStats: vi.fn().mockResolvedValue([]) };
    const service = new DashboardService(prisma as never, attribution as never, conversion as never);

    const overview = await service.getOverview('ws_1');

    expect(overview.clicks).toBe(10);
    expect(overview.reached).toBe(6);
    expect(overview.reachRate).toBeCloseTo(0.6);
    expect(overview.dataIntegrity).toEqual({ subscribers: 5, attributed: 5, missing: 0, ok: true });
  });

  it('старий виклик з одним аргументом (без opts) досі працює — адитивність', async () => {
    const prisma = buildPrisma({ clicks: 1, subscribers: 1 });
    const attribution = { getAttributionStats: vi.fn().mockResolvedValue([]) };
    const conversion = { getDeliveryStats: vi.fn().mockResolvedValue([]) };
    const service = new DashboardService(prisma as never, attribution as never, conversion as never);

    await expect(service.getOverview('ws_1')).resolves.toMatchObject({ clicks: 1, subscribers: 1 });
  });
});
