import { describe, expect, it } from 'vitest';
import {
  aggregateClaimsBySource,
  claimCallbackData,
  claimSourceLabel,
  giftBotLink,
  giftDeliveryText,
  giftIntroText,
  parseClaimCallback,
} from './lead-magnet-content';

describe('claim callback', () => {
  it('round-trips the slug and stays within Telegram 64-byte limit', () => {
    const data = claimCallbackData('abc123XYZ0');
    expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
    expect(parseClaimCallback(data)).toBe('abc123XYZ0');
  });

  it('rejects foreign or malformed callbacks', () => {
    expect(parseClaimCallback('menu:channels')).toBeNull();
    expect(parseClaimCallback('lm_claim:')).toBeNull();
    expect(parseClaimCallback('lm_claim:bad slug!')).toBeNull();
    expect(parseClaimCallback(undefined)).toBeNull();
  });
});

describe('gift texts', () => {
  const gift = { name: 'Чекліст', consentText: 'Отримуючи матеріал, ви погоджуєтесь на повідомлення від бота.' };

  it('builds the bot deep link', () => {
    expect(giftBotLink('cleartg_bot', 'abc')).toBe('https://t.me/cleartg_bot?start=lm_abc');
  });

  it('intro mentions the gift and the claim button', () => {
    const text = giftIntroText(gift);
    expect(text).toContain('Чекліст');
    expect(text).toContain('«Отримати»');
  });

  it('delivers text and link together', () => {
    const text = giftDeliveryText({ ...gift, contentText: 'Промокод: TG10', contentUrl: 'https://example.com/a.pdf' });
    expect(text).toContain('Промокод: TG10');
    expect(text).toContain('https://example.com/a.pdf');
  });

  it('never sends an empty delivery', () => {
    expect(giftDeliveryText(gift)).toContain('Матеріал ще не додано');
  });

  it('marks a repeated claim', () => {
    expect(giftDeliveryText({ ...gift, contentUrl: 'https://x.y' }, true)).toContain('вже отримали');
  });
});

describe('claimSourceLabel', () => {
  it('prefers link, then campaign, then attribution type', () => {
    expect(claimSourceLabel({ hasProfile: true, trackingLinkName: 'FB відео', campaignName: 'Літо' })).toBe('FB відео');
    expect(claimSourceLabel({ hasProfile: true, campaignName: 'Літо' })).toBe('Літо');
    expect(claimSourceLabel({ hasProfile: true, attributionType: 'ORGANIC' })).toBe('Органіка');
    expect(claimSourceLabel({ hasProfile: true, attributionType: 'UNKNOWN' })).toBe('Джерело не визначене');
    expect(claimSourceLabel({ hasProfile: false })).toBe('Підписались до підключення бота');
  });
});

describe('aggregateClaimsBySource', () => {
  it('counts subscribers, claims and caps the rate at 100%', () => {
    const rows = aggregateClaimsBySource(['FB', 'FB', 'FB', 'Органіка'], ['FB', 'Органіка', 'Органіка', 'Старі']);
    const fb = rows.find((r) => r.source === 'FB')!;
    expect(fb).toMatchObject({ subscribers: 3, claims: 1 });
    expect(fb.claimRate).toBeCloseTo(1 / 3);
    expect(rows.find((r) => r.source === 'Органіка')!.claimRate).toBe(1);
    expect(rows.find((r) => r.source === 'Старі')!.claimRate).toBeNull();
  });

  it('sorts by claims first', () => {
    const rows = aggregateClaimsBySource(['A', 'A'], ['B', 'B', 'A']);
    expect(rows.map((r) => r.source)).toEqual(['B', 'A']);
  });
});
