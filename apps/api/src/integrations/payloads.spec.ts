import { describe, it, expect, vi, afterEach } from 'vitest';
import { MetaService } from './meta/meta.service';
import { GA4Service } from './ga4/ga4.service';
import { GoogleAdsService } from './google-ads/google-ads.service';

const consent = {
  analytics_storage: 'granted', marketing_storage: 'granted', ad_user_data: 'granted',
  ad_personalization: 'granted', meta_allowed: true, google_allowed: true, tiktok_allowed: true, ga4_allowed: true,
} as const;
const crypto = { decrypt: vi.fn().mockReturnValue('secret'), encrypt: vi.fn().mockReturnValue('enc') };

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: unknown = {}, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(response) });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Meta CAPI payload (S3-06)', () => {
  it('не шле хеші як IP/User-Agent і передає event_source_url', async () => {
    const fetchMock = stubFetch({ events_received: 1 });
    const prisma = { metaIntegration: { findFirst: vi.fn().mockResolvedValue({ pixelId: '1234567890', accessTokenEnc: 'x', testEventCode: null }) } };
    const meta = new MetaService(prisma as never, crypto as never);

    await meta.sendEvent('ws', {
      eventName: 'TG_Subscribe', eventTime: new Date(), eventId: 'e1', consent,
      click: { fbclid: 'abc', ipHash: 'hash-ip', userAgentHash: 'hash-ua' },
      externalIdHash: 'ext', eventSourceUrl: 'https://app.example/l/slug',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const event = body.data[0];
    expect(event.event_source_url).toBe('https://app.example/l/slug');
    expect(event.user_data.client_ip_address).toBeUndefined();
    expect(event.user_data.client_user_agent).toBeUndefined();
    expect(event.user_data.fbc).toMatch(/^fb\.1\.\d+\.abc$/);
  });

  it('немає увімкненої інтеграції — пропуск, а не помилка', async () => {
    const meta = new MetaService({ metaIntegration: { findFirst: vi.fn().mockResolvedValue(null) } } as never, crypto as never);
    const result = await meta.sendEvent('ws', { eventName: 'TG_Subscribe', eventTime: new Date(), eventId: 'e', consent });
    expect(result).toMatchObject({ success: false, skipped: true });
  });
});

describe('GA4 Measurement Protocol payload (S3-02)', () => {
  const prisma = { gA4Integration: { findFirst: vi.fn().mockResolvedValue({ measurementId: 'G-ABC123', apiSecretEnc: 'x' }) } };

  it('без справжнього client_id подію не шле (не створює вигаданих користувачів)', async () => {
    const fetchMock = stubFetch();
    const ga4 = new GA4Service(prisma as never, crypto as never);
    const result = await ga4.sendEvent('ws', { eventName: 'TG_Subscribe', eventTime: new Date(), eventId: 'e', consent, click: {} });
    expect(result.skipped).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('передає час події, client_id і справжній session_id', async () => {
    const fetchMock = stubFetch();
    const ga4 = new GA4Service(prisma as never, crypto as never);
    const eventTime = new Date('2026-11-01T10:00:00Z');
    await ga4.sendEvent('ws', {
      eventName: 'TG_Reached_Telegram', eventTime, eventId: 'e', consent,
      click: { gaClientId: '123.456', gaSessionId: '1700000000' },
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.client_id).toBe('123.456');
    expect(body.timestamp_micros).toBe(String(eventTime.getTime() * 1000));
    expect(body.events[0].name).toBe('tg_reached_telegram');
    expect(body.events[0].params.session_id).toBe('1700000000');
  });
});

describe('Google Ads goals (S3-12 / S3-16)', () => {
  it('без окремої дії-конверсії ціль «дійшов до Telegram» не шлеться як підписка', async () => {
    const fetchMock = stubFetch();
    const prisma = {
      googleAdsIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: 'g', customerId: '1234567890', conversionActionId: '111', eventMapping: {}, oauthCredentialsEnc: 'x' }),
      },
    };
    const config = { get: vi.fn().mockReturnValue('dev-token') };
    const ads = new GoogleAdsService(prisma as never, crypto as never, {} as never, config as never);
    const result = await ads.sendEvent('ws', {
      eventName: 'TG_Reached_Telegram', eventTime: new Date(), eventId: 'e', consent, click: { gclid: 'g1' },
    });
    expect(result).toMatchObject({ success: false, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
