import { describe, expect, it } from 'vitest';
import { buildDigestImportantChange, isDigestDue } from './bot-admin.service';

describe('isDigestDue', () => {
  const base = {
    enabled: true,
    frequency: 'DAILY' as const,
    hour: 9,
    lastSentAt: null,
  };

  it('враховує київський час і не відправляє раніше обраної години', () => {
    expect(isDigestDue(base, new Date('2026-11-02T06:55:00.000Z'))).toBe(false);
    expect(isDigestDue(base, new Date('2026-11-02T07:05:00.000Z'))).toBe(true);
  });

  it('не дублює звіт у той самий київський день', () => {
    expect(isDigestDue(
      { ...base, lastSentAt: new Date('2026-11-02T07:05:00.000Z') },
      new Date('2026-11-02T12:05:00.000Z'),
    )).toBe(false);
  });

  it('режим будніх днів пропускає суботу й неділю', () => {
    expect(isDigestDue(
      { ...base, frequency: 'WEEKDAYS' },
      new Date('2026-11-07T08:05:00.000Z'),
    )).toBe(false);
  });
});

describe('buildDigestImportantChange', () => {
  it('ставить зростання unknown вище за інші сигнали', () => {
    expect(buildDigestImportantChange({
      subscriptions: 10,
      previousSubscriptions: 10,
      unsubscribes: 8,
      previousUnsubscribes: 2,
      unknownShare: 0.4,
      previousUnknownShare: 0.1,
    })).toContain('невідомих джерел');
  });

  it('повідомляє, коли різких змін немає', () => {
    expect(buildDigestImportantChange({
      subscriptions: 4,
      previousSubscriptions: 4,
      unsubscribes: 1,
      previousUnsubscribes: 1,
      unknownShare: 0,
      previousUnknownShare: 0,
    })).toBe('різких змін не виявлено');
  });
});
