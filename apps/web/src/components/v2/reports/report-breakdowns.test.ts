import { describe, expect, it } from 'vitest';
import type { TrackingLinkReportRow, UnsubscribeFeedRow } from '@/lib/api';
import {
  buildCreativeBreakdown,
  buildLandingPostBreakdown,
  buildUnsubscribeTimingFromFeed,
} from './report-breakdowns';

function link(overrides: Partial<TrackingLinkReportRow> = {}): TrackingLinkReportRow {
  return {
    id: 'link-1', slug: 'one', name: 'One', campaignName: 'Launch', channelTitle: 'Channel',
    clicks: 10, reached: 7, reachRate: 0.7, uniqueClickers: 8, subscribers: 3,
    unsubscribes: 1, conversionRate: 0.3, autoRedirect: true, utmSource: 'meta',
    utmMedium: 'cpc', utmCampaign: 'launch', utmContent: 'video-a', utmTerm: null,
    creativeTag: 'blue-hook', postNumber: null, landingPostUrl: 'https://t.me/channel/42',
    ...overrides,
  };
}

describe('report breakdowns', () => {
  it('об’єднує однаковий креатив у межах джерела й кампанії', () => {
    const rows = buildCreativeBreakdown([
      link(),
      link({ id: 'link-2', clicks: 5, reached: 4, subscribers: 2, unsubscribes: 0 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      label: 'blue-hook', clicks: 15, reached: 11, subscribers: 5, unsubscribes: 1,
    });
  });

  it('не вигадує посадковий пост для посилань без postNumber/landingPostUrl', () => {
    const rows = buildLandingPostBreakdown([
      link(),
      link({ id: 'link-2', landingPostUrl: null, postNumber: null }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe('https://t.me/channel/42');
  });

  it('рахує fallback-інтервали відписки для старої версії API', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const feed = [0.5, 3, 14, 40].map((days, index) => ({
      id: String(index),
      occurredAt: new Date(start.getTime() + days * 86_400_000).toISOString(),
      subscribedAt: start.toISOString(),
    })) as UnsubscribeFeedRow[];
    feed.push({ id: 'unknown', occurredAt: start.toISOString(), subscribedAt: null } as UnsubscribeFeedRow);

    const result = buildUnsubscribeTimingFromFeed(feed);
    expect(result.total).toBe(5);
    expect(result.unknown).toBe(1);
    expect(Object.values(result.buckets).map((bucket) => bucket.count)).toEqual([1, 1, 1, 1]);
  });
});
