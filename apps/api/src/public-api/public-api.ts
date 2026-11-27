/**
 * Чиста логіка публічного API (S4-12, S4-13) — без Nest і Prisma, щоб
 * перевіряти тестами.
 */
import { createHash, randomBytes } from 'crypto';

export const API_KEY_PREFIX = 'ctg_';
export const API_RATE_LIMIT_PER_MINUTE = 60;
export const MAX_API_KEYS_PER_WORKSPACE = 10;

/** Ключ показується людині один раз; у базі лежить лише його SHA-256. */
export function generateApiKey(): string {
  return API_KEY_PREFIX + randomBytes(24).toString('base64url');
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Ключ з `Authorization: Bearer ctg_…` або `X-Api-Key: ctg_…`. */
export function extractApiKey(headers: Record<string, string | string[] | undefined>): string | null {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim();
  const auth = first(headers.authorization);
  const candidate = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : first(headers['x-api-key']);
  if (!candidate || !candidate.startsWith(API_KEY_PREFIX) || candidate.length > 100) return null;
  return candidate;
}

export type LookupQuery = { telegramUserId: string } | { username: string };

/**
 * Хто шукається: Telegram ID (надійно) або @username (запасний варіант —
 * людина може його змінити). Повертає текст помилки для 400, якщо запит кривий.
 */
export function parseLookupQuery(q: { telegram_user_id?: string; username?: string }): LookupQuery | { error: string } {
  const id = q.telegram_user_id?.trim();
  if (id) {
    if (!/^\d{1,20}$/.test(id)) return { error: 'telegram_user_id must be a number' };
    return { telegramUserId: id };
  }
  const username = q.username?.trim().replace(/^@/, '');
  if (username) {
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) return { error: 'username must be a Telegram username (3–32 letters, digits or _)' };
    return { username };
  }
  return { error: 'Pass telegram_user_id or username' };
}

export type SourceType = 'tracking_link' | 'campaign' | 'organic' | 'unknown';
export type SourceConfidence = 'exact' | 'probable' | null;

export interface SubscriptionRow {
  occurredAt: Date;
  channel: { id: string; title: string; username: string | null };
  attribution: {
    attributionType: 'EXACT_CLICK_INVITE' | 'CAMPAIGN_INVITE' | 'PROBABILISTIC' | 'ORGANIC' | 'UNKNOWN';
    trackingLink: {
      id: string;
      name: string | null;
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
      utmContent: string | null;
      utmTerm: string | null;
    } | null;
    campaign: { id: string; name: string } | null;
  } | null;
}

export interface SubscriptionDto {
  channel: { id: string; title: string; username: string | null };
  subscribed_at: string;
  still_subscribed: boolean;
  source: {
    type: SourceType;
    confidence: SourceConfidence;
    tracking_link: { id: string; name: string | null } | null;
    campaign: { id: string; name: string } | null;
    utm: Record<string, string> | null;
  };
}

function confidenceOf(type: NonNullable<SubscriptionRow['attribution']>['attributionType']): SourceConfidence {
  if (type === 'EXACT_CLICK_INVITE' || type === 'CAMPAIGN_INVITE') return 'exact';
  if (type === 'PROBABILISTIC') return 'probable';
  return null;
}

/**
 * Джерело однієї підписки. Не вгадуємо: немає атрибуції або вона UNKNOWN —
 * відповідаємо `unknown`.
 */
export function toSubscriptionDto(row: SubscriptionRow, stillSubscribed: boolean): SubscriptionDto {
  const a = row.attribution;
  const link = a?.trackingLink ?? null;
  const campaign = a?.campaign ?? null;
  let type: SourceType = 'unknown';
  if (a && a.attributionType !== 'UNKNOWN') {
    if (link) type = 'tracking_link';
    else if (campaign) type = 'campaign';
    else if (a.attributionType === 'ORGANIC') type = 'organic';
  }

  const utmEntries = link
    ? ([
        ['source', link.utmSource],
        ['medium', link.utmMedium],
        ['campaign', link.utmCampaign],
        ['content', link.utmContent],
        ['term', link.utmTerm],
      ].filter(([, v]) => v) as [string, string][])
    : [];

  return {
    channel: row.channel,
    subscribed_at: row.occurredAt.toISOString(),
    still_subscribed: stillSubscribed,
    source: {
      type,
      confidence: type === 'unknown' || !a ? null : confidenceOf(a.attributionType),
      tracking_link: type === 'unknown' || !link ? null : { id: link.id, name: link.name },
      campaign: type === 'unknown' ? null : campaign,
      utm: type === 'unknown' || utmEntries.length === 0 ? null : Object.fromEntries(utmEntries),
    },
  };
}

/**
 * Чи людина досі в каналі: остання відписка в цьому каналі не пізніша
 * за підписку.
 */
export function isStillSubscribed(subscribedAt: Date, unsubscribes: Date[]): boolean {
  return !unsubscribes.some((u) => u.getTime() >= subscribedAt.getTime());
}
