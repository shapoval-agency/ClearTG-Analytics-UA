import { describe, it, expect } from 'vitest';
import { buildTikTokEventPayload, canSendTikTokEvent, mapTikTokEventName } from '../tiktok';

describe('TikTok Events API builder', () => {
  const base = {
    pixelId: 'PIXEL123',
    eventName: 'TG_Subscribe',
    eventTime: new Date('2025-06-01T12:00:00Z'),
    eventId: 'evt_tiktok_1',
    consentAdUserDataGranted: true,
  };

  it('maps internal events to TikTok standard events', () => {
    expect(mapTikTokEventName('TG_Subscribe')).toBe('CompleteRegistration');
    expect(mapTikTokEventName('LeadMagnet_Claimed')).toBe('LeadMagnetClaimed');
  });

  it('builds payload with ttclid', () => {
    const body = buildTikTokEventPayload({ ...base, ttclid: 'ttclid_abc' });
    const event = (body.data as Array<Record<string, unknown>>)[0];
    expect(event.event).toBe('CompleteRegistration');
    expect((event.user as Record<string, string>).ttclid).toBe('ttclid_abc');
    expect(event.event_id).toBe('evt_tiktok_1');
  });

  it('includes external_id only with consent', () => {
    const body = buildTikTokEventPayload({
      ...base,
      externalIdHash: 'hash_123',
    });
    expect((body.data as Array<{ user: Record<string, string> }>)[0].user.external_id).toBe('hash_123');
  });

  it('requires identifier for delivery', () => {
    expect(canSendTikTokEvent(base)).toBe(false);
    expect(canSendTikTokEvent({ ...base, ttclid: 'x' })).toBe(true);
    expect(canSendTikTokEvent({ ...base, externalIdHash: 'h', consentAdUserDataGranted: true })).toBe(true);
  });
});
