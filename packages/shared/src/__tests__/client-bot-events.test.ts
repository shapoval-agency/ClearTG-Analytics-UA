import { describe, it, expect } from 'vitest';
import { parseClickStartPayload, didUserBlockBot, didUserUnblockBot } from '../client-bot-events';

describe('parseClickStartPayload', () => {
  it('extracts the clickId from a click_ prefixed payload', () => {
    expect(parseClickStartPayload('click_abc123')).toBe('abc123');
  });

  it('returns null for payloads without the click_ prefix', () => {
    expect(parseClickStartPayload('lm_somelead')).toBeNull();
    expect(parseClickStartPayload('bind_token')).toBeNull();
    expect(parseClickStartPayload('')).toBeNull();
  });

  it('returns null when the prefix is present but nothing follows it', () => {
    expect(parseClickStartPayload('click_')).toBeNull();
    expect(parseClickStartPayload('click_   ')).toBeNull();
  });
});

describe('didUserBlockBot / didUserUnblockBot', () => {
  it('detects a user blocking the bot', () => {
    expect(didUserBlockBot({ oldStatus: 'member', newStatus: 'kicked' })).toBe(true);
  });

  it('does not flag when already blocked or unrelated change', () => {
    expect(didUserBlockBot({ oldStatus: 'kicked', newStatus: 'kicked' })).toBe(false);
    expect(didUserBlockBot({ oldStatus: 'member', newStatus: 'member' })).toBe(false);
  });

  it('detects a user unblocking the bot', () => {
    expect(didUserUnblockBot({ oldStatus: 'kicked', newStatus: 'member' })).toBe(true);
  });

  it('does not flag when staying blocked or staying unblocked', () => {
    expect(didUserUnblockBot({ oldStatus: 'kicked', newStatus: 'kicked' })).toBe(false);
    expect(didUserUnblockBot({ oldStatus: 'member', newStatus: 'member' })).toBe(false);
  });
});
