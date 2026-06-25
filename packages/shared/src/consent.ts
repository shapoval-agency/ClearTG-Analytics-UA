export type ConsentValue = 'granted' | 'denied' | 'unknown';

export interface ConsentSnapshot {
  analytics_storage: ConsentValue;
  marketing_storage: ConsentValue;
  ad_user_data: ConsentValue;
  ad_personalization: ConsentValue;
  meta_allowed: boolean;
  google_allowed: boolean;
  tiktok_allowed: boolean;
  ga4_allowed: boolean;
  recorded_at?: string;
  source?: string;
}

export const DEFAULT_CONSENT: ConsentSnapshot = {
  analytics_storage: 'unknown',
  marketing_storage: 'unknown',
  ad_user_data: 'unknown',
  ad_personalization: 'unknown',
  meta_allowed: false,
  google_allowed: false,
  tiktok_allowed: false,
  ga4_allowed: false,
};

export function parseConsentFromQuery(params: Record<string, string | undefined>): ConsentSnapshot {
  const parse = (key: string): ConsentValue => {
    const val = params[key]?.toLowerCase();
    if (val === 'granted' || val === 'denied') return val;
    return 'unknown';
  };

  const analytics = parse('analytics_storage');
  const marketing = parse('marketing_storage');
  const adUserData = parse('ad_user_data');
  const adPersonalization = parse('ad_personalization');

  return {
    analytics_storage: analytics,
    marketing_storage: marketing,
    ad_user_data: adUserData,
    ad_personalization: adPersonalization,
    meta_allowed: marketing === 'granted' && adUserData === 'granted',
    google_allowed: marketing === 'granted' && adUserData === 'granted',
    tiktok_allowed: marketing === 'granted' && adUserData === 'granted',
    ga4_allowed: analytics === 'granted',
    recorded_at: new Date().toISOString(),
    source: 'redirect_page',
  };
}

export type ConversionPlatform = 'meta' | 'google_ads' | 'ga4' | 'tiktok';

export interface EligibilityResult {
  eligible: boolean;
  status: 'pending' | 'skipped_no_consent' | 'skipped_no_identifier' | 'skipped_policy_restriction';
  reasons: string[];
}

export function checkDeliveryEligibility(
  platform: ConversionPlatform,
  consent: ConsentSnapshot,
  identifiers: {
    hasClickId?: boolean;
    hasExternalId?: boolean;
    hasGaClientId?: boolean;
    hasEmail?: boolean;
    hasPhone?: boolean;
  },
): EligibilityResult {
  const reasons: string[] = [];

  const platformAllowed = {
    meta: consent.meta_allowed,
    google_ads: consent.google_allowed,
    ga4: consent.ga4_allowed,
    tiktok: consent.tiktok_allowed,
  }[platform];

  if (!platformAllowed) {
    reasons.push(`Consent not granted for ${platform}`);
    return { eligible: false, status: 'skipped_no_consent', reasons };
  }

  const hasIdentifier =
    identifiers.hasClickId ||
    identifiers.hasExternalId ||
    identifiers.hasGaClientId ||
    identifiers.hasEmail ||
    identifiers.hasPhone;

  if (!hasIdentifier) {
    reasons.push('No permitted identifiers available for delivery');
    return { eligible: false, status: 'skipped_no_identifier', reasons };
  }

  if (consent.ad_personalization === 'denied' && platform !== 'ga4') {
    reasons.push('Ad personalization explicitly denied');
    return { eligible: false, status: 'skipped_policy_restriction', reasons };
  }

  return { eligible: true, status: 'pending', reasons: [] };
}

export function confidenceLabel(score: number): string {
  if (score >= 0.95) return 'exact';
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  if (score >= 0.25) return 'low';
  return 'unknown';
}
