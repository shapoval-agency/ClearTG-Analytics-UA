import { describe, it, expect } from 'vitest';
import {
  buildUploadClickConversionBody,
  canUploadGoogleConversion,
  formatGoogleAdsDateTime,
} from '../google-ads';

describe('Google Ads conversion builder', () => {
  const base = {
    customerId: '1234567890',
    conversionActionId: '987654321',
    eventTime: new Date('2025-06-01T12:30:00Z'),
    eventId: 'evt_abc123',
    consentAdUserDataGranted: true,
  };

  it('formats datetime for Google Ads API', () => {
    expect(formatGoogleAdsDateTime(base.eventTime)).toBe('2025-06-01 12:30:00+00:00');
  });

  it('builds gclid conversion payload', () => {
    const body = buildUploadClickConversionBody({ ...base, gclid: 'gclid_test' });
    expect(body.conversions[0]).toMatchObject({
      gclid: 'gclid_test',
      orderId: 'evt_abc123',
    });
  });

  it('uses gbraid when no gclid', () => {
    const body = buildUploadClickConversionBody({ ...base, gbraid: 'gbraid_test' });
    expect(body.conversions[0]).toMatchObject({ gbraid: 'gbraid_test' });
  });

  it('uses hashed external id only with consent', () => {
    const body = buildUploadClickConversionBody({
      ...base,
      externalIdHash: 'hash_user_1',
    });
    expect(body.conversions[0]).toHaveProperty('userIdentifiers');
  });

  it('rejects upload without identifiers', () => {
    expect(canUploadGoogleConversion({ ...base })).toBe(false);
    expect(canUploadGoogleConversion({ ...base, gclid: 'x' })).toBe(true);
  });
});
