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
      reached?: boolean | null;
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

  it('attributes standalone (seed) invite link with 100% confidence, no click search', () => {
    const result = attributeSubscription({
      ...baseInput,
      recentClicks: [],
      inviteLinkUsed: {
        id: 'inv-seed-1',
        clickEventId: null,
        campaignId: 'camp-seed',
        trackingLinkId: null,
        createdAt: new Date('2025-05-01T00:00:00Z'),
      },
    });

    expect(result.attributionType).toBe('CAMPAIGN_INVITE');
    expect(result.confidenceScore).toBe(1);
    expect(result.campaignId).toBe('camp-seed');
    expect(result.clickEventId).toBeNull();
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

  it('S2-13: ignores clicks that were measured and did not reach Telegram', () => {
    const result = attributeSubscription({
      ...baseInput,
      recentClicks: [
        // Найближчий клік точно не дійшов — він не може бути джерелом.
        { id: 'not-reached', campaignId: 'camp-a', trackingLinkId: 'link-a',
          clickedAt: new Date('2025-06-01T11:59:00Z'), reached: false },
        { id: 'reached', campaignId: 'camp-b', trackingLinkId: 'link-b',
          clickedAt: new Date('2025-06-01T11:00:00Z'), reached: true },
      ],
    });

    expect(result.attributionType).toBe('PROBABILISTIC');
    expect(result.clickEventId).toBe('reached');
    expect(result.reason).toContain('1 candidates');
  });

  it('S2-13: keeps unmeasured clicks (instant redirect) as candidates', () => {
    const result = attributeSubscription({
      ...baseInput,
      recentClicks: [
        { id: 'unmeasured', campaignId: 'camp-a', trackingLinkId: 'link-a',
          clickedAt: new Date('2025-06-01T11:50:00Z'), reached: null },
      ],
    });

    expect(result.attributionType).toBe('PROBABILISTIC');
    expect(result.clickEventId).toBe('unmeasured');
  });

  it('S2-13: does not invent a source when the only clicks did not reach Telegram', () => {
    const result = attributeSubscription({
      ...baseInput,
      recentClicks: [
        { id: 'not-reached', campaignId: 'camp-a', trackingLinkId: 'link-a',
          clickedAt: new Date('2025-06-01T11:59:00Z'), reached: false },
      ],
    });

    expect(result.attributionType).toBe('UNKNOWN');
    expect(result.clickEventId).toBeNull();
  });

  it('S2-13: exact invite click wins even if its reach was not confirmed', () => {
    const click = { id: 'exact', campaignId: 'camp-1', trackingLinkId: 'link-1',
      clickedAt: new Date('2025-06-01T11:58:00Z'), reached: false };
    const result = attributeSubscription({
      ...baseInput,
      inviteLinkUsed: { id: 'inv', clickEventId: 'exact', campaignId: 'camp-1',
        trackingLinkId: 'link-1', createdAt: click.clickedAt },
      recentClicks: [click],
    });

    expect(result.attributionType).toBe('EXACT_CLICK_INVITE');
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
