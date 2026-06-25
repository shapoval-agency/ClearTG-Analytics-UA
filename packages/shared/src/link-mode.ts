export type AdPlatformKey =
  | 'META'
  | 'GOOGLE'
  | 'TIKTOK'
  | 'TELEGRAM_ADS'
  | 'INFLUENCER'
  | 'ORGANIC'
  | 'DIRECT'
  | 'OTHER';

export type LinkMode = 'LANDING_PAGE' | 'SHORTLINK';

export const PAID_AD_PLATFORMS: AdPlatformKey[] = ['META', 'GOOGLE', 'TIKTOK'];

export const SHORTLINK_ALLOWED_PLATFORMS: AdPlatformKey[] = [
  'INFLUENCER',
  'ORGANIC',
  'TELEGRAM_ADS',
  'DIRECT',
  'OTHER',
];

export function isPaidAdPlatform(platform?: string | null): boolean {
  return PAID_AD_PLATFORMS.includes(platform as AdPlatformKey);
}

export function isShortlinkAllowed(platform?: string | null): boolean {
  if (!platform) return false;
  return SHORTLINK_ALLOWED_PLATFORMS.includes(platform as AdPlatformKey);
}

export function resolveDefaultLinkMode(platform?: string | null): LinkMode {
  if (isPaidAdPlatform(platform)) return 'LANDING_PAGE';
  if (isShortlinkAllowed(platform)) return 'SHORTLINK';
  return 'LANDING_PAGE';
}

export function validateLinkModeForPlatform(
  linkMode: LinkMode,
  platform?: string | null,
): { valid: boolean; reason?: string } {
  if (linkMode === 'SHORTLINK') {
    if (isPaidAdPlatform(platform)) {
      return {
        valid: false,
        reason: 'SHORTLINK заборонений для paid traffic (Meta, Google, TikTok). Використовуйте LANDING_PAGE.',
      };
    }
    if (!isShortlinkAllowed(platform)) {
      return {
        valid: false,
        reason: 'SHORTLINK дозволений лише для influencer, organic, Telegram placements.',
      };
    }
  }
  if (linkMode === 'LANDING_PAGE' && isPaidAdPlatform(platform)) {
    return { valid: true };
  }
  return { valid: true };
}

export function getPublicLinkPath(linkMode: LinkMode, slug: string): string {
  return linkMode === 'SHORTLINK' ? `/r/${slug}` : `/l/${slug}`;
}
