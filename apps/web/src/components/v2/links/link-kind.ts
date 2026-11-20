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
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  creativeTag: string | null;
  postNumber: number | null;
  landingPostUrl: string | null;
  destinationMode?: string;
  destinationUrl?: string | null;
  botConnectionId?: string | null;
  autoRedirect?: boolean;
  channel: { id: string; title: string };
  campaign: { id: string; name: string; adPlatform: string } | null;
  _count: { clickEvents: number };
}

/** Куди веде посилання з мітками (продуктові назви, без технічних режимів). */
export type LinkDestinationKind = 'channel' | 'post' | 'bot' | 'personal';

export function destinationKindOf(mode?: string | null): LinkDestinationKind {
  if (mode === 'PUBLIC_POST') return 'post';
  if (mode === 'CLIENT_BOT_START') return 'bot';
  if (mode === 'PERSONAL_CHAT') return 'personal';
  return 'channel';
}

export const DESTINATION_MODE: Record<LinkDestinationKind, 'INVITE_LINK' | 'PUBLIC_POST' | 'CLIENT_BOT_START' | 'PERSONAL_CHAT'> = {
  channel: 'INVITE_LINK',
  post: 'PUBLIC_POST',
  bot: 'CLIENT_BOT_START',
  personal: 'PERSONAL_CHAT',
};

/** Значення полів посилання, які можна змінити без втрати історії (S2-07). */
export interface EditableLink {
  channelId: string;
  name: string;
  campaignId: string;
  source: string | null;
  destination: LinkDestinationKind;
  postUrl: string;
  personalUrl: string;
  botConnectionId: string;
  measureReach: boolean;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  creativeTag: string;
}

export interface InviteLinkApi {
  id: string;
  name: string | null;
  telegramInviteLink: string;
  isRevoked: boolean;
  createdAt: string;
  channelId?: string;
  channel?: { title: string } | null;
  campaign?: { name: string; adPlatform: string } | null;
}

export interface LinkRowData {
  id: string;
  kind: LinkKind;
  kindLabel: string;
  name: string;
  url: string;
  channelId: string | null;
  channelTitle: string;
  source: string | null;
  campaignName: string | null;
  marks: string[];
  /** Готовий код для встановлення на сайт; лише для посилань з мітками. */
  embedScript: string | null;
  /** null для запрошувальних — Telegram не рахує кліки, і вигадувати нуль не можна. */
  clicks: number | null;
  isActive: boolean;
  statusLabel: string;
  createdAt: string;
  /** Лише для посилань з мітками — їх можна редагувати й дублювати. */
  editable: EditableLink | null;
}

export function normalizeTrackingLink(
  link: TrackingLinkApi,
  appUrl: string,
): LinkRowData {
  const marks: string[] = [];
  if (link.utmSource) marks.push(`utm_source: ${link.utmSource}`);
  if (link.utmMedium) marks.push(`utm_medium: ${link.utmMedium}`);
  if (link.utmCampaign) marks.push(`utm_campaign: ${link.utmCampaign}`);
  if (link.utmContent) marks.push(`utm_content: ${link.utmContent}`);
  if (link.utmTerm) marks.push(`utm_term: ${link.utmTerm}`);
  if (link.creativeTag) marks.push(`креатив: ${link.creativeTag}`);
  const destination = destinationKindOf(link.destinationMode);
  if (link.landingPostUrl) marks.push(`допис: ${link.landingPostUrl}`);
  else if (link.postNumber) marks.push(`допис №${link.postNumber}`);
  if (destination === 'bot') marks.push('веде в бота');
  if (destination === 'personal' && link.destinationUrl) {
    marks.push(`особистий акаунт: ${link.destinationUrl.replace('https://t.me/', '@')}`);
  }
  if (link.autoRedirect === false) marks.push('перехід у Telegram вимірюється');

  const embedScript = `<script src="${appUrl}/cleartg.js" data-slug="${link.slug}" data-app-url="${appUrl}" data-path="${link.publicPath}" defer></script>`;

  return {
    id: link.id,
    kind: 'tracking',
    kindLabel: 'З мітками',
    name: link.name?.trim() || 'Без назви',
    url: `${appUrl}${link.publicPath}`,
    channelId: link.channel.id,
    channelTitle: link.channel.title,
    source: link.campaign?.adPlatform ?? null,
    campaignName: link.campaign?.name ?? null,
    marks,
    embedScript,
    clicks: link._count.clickEvents,
    isActive: link.isActive,
    statusLabel: link.isActive ? 'Активне' : 'Архівне',
    createdAt: link.createdAt,
    editable: {
      channelId: link.channel.id,
      name: link.name ?? '',
      campaignId: link.campaign?.id ?? '',
      source: link.campaign?.adPlatform ?? null,
      destination,
      postUrl: link.landingPostUrl ?? '',
      personalUrl: destination === 'personal' ? link.destinationUrl ?? '' : '',
      botConnectionId: link.botConnectionId ?? '',
      measureReach: link.autoRedirect === false,
      utmSource: link.utmSource ?? '',
      utmMedium: link.utmMedium ?? '',
      utmCampaign: link.utmCampaign ?? '',
      utmContent: link.utmContent ?? '',
      utmTerm: link.utmTerm ?? '',
      creativeTag: link.creativeTag ?? '',
    },
  };
}

export function normalizeInviteLink(link: InviteLinkApi): LinkRowData {
  return {
    id: link.id,
    kind: 'invite',
    kindLabel: 'Запрошувальне',
    name: link.name?.trim() || 'Без назви',
    url: link.telegramInviteLink,
    channelId: link.channelId ?? null,
    channelTitle: link.channel?.title ?? '—',
    source: link.campaign?.adPlatform ?? null,
    campaignName: link.campaign?.name ?? null,
    marks: [],
    embedScript: null,
    clicks: null,
    isActive: !link.isRevoked,
    statusLabel: link.isRevoked ? 'Відкликане' : 'Активне',
    createdAt: link.createdAt,
    editable: null,
  };
}

/** Обидва типи в одному списку, найновіші зверху. */
export function mergeLinkRows(rows: LinkRowData[]): LinkRowData[] {
  return [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** S2-01: фільтр списку посилань за каналом і станом. */
export type LinkStatusFilter = 'all' | 'active' | 'archived';

export function filterLinkRows(
  rows: LinkRowData[],
  filter: { channelId?: string; status: LinkStatusFilter },
): LinkRowData[] {
  return rows.filter((row) => {
    if (filter.channelId && row.channelId !== filter.channelId) return false;
    if (filter.status === 'active') return row.isActive;
    if (filter.status === 'archived') return !row.isActive;
    return true;
  });
}

/** Розбирає рядки масового створення: «назва; креатив» — по одному на рядок. */
export function parseBulkLines(text: string): Array<{ name: string; creativeTag?: string }> {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, creativeTag] = line.split(';').map((part) => part.trim());
      return creativeTag ? { name, creativeTag } : { name };
    })
    .filter((item) => item.name);
}

export function isTelegramPersonalUrl(value: string): boolean {
  return /^https:\/\/t\.me\/[A-Za-z][A-Za-z0-9_]{3,31}\/?$/.test(value.trim());
}

/** Приймає @username або повну адресу, повертає https://t.me/username. */
export function normalizePersonalUrl(value: string): string {
  const v = value.trim();
  if (/^@?[A-Za-z][A-Za-z0-9_]{3,31}$/.test(v)) return `https://t.me/${v.replace(/^@/, '')}`;
  return v;
}
