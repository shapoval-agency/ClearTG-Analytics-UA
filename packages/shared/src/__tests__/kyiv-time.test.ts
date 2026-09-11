import { describe, it, expect } from 'vitest';
import { kyivDayStart, kyivOffsetMs, kyivDateRange } from '../kyiv-time';

describe('kyivOffsetMs', () => {
  it('is +2h (7_200_000ms) in winter (EET, no DST)', () => {
    const winter = new Date('2026-01-15T12:00:00Z');
    expect(kyivOffsetMs(winter)).toBe(2 * 60 * 60 * 1000);
  });

  it('is +3h (10_800_000ms) in summer (EEST, DST)', () => {
    const summer = new Date('2026-07-15T12:00:00Z');
    expect(kyivOffsetMs(summer)).toBe(3 * 60 * 60 * 1000);
  });
});

describe('kyivDayStart', () => {
  it('returns 00:00 Kyiv time, expressed as the correct UTC instant (summer, +3h)', () => {
    // 2026-07-24 10:00 UTC = 2026-07-24 13:00 Kyiv time (same civil day)
    const now = new Date('2026-07-24T10:00:00Z');
    const start = kyivDayStart(now, 0);
    // Midnight Kyiv on 2026-07-24 = 2026-07-23T21:00:00Z (UTC-3h)
    expect(start.toISOString()).toBe('2026-07-23T21:00:00.000Z');
  });

  it('correctly shifts events just after Kyiv midnight into "today", not "yesterday"', () => {
    // 2026-07-24T21:30:00Z = 2026-07-25T00:30 Kyiv time - already the NEXT Kyiv day.
    // A server running in UTC with plain setHours(0,0,0,0) would still call this
    // "2026-07-24" and wrongly bucket it into that day's report.
    const eventTime = new Date('2026-07-24T21:30:00Z');
    const todayStart = kyivDayStart(eventTime, 0);
    expect(eventTime.getTime()).toBeGreaterThanOrEqual(todayStart.getTime());
    // The Kyiv day start for this instant should be 2026-07-24T21:00:00Z
    // (00:00 on 2026-07-25 Kyiv time), not 2026-07-23T21:00:00Z.
    expect(todayStart.toISOString()).toBe('2026-07-24T21:00:00.000Z');
  });

  it('daysAgo=1 moves back exactly one Kyiv civil day', () => {
    const now = new Date('2026-07-24T10:00:00Z');
    const yesterdayStart = kyivDayStart(now, 1);
    expect(yesterdayStart.toISOString()).toBe('2026-07-22T21:00:00.000Z');
  });

  it('handles the winter offset (+2h) correctly too', () => {
    const now = new Date('2026-01-15T10:00:00Z');
    const start = kyivDayStart(now, 0);
    expect(start.toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });
});

describe('kyivDateRange', () => {
  it('returns undefined when neither from nor to is given — filter stays off, old behaviour', () => {
    expect(kyivDateRange(undefined, undefined)).toBeUndefined();
    expect(kyivDateRange(null, null)).toBeUndefined();
    expect(kyivDateRange('', '')).toBeUndefined();
  });

  it('single day: from=to=2026-07-24 covers exactly that Kyiv civil day', () => {
    const range = kyivDateRange('2026-07-24', '2026-07-24');
    expect(range?.gte?.toISOString()).toBe('2026-07-23T21:00:00.000Z'); // 00:00 Kyiv on the 24th (summer, +3h)
    expect(range?.lt?.toISOString()).toBe('2026-07-24T21:00:00.000Z'); // 00:00 Kyiv on the 25th — exclusive upper bound
  });

  it('multi-day range: from=2026-07-24 to=2026-07-26 covers three full Kyiv days', () => {
    const range = kyivDateRange('2026-07-24', '2026-07-26');
    expect(range?.gte?.toISOString()).toBe('2026-07-23T21:00:00.000Z');
    expect(range?.lt?.toISOString()).toBe('2026-07-26T21:00:00.000Z'); // start of the 27th
  });

  it('only from — open-ended range, no upper bound', () => {
    const range = kyivDateRange('2026-07-24', undefined);
    expect(range?.gte?.toISOString()).toBe('2026-07-23T21:00:00.000Z');
    expect(range?.lt).toBeUndefined();
  });

  it('only to — open-started range, no lower bound', () => {
    const range = kyivDateRange(undefined, '2026-07-24');
    expect(range?.gte).toBeUndefined();
    expect(range?.lt?.toISOString()).toBe('2026-07-24T21:00:00.000Z');
  });

  it('a click at 23:59 Kyiv and a subscribe at 00:01 Kyiv the next day land on different sides of the boundary', () => {
    // 2026-07-24T20:59:00Z = 2026-07-24T23:59 Kyiv — should be inside the 24th.
    const lateNightClick = new Date('2026-07-24T20:59:00Z');
    // 2026-07-24T21:01:00Z = 2026-07-25T00:01 Kyiv — should be inside the 25th, not the 24th.
    const justAfterMidnight = new Date('2026-07-24T21:01:00Z');

    const range24 = kyivDateRange('2026-07-24', '2026-07-24');
    expect(lateNightClick.getTime()).toBeGreaterThanOrEqual(range24!.gte!.getTime());
    expect(lateNightClick.getTime()).toBeLessThan(range24!.lt!.getTime());
    expect(justAfterMidnight.getTime()).toBeGreaterThanOrEqual(range24!.lt!.getTime());
  });

  it('accepts full ISO timestamps, not just YYYY-MM-DD, and still buckets by Kyiv civil day', () => {
    const range = kyivDateRange('2026-07-24T15:30:00Z', '2026-07-24T15:30:00Z');
    expect(range?.gte?.toISOString()).toBe('2026-07-23T21:00:00.000Z');
    expect(range?.lt?.toISOString()).toBe('2026-07-24T21:00:00.000Z');
  });

  it('an invalid date string is ignored, like the bound was never given — no 500 on bad query params', () => {
    expect(kyivDateRange('not-a-date', undefined)).toBeUndefined();
    const range = kyivDateRange('not-a-date', '2026-07-24');
    expect(range?.gte).toBeUndefined();
    expect(range?.lt?.toISOString()).toBe('2026-07-24T21:00:00.000Z');
  });
});
