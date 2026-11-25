import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetaService } from './meta/meta.service';
import { GA4Service } from './ga4/ga4.service';
import { GoogleAdsService } from './google-ads/google-ads.service';

const consent = {
  analytics_storage: 'granted', marketing_storage: 'granted', ad_user_data: 'granted',
  ad_personalization: 'granted', meta_allowed: true, google_allowed: true, tiktok_allowed: true, ga4_allowed: true,
} as const;
const crypto = { decrypt: vi.fn().mockReturnValue('SECRET_TOKEN'), encrypt: vi.fn() };

describe('CONVERSIONS_DRY_RUN', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv('CONVERSIONS_DRY_RUN', 'true');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('Meta: нічого не відправляє, записує повний запит без токена', async () => {
    const prisma = { metaIntegration: { findFirst: vi.fn().mockResolvedValue({ pixelId: '1234567890', accessTokenEnc: 'x', testEventCode: null }) } };
    const result = await new MetaService(prisma as never, crypto as never).sendEvent('ws', {
      eventName: 'TG_Subscribe', eventTime: new Date(), eventId: 'e1', consent, click: { fbclid: 'abc' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, dryRun: true });
    const req = result.requestPayload as { endpoint: string; body: { data: Array<{ event_name: string }> } };
    expect(req.endpoint).not.toContain('SECRET_TOKEN');
    expect(req.body.data[0].event_name).toBe('Lead');
  });

  it('GA4: нічого не відправляє і не пише api_secret у журнал', async () => {
    const prisma = { gA4Integration: { findFirst: vi.fn().mockResolvedValue({ measurementId: 'G-ABC123', apiSecretEnc: 'x' }) } };
    const result = await new GA4Service(prisma as never, crypto as never).sendEvent('ws', {
      eventName: 'TG_Subscribe', eventTime: new Date(), eventId: 'e1', consent, click: { gaClientId: '1.2' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(JSON.stringify(result.requestPayload)).not.toContain('SECRET_TOKEN');
  });

  it('Google Ads: формує uploadClickConversions без developer token і OAuth', async () => {
    const prisma = {
      googleAdsIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: 'g', customerId: '1234567890', conversionActionId: '111', eventMapping: {}, oauthCredentialsEnc: 'x' }),
      },
    };
    const config = { get: vi.fn().mockReturnValue(undefined) };
    const result = await new GoogleAdsService(prisma as never, crypto as never, {} as never, config as never).sendEvent('ws', {
      eventName: 'TG_Subscribe', eventTime: new Date(), eventId: 'e1', consent, click: { gclid: 'g1' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, dryRun: true });
    expect(JSON.stringify(result.requestPayload)).toContain('g1');
  });

  it('«Перевірити» проходить без реальних доступів, але формат ID усе одно перевіряється', async () => {
    const meta = new MetaService({ metaIntegration: { findFirst: vi.fn().mockResolvedValue({ pixelId: '1234567890', accessTokenEnc: 'x' }) } } as never, crypto as never);
    expect((await meta.verify('ws')).ok).toBe(true);

    const badMeta = new MetaService({ metaIntegration: { findFirst: vi.fn().mockResolvedValue({ pixelId: 'abc', accessTokenEnc: 'x' }) } } as never, crypto as never);
    expect((await badMeta.verify('ws')).ok).toBe(false);

    const ads = new GoogleAdsService(
      { googleAdsIntegration: { findFirst: vi.fn().mockResolvedValue({ customerId: '1', conversionActionId: '111', eventMapping: {} }) } } as never,
      crypto as never, {} as never, { get: vi.fn() } as never,
    );
    const check = await ads.verify('ws');
    expect(check.ok).toBe(true);
    expect(check.checks.map((c) => c.id)).toContain('dry_run');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
