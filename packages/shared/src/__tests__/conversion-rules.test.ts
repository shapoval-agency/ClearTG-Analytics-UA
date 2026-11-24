import { describe, it, expect } from 'vitest';
import {
  buildConversionEligibility,
  platformHasIdentifier,
  resolveConversionDelayMinutes,
  resolveConversionStatus,
} from '../conversion-rules';
import type { ConsentSnapshot } from '../consent';

const granted: ConsentSnapshot = {
  analytics_storage: 'granted', marketing_storage: 'granted', ad_user_data: 'granted',
  ad_personalization: 'granted', meta_allowed: true, google_allowed: true, tiktok_allowed: true, ga4_allowed: true,
};

describe('conversion rules (stage 03)', () => {
  it('matches identifiers to their own platform only', () => {
    expect(platformHasIdentifier('meta', { fbclid: 'x' })).toBe(true);
    expect(platformHasIdentifier('meta', { gclid: 'x' })).toBe(false);
    expect(platformHasIdentifier('google_ads', { wbraid: 'x' })).toBe(true);
    expect(platformHasIdentifier('ga4', { gaClientId: '1.2' })).toBe(true);
    expect(platformHasIdentifier('ga4', null)).toBe(false);
  });

  it('S3-02: sends only to connected platforms that have the click identifier', () => {
    const e = buildConversionEligibility({
      consent: granted,
      click: { gclid: 'g1', fbclid: 'f1' },
      connected: new Set(['google_ads', 'ga4']),
    });
    expect(e.google_ads.eligible).toBe(true);
    expect(e.ga4.eligible).toBe(false); // підключено, але немає _ga
    expect(e.ga4.status).toBe('skipped_no_identifier');
    expect(e.meta.status).toBe('skipped_not_connected'); // fbclid є, але Meta не підключена
    expect(resolveConversionStatus(e)).toBe('PENDING');
  });

  it('S3-02: organic subscription (no ad click) is never sent', () => {
    const e = buildConversionEligibility({ consent: granted, click: null, connected: new Set(['meta']) });
    expect(e.meta.eligible).toBe(false);
    expect(resolveConversionStatus(e)).toBe('SKIPPED_NO_IDENTIFIER');
  });

  it('creates no event when nothing is connected', () => {
    const e = buildConversionEligibility({ consent: granted, click: { fbclid: 'x' }, connected: new Set() });
    expect(resolveConversionStatus(e)).toBeNull();
  });

  it('respects consent', () => {
    const e = buildConversionEligibility({
      consent: { ...granted, meta_allowed: false },
      click: { fbclid: 'x' },
      connected: new Set(['meta']),
    });
    expect(resolveConversionStatus(e)).toBe('SKIPPED_NO_CONSENT');
  });

  it('S3-09: campaign delay overrides workspace delay', () => {
    expect(resolveConversionDelayMinutes(0, 24)).toBe(1440);
    expect(resolveConversionDelayMinutes(30, 24)).toBe(30);
    expect(resolveConversionDelayMinutes(null, 0)).toBe(0);
  });
});
