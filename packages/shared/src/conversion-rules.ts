import { checkDeliveryEligibility, type ConsentSnapshot, type ConversionPlatform, type EligibilityResult } from './consent';

/**
 * Етап 03: правила, ЩО і КУДИ передаємо в рекламні кабінети.
 * Чисті функції — без мережі й бази, перевіряються юніт-тестами.
 */

export const CONVERSION_PLATFORMS: ConversionPlatform[] = ['meta', 'google_ads', 'ga4', 'tiktok'];

/** Ідентифікатори кліку, за якими рекламна система може знайти людину. */
export interface ClickIdentifiers {
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  ttclid?: string | null;
  ttp?: string | null;
  gaClientId?: string | null;
}

/**
 * Чи є в кліку ідентифікатор саме цієї платформи. Наш внутрішній хеш
 * підписника сюди не входить: рекламна система за ним нікого не знайде.
 */
export function platformHasIdentifier(platform: ConversionPlatform, click: ClickIdentifiers | null | undefined): boolean {
  if (!click) return false;
  switch (platform) {
    case 'meta':
      return Boolean(click.fbclid || click.fbc || click.fbp);
    case 'google_ads':
      return Boolean(click.gclid || click.gbraid || click.wbraid);
    case 'ga4':
      return Boolean(click.gaClientId);
    case 'tiktok':
      return Boolean(click.ttclid || click.ttp);
  }
}

export type PlatformEligibility = Omit<EligibilityResult, 'status'> & {
  status: EligibilityResult['status'] | 'skipped_not_connected';
};

/**
 * Куди можна відправити подію: платформа підключена й увімкнена, людина дала
 * згоду, і в кліку є ідентифікатор цієї платформи. Подія без рекламного кліку
 * (органіка, невизначене джерело) не відправляється нікуди — S3-02 вимагає
 * атрибутовану підписку.
 */
export function buildConversionEligibility(input: {
  consent: ConsentSnapshot;
  click: ClickIdentifiers | null | undefined;
  connected: ReadonlySet<ConversionPlatform>;
}): Record<ConversionPlatform, PlatformEligibility> {
  const result = {} as Record<ConversionPlatform, PlatformEligibility>;
  for (const platform of CONVERSION_PLATFORMS) {
    if (!input.connected.has(platform)) {
      result[platform] = { eligible: false, status: 'skipped_not_connected', reasons: ['Integration not connected'] };
      continue;
    }
    if (!input.click) {
      result[platform] = { eligible: false, status: 'skipped_no_identifier', reasons: ['No ad click for this subscription'] };
      continue;
    }
    const consentCheck = checkDeliveryEligibility(platform, input.consent, {
      hasClickId: platformHasIdentifier(platform, input.click),
    });
    result[platform] = consentCheck;
  }
  return result;
}

export type ConversionStatusKey =
  | 'PENDING'
  | 'SKIPPED_NO_CONSENT'
  | 'SKIPPED_NO_IDENTIFIER'
  | 'SKIPPED_POLICY_RESTRICTION';

/** Загальний статус події з урахуванням лише підключених платформ. */
export function resolveConversionStatus(
  eligibility: Record<ConversionPlatform, PlatformEligibility>,
): ConversionStatusKey | null {
  const connected = Object.values(eligibility).filter((e) => e.status !== 'skipped_not_connected');
  if (connected.length === 0) return null; // нікуди відправляти — подію не створюємо
  if (connected.some((e) => e.eligible)) return 'PENDING';
  if (connected.every((e) => e.status === 'skipped_no_consent')) return 'SKIPPED_NO_CONSENT';
  if (connected.every((e) => e.status === 'skipped_no_identifier' || e.status === 'skipped_no_consent')) {
    return 'SKIPPED_NO_IDENTIFIER';
  }
  return 'SKIPPED_POLICY_RESTRICTION';
}

/**
 * S3-09: затримка відправки підписки. Власна затримка кампанії (якщо задана)
 * має пріоритет над загальною затримкою кабінету.
 */
export function resolveConversionDelayMinutes(
  campaignDelayMinutes: number | null | undefined,
  workspaceDelayHours: number,
): number {
  if (campaignDelayMinutes && campaignDelayMinutes > 0) return campaignDelayMinutes;
  return Math.max(0, Math.round(workspaceDelayHours * 60));
}

/** Дозволені значення затримки в інтерфейсі (години). */
export const CONVERSION_DELAY_HOURS = [0, 1, 3, 6, 12, 24, 48, 72] as const;

/** Назви подій ClearTG, що йдуть у рекламні кабінети. */
export const CONVERSION_EVENTS = {
  subscribe: 'TG_Subscribe',
  reach: 'TG_Reached_Telegram',
  gift: 'LeadMagnet_Claimed',
} as const;
