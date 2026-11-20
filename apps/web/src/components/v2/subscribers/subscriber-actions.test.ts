import { describe, expect, it } from 'vitest';
import type { SubscriberDossier } from '@/lib/api';
import { buildSubscriberActions } from './subscriber-actions';

function dossier(overrides: Partial<SubscriberDossier> = {}): SubscriberDossier {
  return {
    id: 'p1', telegramUserId: '42', telegramUsername: 'anna',
    channel: { id: 'c1', title: 'Новини', username: null },
    subscribedAt: '2026-11-01T10:05:00Z', isActive: true, daysInChannel: 3,
    retainedD1: true, retainedD7: null, retainedD30: null,
    botStarted: false, botOptedOut: false,
    attribution: {
      type: 'EXACT_CLICK_INVITE', confidence: 0.98, reason: '', campaign: 'Осінь',
      trackingLink: 'abc', trackingLinkName: 'Відео 1',
      utm: { source: null, medium: null, campaign: null, content: null, term: null },
      creativeTag: null, postNumber: null,
      clickedAt: '2026-11-01T10:00:00Z', telegramOpenedAt: '2026-11-01T10:01:00Z', reachTracked: true,
    },
    unsubscribes: [], leadMagnets: [], conversions: [],
    ...overrides,
  };
}

describe('buildSubscriberActions (S2-22)', () => {
  it('будує хронологію від кліку до утримання', () => {
    const labels = buildSubscriberActions(dossier()).map((a) => a.label);
    expect(labels).toEqual([
      'Клік по посиланню «Відео 1»',
      'Відкрив Telegram',
      'Підписався на «Новини»',
      'Залишався в каналі через 1 день',
    ]);
  });

  it('не показує «Відкрив Telegram», якщо перехід не вимірювався', () => {
    const d = dossier();
    d.attribution!.reachTracked = false;
    expect(buildSubscriberActions(d).map((a) => a.key)).not.toContain('reach');
  });

  it('додає відписку, лід-магніт і невдалу конверсію', () => {
    const actions = buildSubscriberActions(dossier({
      unsubscribes: [{ id: 'u1', occurredAt: '2026-11-03T09:00:00Z', telegramUsername: null }],
      leadMagnets: [{ name: 'Чекліст', slug: 'check', claimedAt: '2026-11-01T11:00:00Z' }],
      conversions: [{ eventName: 'Subscribe', eventTime: '2026-11-01T10:06:00Z', status: 'FAILED' }],
    }));
    const unsub = actions.find((a) => a.key === 'unsub-u1');
    expect(unsub?.tone).toBe('warn');
    expect(actions.find((a) => a.label.startsWith('Конверсія'))?.tone).toBe('warn');
    expect(actions.findIndex((a) => a.key === 'unsub-u1')).toBeGreaterThan(
      actions.findIndex((a) => a.label.startsWith('Отримав лід-магніт')),
    );
  });

  it('без атрибуції показує лише підписку', () => {
    const actions = buildSubscriberActions(dossier({ attribution: null, retainedD1: null }));
    expect(actions.map((a) => a.key)).toEqual(['subscribe']);
  });
});
