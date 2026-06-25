import { describe, it, expect } from 'vitest';
import { isRetentionDue, shouldCheckRetention } from '../retention';

describe('Retention helpers', () => {
  const subscribedAt = new Date('2025-06-01T12:00:00Z');

  it('detects D1 due after 24h', () => {
    const now = new Date('2025-06-02T13:00:00Z');
    expect(isRetentionDue(subscribedAt, 1, now)).toBe(true);
    expect(isRetentionDue(subscribedAt, 1, new Date('2025-06-02T10:00:00Z'))).toBe(false);
  });

  it('skips already checked profiles', () => {
    const now = new Date('2025-06-08T12:00:00Z');
    expect(
      shouldCheckRetention(
        { id: '1', subscribedAt, retainedD1: true, retainedD7: null, retainedD30: null },
        1,
        now,
      ),
    ).toBe(false);
  });

  it('checks D7 when due and null', () => {
    const now = new Date('2025-06-08T13:00:00Z');
    expect(
      shouldCheckRetention(
        { id: '1', subscribedAt, retainedD1: true, retainedD7: null, retainedD30: null },
        7,
        now,
      ),
    ).toBe(true);
  });
});
