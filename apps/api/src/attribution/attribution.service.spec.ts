import { describe, it, expect, vi } from 'vitest';
import { AttributionService } from './attribution.service';

/**
 * Юніт-тести на AttributionService.getAttributionStats — тільки нова
 * частина (channelId/from/to), додана разом із фільтрами `/v2/reports`
 * (v2-reports-backend-review.md). attributeMembership() тут не чіпаємо:
 * сама логіка зіставлення вже покрита packages/shared/attribution.test.ts,
 * а тут вона не змінювалась.
 */

type MockCall = { where?: Record<string, unknown> };

function buildService(groupByResult: unknown[] = []) {
  const groupBy = vi.fn().mockResolvedValue(groupByResult);
  const prisma = { attribution: { groupBy } };
  const audit = { log: vi.fn() };
  const service = new AttributionService(prisma as never, audit as never);
  return { service, groupBy };
}

describe('AttributionService.getAttributionStats', () => {
  it('без опцій — where містить лише workspaceId, як було раніше', async () => {
    const { service, groupBy } = buildService();

    await service.getAttributionStats('ws_1');

    expect(groupBy.mock.calls[0][0].where).toEqual({ workspaceId: 'ws_1' });
  });

  it('channelId — додається у where, коли заданий', async () => {
    const { service, groupBy } = buildService();

    await service.getAttributionStats('ws_1', { channelId: 'ch_1' });

    expect(groupBy.mock.calls[0][0].where).toMatchObject({ workspaceId: 'ws_1', channelId: 'ch_1' });
  });

  it('from/to — фільтрує по membershipEvent.occurredAt, не по Attribution.createdAt', async () => {
    const { service, groupBy } = buildService();

    await service.getAttributionStats('ws_1', { from: '2026-07-24', to: '2026-07-24' });

    const where = groupBy.mock.calls[0][0].where as MockCall['where'];
    const membershipEvent = where?.membershipEvent as { occurredAt?: { gte?: Date; lt?: Date } };
    expect(membershipEvent.occurredAt?.gte).toBeInstanceOf(Date);
    expect(membershipEvent.occurredAt?.lt).toBeInstanceOf(Date);
    // Тільки поле "коли сталася сама підписка" — жодного посилання на createdAt.
    expect(where).not.toHaveProperty('createdAt');
  });

  it('share і avgConfidence рахуються так само, як і до фільтрів', async () => {
    const { service } = buildService([
      { attributionType: 'ORGANIC', _count: 3, _avg: { confidenceScore: 0.5 } },
      { attributionType: 'UNKNOWN', _count: 1, _avg: { confidenceScore: 0.1 } },
    ]);

    const stats = await service.getAttributionStats('ws_1');

    expect(stats.find((s) => s.type === 'ORGANIC')?.share).toBeCloseTo(0.75);
    expect(stats.find((s) => s.type === 'UNKNOWN')?.share).toBeCloseTo(0.25);
  });
});

describe('AttributionService.attributeMembership', () => {
  it('не втрачає точний invite-клік, навіть якщо його немає серед 50 останніх', async () => {
    const subscribedAt = new Date('2026-10-30T10:00:00.000Z');
    const exactClick = {
      id: 'click_exact',
      campaignId: 'camp_1',
      trackingLinkId: 'link_1',
      clickedAt: new Date('2026-10-30T09:00:00.000Z'),
    };
    const prisma = {
      membershipEvent: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'membership_1',
          workspaceId: 'ws_1',
          channelId: 'ch_1',
          eventType: 'SUBSCRIBE',
          occurredAt: subscribedAt,
          channel: { id: 'ch_1' },
        }),
      },
      inviteLink: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'invite_1',
          clickEventId: exactClick.id,
          campaignId: 'camp_1',
          trackingLinkId: 'link_1',
          createdAt: new Date('2026-10-30T09:00:00.000Z'),
        }),
      },
      campaign: {
        findUnique: vi.fn().mockResolvedValue({ attributionWindowMinutes: 10080 }),
        findFirst: vi.fn(),
      },
      clickEvent: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 50 }, (_, index) => ({
            id: `newer_${index}`,
            campaignId: 'camp_2',
            trackingLinkId: 'link_2',
            clickedAt: new Date(subscribedAt.getTime() - index * 1000),
          })),
        ),
        findUnique: vi.fn().mockResolvedValue(exactClick),
      },
      attribution: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'attr_1', ...data })),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new AttributionService(prisma as never, audit as never);

    const result = await service.attributeMembership('membership_1', 'invite_1');

    expect(result?.attributionType).toBe('EXACT_CLICK_INVITE');
    expect(result?.clickEventId).toBe('click_exact');
    expect(prisma.clickEvent.findUnique).toHaveBeenCalledWith({ where: { id: 'click_exact' } });
  });
});
