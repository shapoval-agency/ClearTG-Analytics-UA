import { describe, it, expect } from 'vitest';
import { formatChannelDigest, type DigestPersonRow } from '../channel-digest';

function row(partial: Partial<DigestPersonRow> & { occurredAt: Date }): DigestPersonRow {
  return {
    telegramUserId: '1',
    username: null,
    firstName: null,
    lastName: null,
    sourceLabel: 'без посилання',
    ...partial,
  };
}

describe('formatChannelDigest', () => {
  it('matches the PM-provided example shape for a channel with only subscribers', () => {
    const text = formatChannelDigest({
      channelTitle: 'Телеграм на понятном',
      totalActive: 116,
      netChange: 2,
      subscribers: [
        row({
          telegramUserId: '1',
          firstName: 'Volodymyr',
          lastName: 'O',
          username: 'digitalov1',
          sourceLabel: 'fb',
          occurredAt: new Date('2026-07-21T14:03:00Z'), // 17:03 Kyiv (summer +3h)
        }),
        row({
          telegramUserId: '2',
          firstName: 'Сергей',
          username: 'SergeyKharcov',
          sourceLabel: 'fb',
          occurredAt: new Date('2026-07-21T11:32:00Z'), // 14:32 Kyiv
        }),
      ],
      unsubscribers: [],
    });

    expect(text).toContain('За вчора у вас +2 підписників, всього 116 в каналі «Телеграм на понятном»');
    expect(text).toContain('Підписалися: 2');
    expect(text).toContain('(2) fb:');
    expect(text).toContain('17:03 Volodymyr O, @digitalov1');
    expect(text).toContain('14:32 Сергей, @SergeyKharcov');
    expect(text).toContain('Відписалися: 0');
    // The newer event (17:03) must come before the older one (14:32) within the group.
    expect(text.indexOf('17:03')).toBeLessThan(text.indexOf('14:32'));
  });

  it('groups subscribers and unsubscribers by source, largest group first, and shows days for unsubscribers', () => {
    const text = formatChannelDigest({
      channelTitle: 'KLTP FINANCE',
      totalActive: 1059,
      netChange: 2,
      subscribers: [
        row({ telegramUserId: '1', firstName: 'Hannas', lastName: 'Van Dahl', username: 'hannas_van_dahl', sourceLabel: 'без посилання', occurredAt: new Date('2026-07-21T19:40:00Z') }),
        row({ telegramUserId: '2', firstName: 'kaveh', lastName: 'moradi', username: 'kavehmoradiii', sourceLabel: 'без посилання', occurredAt: new Date('2026-07-21T08:40:00Z') }),
        row({ telegramUserId: '3', firstName: 'Ihor', username: 'Ihorkovalets', sourceLabel: 'Facebook', occurredAt: new Date('2026-07-21T10:40:00Z') }),
        row({ telegramUserId: '4', firstName: 'Gennadii', sourceLabel: 'Facebook', occurredAt: new Date('2026-07-21T05:14:00Z') }),
      ],
      unsubscribers: [
        row({ telegramUserId: '5', firstName: '𝕄𝟚𝟡', sourceLabel: 'без посилання', occurredAt: new Date('2026-07-21T17:35:00Z'), daysInChannel: 23 }),
        row({ telegramUserId: '6', firstName: 'M£lаπ¥🦅Pilgrim', username: 'MilySw001', sourceLabel: 'без посилання', occurredAt: new Date('2026-07-21T08:46:00Z'), daysInChannel: 26 }),
      ],
    });

    expect(text).toContain('Підписалися: 4');
    expect(text).toContain('(2) без посилання:');
    expect(text).toContain('(2) Facebook:');
    expect(text).toContain('Відписалися: 2');
    expect(text).toContain('𝕄𝟚𝟡 (23 дн.)');
    expect(text).toContain('M£lаπ¥🦅Pilgrim, @MilySw001 (26 дн.)');
  });

  it('falls back to telegram id when there is neither a name nor a username', () => {
    const text = formatChannelDigest({
      channelTitle: 'test',
      totalActive: 1,
      netChange: 1,
      subscribers: [row({ telegramUserId: '999', occurredAt: new Date('2026-07-21T10:00:00Z') })],
      unsubscribers: [],
    });
    expect(text).toContain('id 999');
  });

  it('shows a negative net change with a minus sign', () => {
    const text = formatChannelDigest({
      channelTitle: 'test',
      totalActive: 10,
      netChange: -3,
      subscribers: [],
      unsubscribers: [],
    });
    expect(text).toContain('-3 підписників');
    expect(text).not.toContain('+-3');
  });

  it('marks users who already pressed /start on the bot with a star', () => {
    const text = formatChannelDigest({
      channelTitle: 'test',
      totalActive: 1,
      netChange: 1,
      subscribers: [
        row({ telegramUserId: '1', username: 'starred', occurredAt: new Date('2026-07-21T10:00:00Z'), botStarted: true }),
        row({ telegramUserId: '2', username: 'plain', occurredAt: new Date('2026-07-21T09:00:00Z'), botStarted: false }),
      ],
      unsubscribers: [],
    });
    expect(text).toContain('@starred ★');
    expect(text).toContain('@plain');
    expect(text).not.toContain('@plain ★');
  });

  it('shows an approximate ">N дн." for unsubscribers whose original subscribe was never tracked', () => {
    const text = formatChannelDigest({
      channelTitle: 'test',
      totalActive: 1,
      netChange: -1,
      subscribers: [],
      unsubscribers: [
        row({
          telegramUserId: '1',
          firstName: 'Viktor',
          username: 'amiigo00l0',
          sourceLabel: 'початкова аудиторія',
          occurredAt: new Date('2026-07-21T20:14:00Z'),
          daysInChannel: 54,
          daysApprox: true,
          botStarted: true,
        }),
      ],
    });
    expect(text).toContain('(1) початкова аудиторія:');
    expect(text).toContain('Viktor, @amiigo00l0 ★ (>54 дн.)');
  });

  it('caps each source group at 50 rows and reports the remainder', () => {
    const rows: DigestPersonRow[] = Array.from({ length: 55 }, (_, i) =>
      row({
        telegramUserId: String(i),
        username: `user${i}`,
        occurredAt: new Date(Date.UTC(2026, 6, 21, 10, 0, 0) - i * 60_000),
      }),
    );
    const text = formatChannelDigest({
      channelTitle: 'test',
      totalActive: 55,
      netChange: 55,
      subscribers: rows,
      unsubscribers: [],
    });
    expect(text).toContain('(55) без посилання:');
    expect(text).toContain('@user0');
    expect(text).toContain('@user49');
    expect(text).not.toContain('@user50');
    expect(text).toContain('і ще: 5');
  });
});
