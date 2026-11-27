import { describe, expect, it } from 'vitest';
import {
  extractApiKey,
  generateApiKey,
  hashApiKey,
  isStillSubscribed,
  parseLookupQuery,
  toSubscriptionDto,
  type SubscriptionRow,
} from './public-api';

describe('api keys', () => {
  it('generates distinct prefixed keys and hashes them stably', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a).toMatch(/^ctg_[A-Za-z0-9_-]{32}$/);
    expect(a).not.toBe(b);
    expect(hashApiKey(a)).toBe(hashApiKey(a));
    expect(hashApiKey(a)).toHaveLength(64);
    expect(hashApiKey(a)).not.toContain(a);
  });

  it('reads the key from Bearer or X-Api-Key', () => {
    expect(extractApiKey({ authorization: 'Bearer ctg_abc' })).toBe('ctg_abc');
    expect(extractApiKey({ authorization: 'bearer  ctg_abc ' })).toBe('ctg_abc');
    expect(extractApiKey({ 'x-api-key': 'ctg_xyz' })).toBe('ctg_xyz');
  });

  it('ignores session tokens and junk', () => {
    expect(extractApiKey({ authorization: 'Bearer eyJhbGciOi' })).toBeNull();
    expect(extractApiKey({})).toBeNull();
    expect(extractApiKey({ 'x-api-key': `ctg_${'a'.repeat(200)}` })).toBeNull();
  });
});

describe('parseLookupQuery', () => {
  it('prefers telegram_user_id', () => {
    expect(parseLookupQuery({ telegram_user_id: ' 123 ', username: 'x' })).toEqual({ telegramUserId: '123' });
  });

  it('accepts a username with or without @', () => {
    expect(parseLookupQuery({ username: '@Shapoval_one' })).toEqual({ username: 'Shapoval_one' });
  });

  it('rejects bad or missing input', () => {
    expect(parseLookupQuery({ telegram_user_id: '12a' })).toHaveProperty('error');
    expect(parseLookupQuery({ username: 'a b' })).toHaveProperty('error');
    expect(parseLookupQuery({})).toHaveProperty('error');
  });
});

describe('toSubscriptionDto', () => {
  const channel = { id: 'ch1', title: 'Канал', username: 'shapoval_one' };
  const link = {
    id: 'tl1', name: 'Instagram сторіс',
    utmSource: 'instagram', utmMedium: null, utmCampaign: 'black_friday', utmContent: null, utmTerm: null,
  };
  const row = (attribution: SubscriptionRow['attribution']): SubscriptionRow => ({
    occurredAt: new Date('2026-11-20T10:00:00Z'), channel, attribution,
  });

  it('returns the exact tracking link with its campaign and utm', () => {
    const dto = toSubscriptionDto(
      row({ attributionType: 'EXACT_CLICK_INVITE', trackingLink: link, campaign: { id: 'c1', name: 'BF' } }),
      true,
    );
    expect(dto.subscribed_at).toBe('2026-11-20T10:00:00.000Z');
    expect(dto.still_subscribed).toBe(true);
    expect(dto.source).toEqual({
      type: 'tracking_link',
      confidence: 'exact',
      tracking_link: { id: 'tl1', name: 'Instagram сторіс' },
      campaign: { id: 'c1', name: 'BF' },
      utm: { source: 'instagram', campaign: 'black_friday' },
    });
  });

  it('marks probabilistic matches as probable', () => {
    const dto = toSubscriptionDto(row({ attributionType: 'PROBABILISTIC', trackingLink: link, campaign: null }), true);
    expect(dto.source.confidence).toBe('probable');
  });

  it('reports a campaign-only source', () => {
    const dto = toSubscriptionDto(row({ attributionType: 'CAMPAIGN_INVITE', trackingLink: null, campaign: { id: 'c1', name: 'BF' } }), false);
    expect(dto.source.type).toBe('campaign');
    expect(dto.source.utm).toBeNull();
  });

  it('reports organic without inventing a link', () => {
    const dto = toSubscriptionDto(row({ attributionType: 'ORGANIC', trackingLink: null, campaign: null }), true);
    expect(dto.source).toMatchObject({ type: 'organic', confidence: null, tracking_link: null });
  });

  it('says unknown when there is no attribution or it is UNKNOWN', () => {
    for (const a of [null, { attributionType: 'UNKNOWN' as const, trackingLink: link, campaign: null }]) {
      expect(toSubscriptionDto(row(a), true).source).toEqual({
        type: 'unknown', confidence: null, tracking_link: null, campaign: null, utm: null,
      });
    }
  });
});

describe('isStillSubscribed', () => {
  const at = new Date('2026-11-20T10:00:00Z');
  it('is true without a later unsubscribe', () => {
    expect(isStillSubscribed(at, [])).toBe(true);
    expect(isStillSubscribed(at, [new Date('2026-11-01T00:00:00Z')])).toBe(true);
  });
  it('is false after a later unsubscribe', () => {
    expect(isStillSubscribed(at, [new Date('2026-11-21T00:00:00Z')])).toBe(false);
  });
});
