/**
 * Логіка типів посилань у продуктових термінах.
 *
 * Користувач не обирає технічний тип. Він каже, звідки піде трафік, —
 * а який саме механізм використати, вирішує система. Терміни SHORTLINK,
 * LANDING_PAGE, /l/, /r/ у інтерфейс не потрапляють.
 *
 * Чисті функції без React і мережі — перевіряються без браузера.
 */

/** Джерела трафіку, які бачить користувач. Значення = AdPlatform у БД. */
export type TrafficSource =
  | 'META'
  | 'GOOGLE'
  | 'TIKTOK'
  | 'TELEGRAM_ADS'
  | 'INFLUENCER'
  | 'ORGANIC'
  | 'OTHER';

export const TRAFFIC_SOURCES: Array<{ value: TrafficSource; label: string }> = [
  { value: 'META', label: 'Meta Ads' },
  { value: 'GOOGLE', label: 'Google Ads' },
  { value: 'TIKTOK', label: 'TikTok Ads' },
  { value: 'TELEGRAM_ADS', label: 'Telegram' },
  { value: 'INFLUENCER', label: 'Influencer' },
  { value: 'ORGANIC', label: 'Organic' },
  { value: 'OTHER', label: 'Інше' },
];

export function trafficSourceLabel(value?: string | null): string {
  return TRAFFIC_SOURCES.find((s) => s.value === value)?.label ?? value ?? '—';
}

/**
 * Платні платформи. Дублює PAID_AD_PLATFORMS з packages/shared, але свідомо:
 * пакет shared збирається окремо і в apps/web не імпортується напряму.
 * Джерело істини лишається на бекенді — він перевіряє правило ще раз
 * і поверне 400, якщо фронт помилиться.
 */
const PAID: TrafficSource[] = ['META', 'GOOGLE', 'TIKTOK'];

export function isPaidSource(source?: string | null): boolean {
  return PAID.includes(source as TrafficSource);
}

/** Продуктові типи посилань. */
export type LinkKind = 'tracking' | 'invite' | 'plain';

export interface LinkKindOption {
  kind: LinkKind;
  label: string;
  description: string;
  available: boolean;
  /** Чому недоступно — показуємо, а не ховаємо мовчки. */
  unavailableReason?: string;
}

/**
 * Які типи посилань доступні для джерела трафіку.
 *
 * Правила бекенду, які тут відображені:
 *  - запрошувальні посилання заборонені для платного трафіку
 *    (invite-link.service.ts: немає UTM і немає зв'язку клік→підписка);
 *  - звичайне t.me існує лише для каналу з @username.
 */
export function linkKindOptions(
  source: TrafficSource | null,
  channelHasUsername: boolean,
): LinkKindOption[] {
  const paid = isPaidSource(source);

  return [
    {
      kind: 'tracking',
      label: 'Посилання з мітками',
      description:
        'Фіксує клік і мітки, потім показує у звітах, з якої реклами прийшов кожен підписник.',
      available: true,
    },
    {
      kind: 'invite',
      label: 'Запрошувальне посилання',
      description:
        'Telegram сам повідомляє, яке саме посилання використали при вступі. Точно, але без UTM і без обліку кліків.',
      available: source !== null && !paid,
      unavailableReason:
        source === null
          ? 'Спочатку оберіть джерело трафіку.'
          : paid
            ? 'Для Meta, Google і TikTok такі посилання не працюють: у них немає UTM-міток і немає зв’язку між кліком по рекламі й підпискою. Оберіть «Посилання з мітками».'
            : undefined,
    },
    {
      kind: 'plain',
      label: 'Звичайне посилання на канал',
      description:
        'Підписників за цим посиланням не можна точно пов’язати з джерелом — у звітах вони будуть як «джерело не визначене».',
      available: channelHasUsername,
      unavailableReason: channelHasUsername
        ? undefined
        : 'У приватного каналу немає публічного посилання. Скористайтеся запрошувальним посиланням.',
    },
  ];
}

/** Чи потрібна кампанія для цього типу. Для invite бекенд вимагає її обов'язково. */
export function requiresCampaign(kind: LinkKind): boolean {
  return kind === 'invite';
}

// ─── Нормалізація списку ────────────────────────────────────────────
//
// Два ендпоінти повертають різні форми. Зводимо до одного вигляду, щоб
// список не працював із сирими полями двох різних API.

export interface TrackingLinkApi {
  id: string;
  slug: string;
  name: string | null;
  publicPath: string;
  isActive: boolean;
  createdAt: string;
  utmSource: string | null;
  utmCampaign: string | null;
  creativeTag: string | null;
  channel: { id: string; title: string };
  campaign: { id: string; name: string; adPlatform: string } | null;
  _count: { clickEvents: number };
}

export interface InviteLinkApi {
  id: string;
  name: string | null;
  telegramInviteLink: string;
  isRevoked: boolean;
  createdAt: string;
  channel?: { title: string } | null;
  campaign?: { name: string; adPlatform: string } | null;
}

export interface LinkRowData {
  id: string;
  kind: LinkKind;
  kindLabel: string;
  name: string;
  url: string;
  channelTitle: string;
  source: string | null;
  campaignName: string | null;
  marks: string[];
  /** null для запрошувальних — Telegram не рахує кліки, і вигадувати нуль не можна. */
  clicks: number | null;
  isActive: boolean;
  statusLabel: string;
  createdAt: string;
}

export function normalizeTrackingLink(
  link: TrackingLinkApi,
  appUrl: string,
): LinkRowData {
  const marks: string[] = [];
  if (link.utmSource) marks.push(`utm: ${link.utmSource}`);
  if (link.utmCampaign) marks.push(link.utmCampaign);
  if (link.creativeTag) marks.push(`креатив: ${link.creativeTag}`);

  return {
    id: link.id,
    kind: 'tracking',
    kindLabel: 'З мітками',
    name: link.name?.trim() || 'Без назви',
    url: `${appUrl}${link.publicPath}`,
    channelTitle: link.channel.title,
    source: link.campaign?.adPlatform ?? null,
    campaignName: link.campaign?.name ?? null,
    marks,
    clicks: link._count.clickEvents,
    isActive: link.isActive,
    statusLabel: link.isActive ? 'Активне' : 'Архівне',
    createdAt: link.createdAt,
  };
}

export function normalizeInviteLink(link: InviteLinkApi): LinkRowData {
  return {
    id: link.id,
    kind: 'invite',
    kindLabel: 'Запрошувальне',
    name: link.name?.trim() || 'Без назви',
    url: link.telegramInviteLink,
    channelTitle: link.channel?.title ?? '—',
    source: link.campaign?.adPlatform ?? null,
    campaignName: link.campaign?.name ?? null,
    marks: [],
    clicks: null,
    isActive: !link.isRevoked,
    statusLabel: link.isRevoked ? 'Відкликане' : 'Активне',
    createdAt: link.createdAt,
  };
}

/** Обидва типи в одному списку, найновіші зверху. */
export function mergeLinkRows(rows: LinkRowData[]): LinkRowData[] {
  return [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
