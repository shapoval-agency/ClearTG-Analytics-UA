import { describe, it, expect } from 'vitest';
import { attributeSubscription } from '../attribution';
import { checkDeliveryEligibility, DEFAULT_CONSENT } from '../consent';

describe('Attribution Engine', () => {
  const baseInput = {
    membershipEventId: 'mem-1',
    channelId: 'ch-1',
    subscribedAt: new Date('2025-06-01T12:00:00Z'),
    attributionWindowMinutes: 10080, // 7 days
    recentClicks: [] as Array<{
      id: string;
      campaignId: string | null;
      trackingLinkId: string;
      clickedAt: Date;
    }>,
  };

  it('attributes exact click invite with high confidence', () => {
    const click = {
      id: 'click-1',
      campaignId: 'camp-1',
      trackingLinkId: 'link-1',
      clickedAt: new Date('2025-06-01T11:55:00Z'),
    };

    const result = attributeSubscription({
      ...baseInput,
      recentClicks: [click],
      inviteLinkUsed: {
        id: 'inv-1',
        clickEventId: 'click-1',
        campaignId: 'camp-1',
        trackingLinkId: 'link-1',
        createdAt: new Date('2025-06-01T11:55:30Z'),
      },
    });

    expect(result.attributionType).toBe('EXACT_CLICK_INVITE');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.95);
    expect(result.clickEventId).toBe('click-1');
  });

  it('attributes campaign invite when no specific click on invite', () => {
    const click = {
      id: 'click-2',
      campaignId: 'camp-2',
      trackingLinkId: 'link-2',
      clickedAt: new Date('2025-06-01T10:00:00Z'),
    };

    const result = attributeSubscription({
      ...baseInput,
      recentClicks: [click],
      inviteLinkUsed: {
        id: 'inv-2',
        clickEventId: null,
        campaignId: 'camp-2',
        trackingLinkId: 'link-2',
        createdAt: new Date('2025-06-01T09:00:00Z'),
      },
    });

    expect(result.attributionType).toBe('CAMPAIGN_INVITE');
    expect(result.confidenceScore).toBeGreaterThan(0.7);
    expect(result.campaignId).toBe('camp-2');
  });

  it('uses probabilistic attribution for time-based match', () => {
    const click = {
      id: 'click-3',
      campaignId: 'camp-3',
      trackingLinkId: 'link-3',
      clickedAt: new Date('2025-06-01T11:30:00Z'),
    };

    const result = attributeSubscription({
      ...baseInput,
      recentClicks: [click],
    });

    expect(result.attributionType).toBe('PROBABILISTIC');
    expect(result.confidenceScore).toBeGreaterThan(0.4);
    expect(result.confidenceScore).toBeLessThan(0.9);
    expect(result.clickEventId).toBe('click-3');
  });

  it('marks organic when no clicks exist', () => {
    const result = attributeSubscription(baseInput);

    expect(result.attributionType).toBe('ORGANIC');
    expect(result.clickEventId).toBeNull();
  });

  it('marks unknown when clicks exist but outside window', () => {
    const result = attributeSubscription({
      ...baseInput,
      recentClicks: [
        {
          id: 'click-old',
          campaignId: 'camp-1',
          trackingLinkId: 'link-1',
          clickedAt: new Date('2025-05-20T12:00:00Z'),
        },
      ],
    });

    expect(result.attributionType).toBe('UNKNOWN');
    expect(result.confidenceScore).toBeLessThan(0.2);
  });

  it('rejects click after subscription time', () => {
    const result = attributeSubscription({
      ...baseInput,
      recentClicks: [
        {
          id: 'click-future',
          campaignId: 'camp-1',
          trackingLinkId: 'link-1',
          clickedAt: new Date('2025-06-01T13:00:00Z'),
        },
      ],
    });

    expect(result.attributionType).toBe('UNKNOWN');
  });
});

describe('Event Delivery Eligibility', () => {
  it('skips when consent not granted', () => {
    const result = checkDeliveryEligibility('meta', DEFAULT_CONSENT, {
      hasClickId: true,
      hasExternalId: true,
    });

    expect(result.eligible).toBe(false);
    expect(result.status).toBe('skipped_no_consent');
  });

  it('allows Meta when consent and identifiers present', () => {
    const consent = {
      ...DEFAULT_CONSENT,
      marketing_storage: 'granted' as const,
      ad_user_data: 'granted' as const,
      meta_allowed: true,
    };

    const result = checkDeliveryEligibility('meta', consent, {
      hasClickId: true,
      hasExternalId: true,
    });

    expect(result.eligible).toBe(true);
    expect(result.status).toBe('pending');
  });

  it('skips when no identifiers', () => {
    const consent = {
      ...DEFAULT_CONSENT,
      marketing_storage: 'granted' as const,
      ad_user_data: 'granted' as const,
      meta_allowed: true,
    };

    const result = checkDeliveryEligibility('meta', consent, {});

    expect(result.eligible).toBe(false);
    expect(result.status).toBe('skipped_no_identifier');
  });

  it('skips ad platforms when personalization denied', () => {
    const consent = {
      ...DEFAULT_CONSENT,
      marketing_storage: 'granted' as const,
      ad_user_data: 'granted' as const,
      ad_personalization: 'denied' as const,
      meta_allowed: true,
    };

    const result = checkDeliveryEligibility('meta', consent, {
      hasExternalId: true,
    });

    expect(result.eligible).toBe(false);
    expect(result.status).toBe('skipped_policy_restriction');
  });

  it('allows GA4 with analytics consent only', () => {
    const consent = {
      ...DEFAULT_CONSENT,
      analytics_storage: 'granted' as const,
      ga4_allowed: true,
    };

    const result = checkDeliveryEligibility('ga4', consent, {
      hasGaClientId: true,
    });

    expect(result.eligible).toBe(true);
  });
});
