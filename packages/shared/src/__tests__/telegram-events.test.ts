import { describe, it, expect } from 'vitest';
import {
  isTrackableChatType,
  didBotBecomeAdmin,
  didBotLoseAdmin,
  isMissingInvitePermission,
  formatRecentSubscribersList,
} from '../telegram-events';

describe('isTrackableChatType', () => {
  it('channel and supergroup are trackable', () => {
    expect(isTrackableChatType('channel')).toBe(true);
    expect(isTrackableChatType('supergroup')).toBe(true);
  });

  it('private chats and basic groups are not trackable', () => {
    expect(isTrackableChatType('private')).toBe(false);
    expect(isTrackableChatType('group')).toBe(false);
  });
});

describe('didBotBecomeAdmin', () => {
  it('detects the bot being promoted to admin', () => {
    expect(didBotBecomeAdmin({ oldStatus: 'member', newStatus: 'administrator' })).toBe(true);
    expect(didBotBecomeAdmin({ oldStatus: 'left', newStatus: 'administrator' })).toBe(true);
  });

  it('does not flag when already admin or unrelated change', () => {
    expect(didBotBecomeAdmin({ oldStatus: 'administrator', newStatus: 'administrator' })).toBe(false);
    expect(didBotBecomeAdmin({ oldStatus: 'left', newStatus: 'member' })).toBe(false);
  });
});

describe('didBotLoseAdmin', () => {
  it('detects the bot being removed or demoted from admin', () => {
    expect(didBotLoseAdmin({ oldStatus: 'administrator', newStatus: 'member' })).toBe(true);
    expect(didBotLoseAdmin({ oldStatus: 'administrator', newStatus: 'kicked' })).toBe(true);
    expect(didBotLoseAdmin({ oldStatus: 'creator', newStatus: 'left' })).toBe(true);
  });

  it('does not flag when staying non-admin or staying admin', () => {
    expect(didBotLoseAdmin({ oldStatus: 'member', newStatus: 'left' })).toBe(false);
    expect(didBotLoseAdmin({ oldStatus: 'administrator', newStatus: 'creator' })).toBe(false);
  });
});

describe('isMissingInvitePermission', () => {
  it('flags an administrator without can_invite_users', () => {
    expect(isMissingInvitePermission({ status: 'administrator', can_invite_users: false })).toBe(true);
    expect(isMissingInvitePermission({ status: 'administrator' })).toBe(true);
  });

  it('does not flag an administrator who already has the right', () => {
    expect(isMissingInvitePermission({ status: 'administrator', can_invite_users: true })).toBe(false);
  });

  it('creator always has full rights', () => {
    expect(isMissingInvitePermission({ status: 'creator' })).toBe(false);
  });

  it('non-admin statuses are not applicable', () => {
    expect(isMissingInvitePermission({ status: 'member' })).toBe(false);
  });
});

describe('formatRecentSubscribersList', () => {
  const now = new Date('2026-07-22T12:00:00Z');

  it('says there are no subscribers yet when the list is empty', () => {
    expect(formatRecentSubscribersList([], now)).toBe('Ще немає підписників.');
  });

  it('shows username, channel, active status and days in channel', () => {
    const text = formatRecentSubscribersList(
      [
        {
          username: 'Tetyana_Lugova',
          telegramUserId: '502431466',
          channelTitle: 'tets',
          subscribedAt: new Date('2026-07-21T10:00:00Z'),
          isActive: true,
        },
      ],
      now,
    );
    expect(text).toContain('👥 Останні підписники');
    expect(text).toContain('@Tetyana_Lugova');
    expect(text).toContain('tets');
    expect(text).toContain('✅');
    expect(text).toContain('(1 дн.)');
    // 2026-07-21T10:00:00Z is 13:00 in Kyiv (summer, +3h) - not the raw UTC hour.
    // Regression check: 'uk-UA' alone sets the language, not the timezone.
    expect(text).toContain('13:00');
    expect(text).not.toContain('10:00');
  });

  it('falls back to the telegram id when there is no username', () => {
    const text = formatRecentSubscribersList([
      {
        username: null,
        telegramUserId: '999',
        channelTitle: 'tets',
        subscribedAt: now,
        isActive: false,
      },
    ], now);
    expect(text).toContain('id 999');
    expect(text).toContain('❌');
    expect(text).toContain('(0 дн.)');
  });

  it('lists multiple subscribers in the order given', () => {
    const text = formatRecentSubscribersList(
      [
        { username: 'first', telegramUserId: '1', channelTitle: 'a', subscribedAt: now, isActive: true },
        { username: 'second', telegramUserId: '2', channelTitle: 'b', subscribedAt: now, isActive: true },
      ],
      now,
    );
    const firstIndex = text.indexOf('@first');
    const secondIndex = text.indexOf('@second');
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
  });
});
