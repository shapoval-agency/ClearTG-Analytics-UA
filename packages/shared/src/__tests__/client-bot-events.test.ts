import { describe, it, expect } from 'vitest';
import {
  parseClickStartPayload,
  didUserBlockBot,
  didUserUnblockBot,
  classifyBotStartError,
  isRecoverableBotError,
} from '../client-bot-events';

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


describe('classifyBotStartError', () => {
  it('409 during deploy overlap is temporary', () => {
    expect(classifyBotStartError({ code: 409, description: 'Conflict: terminated by other getUpdates request; make sure that only one bot instance is running' })).toBe('retry');
  });
  it('409 because of a webhook needs the client to act', () => {
    expect(classifyBotStartError({ code: 409, description: "Conflict: can't use getUpdates method while webhook is active" })).toBe('webhook_conflict');
  });
  it('revoked token is permanent', () => {
    expect(classifyBotStartError({ code: 401, description: 'Unauthorized' })).toBe('token_invalid');
    expect(classifyBotStartError({ code: 404, description: 'Not Found' })).toBe('token_invalid');
  });
  it('network errors are retried', () => {
    expect(classifyBotStartError({})).toBe('retry');
  });
  it('recognises bots disabled by a past deploy conflict', () => {
    expect(isRecoverableBotError("Call to 'getUpdates' failed! (409: Conflict: terminated by other getUpdates request)")).toBe(true);
    expect(isRecoverableBotError("Call to 'getUpdates' failed! (401: Unauthorized)")).toBe(false);
    expect(isRecoverableBotError("(409: Conflict: can't use getUpdates method while webhook is active)")).toBe(false);
    expect(isRecoverableBotError(null)).toBe(false);
  });
});
