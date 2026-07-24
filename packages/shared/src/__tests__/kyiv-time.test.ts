import { describe, it, expect } from 'vitest';
import { kyivDayStart, kyivOffsetMs } from '../kyiv-time';

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
