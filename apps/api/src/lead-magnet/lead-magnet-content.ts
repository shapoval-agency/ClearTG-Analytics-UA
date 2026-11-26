/**
 * Чисті функції подарунків (S4-01, S4-03, S4-04): тексти бота, дані кнопок
 * і зведення «хто забрав» по джерелах. Без мережі й БД — щоб перевіряти тестами.
 */

/** Префікс callback-кнопки «Отримати» в боті. */
export const CLAIM_CALLBACK_PREFIX = 'lm_claim:';
/** Telegram обмежує callback_data 64 байтами — slug у нас 10 символів. */
export function claimCallbackData(slug: string): string {
  return `${CLAIM_CALLBACK_PREFIX}${slug}`;
}

export function parseClaimCallback(data: string | undefined): string | null {
  if (!data?.startsWith(CLAIM_CALLBACK_PREFIX)) return null;
  const slug = data.slice(CLAIM_CALLBACK_PREFIX.length);
  return /^[a-zA-Z0-9_-]{4,40}$/.test(slug) ? slug : null;
}

export function giftStartPayload(slug: string): string {
  return `lm_${slug}`;
}

export function giftBotLink(botUsername: string, slug: string): string {
  return `https://t.me/${botUsername}?start=${giftStartPayload(slug)}`;
}

export interface GiftContent {
  name: string;
  description?: string | null;
  contentUrl?: string | null;
  contentText?: string | null;
  consentText: string;
}

/** Перше повідомлення бота: що за подарунок і що буде після натискання. */
export function giftIntroText(gift: GiftContent): string {
  return [
    `🎁 ${gift.name}`,
    gift.description?.trim(),
    gift.consentText.trim(),
    'Натисніть «Отримати» — якщо ви підписані на канал, матеріал прийде одразу.',
    'Відписатися від повідомлень бота: /stop',
  ].filter(Boolean).join('\n\n');
}

/** Сам матеріал: текст і/або посилання (S4-03). */
export function giftDeliveryText(gift: GiftContent, alreadyClaimed = false): string {
  const parts = [
    alreadyClaimed ? 'Ви вже отримали цей матеріал — ось він ще раз:' : 'Дякуємо! Ось ваш матеріал:',
    gift.contentText?.trim(),
    gift.contentUrl?.trim(),
  ].filter(Boolean);
  if (parts.length === 1) parts.push('Матеріал ще не додано — напишіть адміністратору каналу.');
  return parts.join('\n\n');
}

export const NOT_SUBSCRIBED_TEXT =
  'Спершу підпишіться на канал, потім натисніть «Отримати» ще раз. Ми нікого не додаємо в канал автоматично.';

/** Підпис джерела для звіту — як у «Звітах»: посилання → кампанія → тип атрибуції. */
export function claimSourceLabel(input: {
  hasProfile: boolean;
  trackingLinkName?: string | null;
  campaignName?: string | null;
  attributionType?: string | null;
}): string {
  if (!input.hasProfile) return 'Підписались до підключення бота';
  if (input.trackingLinkName) return input.trackingLinkName;
  if (input.campaignName) return input.campaignName;
  if (input.attributionType === 'ORGANIC') return 'Органіка';
  return 'Джерело не визначене';
}

export interface SourceRow {
  source: string;
  subscribers: number;
  claims: number;
  /** Частка тих, хто забрав, від підписників джерела; null — підписників у періоді немає. */
  claimRate: number | null;
}

/**
 * S4-04: забираємість по джерелах. `subscribers` — підписки з моменту
 * створення подарунка; `claims` — отримання (зокрема від старих підписників).
 */
export function aggregateClaimsBySource(
  subscriberSources: string[],
  claimSources: string[],
): SourceRow[] {
  const rows = new Map<string, SourceRow>();
  const row = (source: string) => {
    let r = rows.get(source);
    if (!r) {
      r = { source, subscribers: 0, claims: 0, claimRate: null };
      rows.set(source, r);
    }
    return r;
  };
  for (const s of subscriberSources) row(s).subscribers += 1;
  for (const s of claimSources) row(s).claims += 1;
  for (const r of rows.values()) {
    r.claimRate = r.subscribers > 0 ? Math.min(1, r.claims / r.subscribers) : null;
  }
  return [...rows.values()].sort((a, b) => b.claims - a.claims || b.subscribers - a.subscribers);
}
