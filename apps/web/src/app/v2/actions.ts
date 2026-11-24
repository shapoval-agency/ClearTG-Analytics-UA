'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { setWorkspace } from '@/lib/session';
import { getApiOrigin } from '@/lib/api-origin';
import type { DigestSettings, IntegrationDiagnostics } from '@/lib/api';

const API_URL = getApiOrigin();

/**
 * Перемикання кабінету клієнта в межах нового кабінету.
 *
 * Дублює `switchWorkspaceAction` зі старого `lib/actions.ts` лише через
 * ціль редіректу: там жорстко `/dashboard`, що викидало б користувача
 * назад у старий кабінет. Старий екшен не чіпаємо — на ньому працює
 * старий `WorkspaceSwitcher`.
 */
export async function switchWorkspaceV2Action(workspaceId: string) {
  const jar = await cookies();
  const token = jar.get('cleartg_token')?.value;
  if (!token) redirect('/login');

  await setWorkspace(workspaceId);
  redirect('/v2');
}

/* ─── Канали ──────────────────────────────────────────────────────────
 *
 * Окремі v2-дії, а не переиспользование lib/actions.ts: там
 * `setChannelActiveAction` робить revalidatePath('/channels') — це не
 * оновить /v2/channels. Старі дії не чіпаємо, на них працює старий кабінет.
 *
 * Все звернення до API — тільки з сервера. Клієнтський fetch через
 * проксі /api/[...path] не проходить авторизацію: JwtAuthGuard читає лише
 * заголовок Authorization, а браузер шле cookie (див. v2-channels-plan.md).
 */

/**
 * Заголовки авторизації.
 *
 * `Content-Type: application/json` НЕ додається за замовчуванням: Fastify
 * відхиляє запит без тіла з цим заголовком —
 * «Body cannot be empty when content-type is set to 'application/json'».
 * Для PATCH-ів без тіла (archive/activate) це давало 400.
 */
async function channelHeaders(withJsonBody = false) {
  const jar = await cookies();
  const token = jar.get('cleartg_token')?.value;
  const workspaceId = jar.get('cleartg_workspace')?.value;
  if (!token || !workspaceId) return null;
  return {
    ...(withJsonBody ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
    'x-workspace-id': workspaceId,
  };
}

/**
 * Текст помилки від бекенду — але тільки якщо він придатний для людини.
 *
 * Наші власні повідомлення написані українською («Канал не знайдено…»,
 * «Бот не є адміном цього каналу»). Технічні помилки Fastify/Nest —
 * англійською й користувачу нічого не пояснюють. Показуємо лише перші,
 * решту замінюємо на зрозумілий fallback.
 */
async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  const message = (Array.isArray(body.message) ? body.message.join('. ') : body.message)?.trim();
  if (message && /[\u0400-\u04FF]/.test(message)) return message;
  return fallback;
}

/** Архівація або відновлення каналу. Дані нікуди не діваються. */
export async function setChannelActiveV2Action(id: string, isActive: boolean) {
  const headers = await channelHeaders();  // без тіла — без Content-Type
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.' };

  const res = await fetch(
    `${API_URL}/api/channels/${id}/${isActive ? 'activate' : 'archive'}`,
    { method: 'PATCH', headers },
  );

  if (!res.ok) {
    return {
      error: await readError(
        res,
        isActive ? 'Не вдалося відновити канал' : 'Не вдалося архівувати канал',
      ),
    };
  }

  revalidatePath('/v2/channels');
  return { error: null };
}

/**
 * Жива перевірка прав бота в Telegram.
 *
 * Навмисно окрема дія «по кнопці», а не частина завантаження списку:
 * бекенд робить реальний виклик getChatMember на кожен канал, і перевірка
 * всіх каналів при кожному відкритті сторінки впиралася б у ліміти Telegram.
 */
export async function checkChannelStatusV2Action(id: string) {
  const headers = await channelHeaders();
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.', check: null };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/channels/${id}/bot-status`, { headers, cache: 'no-store' });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.', check: null };
  }

  if (!res.ok) {
    return { error: await readError(res, 'Не вдалося перевірити канал'), check: null };
  }

  const check = (await res.json()) as {
    isAdmin: boolean;
    canInviteUsers: boolean;
    canManageChat: boolean;
    issues: string[];
    ready: boolean;
  };

  revalidatePath('/v2/channels');
  return { error: null, check };
}

/** S2-17: одна явна дія запускає живу перевірку всіх доступів і посилань. */
export async function runIntegrationDiagnosticsV2Action() {
  const headers = await channelHeaders();
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.', diagnostics: null };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/channels/diagnostics`, {
      method: 'POST',
      headers,
      cache: 'no-store',
    });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.', diagnostics: null };
  }
  if (!res.ok) {
    return { error: await readError(res, 'Не вдалося виконати діагностику'), diagnostics: null };
  }
  const diagnostics = (await res.json()) as IntegrationDiagnostics;
  revalidatePath('/v2/channels');
  return { error: null, diagnostics };
}

/** S2-25: зберігає персональний розклад Telegram-зведення для workspace. */
export async function updateDigestSettingsV2Action(data: Omit<DigestSettings, 'telegramLinked'>) {
  const headers = await channelHeaders(true);
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.', settings: null };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/telegram/digest-settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.', settings: null };
  }
  if (!res.ok) {
    return { error: await readError(res, 'Не вдалося зберегти налаштування'), settings: null };
  }
  const settings = (await res.json()) as DigestSettings;
  revalidatePath('/v2/channels');
  return { error: null, settings };
}

/** Підключення каналу вручну — за @username або chat id. */
export async function connectChannelV2Action(identifier: string) {
  const headers = await channelHeaders(true);  // POST з тілом
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.' };

  const username = identifier.trim().replace(/^@/, '');
  if (!username) return { error: 'Введіть @username або chat id каналу' };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/channels/sync-telegram`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ username }),
    });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.' };
  }

  if (!res.ok) {
    return { error: await readError(res, 'Не вдалося підключити канал') };
  }

  revalidatePath('/v2/channels');
  return { error: null };
}

/* ─── Посилання ───────────────────────────────────────────────────────
 *
 * `linkMode` навмисно НЕ передається: бекенд виводить його з платформи
 * кампанії (link-mode.ts) і відхилить неприпустиму комбінацію. Фронт не
 * дублює це правило як джерело істини — лише ховає недоступні варіанти.
 */

/** Кампанія створюється прямо в конструкторі — окремого розділу немає (DEC-005). */
export async function createCampaignV2Action(data: {
  channelId: string;
  name: string;
  adPlatform: string;
}) {
  const headers = await channelHeaders(true);
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.', campaign: null };

  const name = data.name.trim();
  if (!name) return { error: 'Вкажіть назву кампанії', campaign: null };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channelId: data.channelId, name, adPlatform: data.adPlatform }),
    });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.', campaign: null };
  }

  if (!res.ok) {
    return { error: await readError(res, 'Не вдалося створити кампанію'), campaign: null };
  }

  const campaign = (await res.json()) as { id: string; name: string; adPlatform: string };
  revalidatePath('/v2/links');
  return { error: null, campaign };
}

/** Куди веде посилання з мітками. */
export type LinkDestination = 'INVITE_LINK' | 'PUBLIC_POST' | 'CLIENT_BOT_START' | 'PERSONAL_CHAT';

export interface TrackingLinkInput {
  channelId: string;
  campaignId?: string;
  name?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  creativeTag?: string;
  destinationMode?: LinkDestination;
  landingPostUrl?: string;
  /** S2-05: https://t.me/username особистого акаунта. */
  destinationUrl?: string;
  /** S2-03: підключений бот клієнта. */
  botConnectionId?: string;
  /** S2-11: false — сторінка з кнопкою, перехід у Telegram вимірюється. */
  autoRedirect?: boolean;
  /** S3-13: > 0 — швидка сторінка переходу з рекламними тегами. */
  redirectDelayMs?: number;
}

const LINK_STRING_KEYS = [
  'channelId', 'campaignId', 'name', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm',
  'creativeTag', 'destinationMode', 'landingPostUrl', 'destinationUrl', 'botConnectionId',
] as const;

/** Порожні рядки не відправляємо — інакше в БД осядуть порожні мітки. */
function linkPayload(data: TrackingLinkInput) {
  const payload: Record<string, string | boolean | number> = {};
  for (const key of LINK_STRING_KEYS) {
    const value = data[key]?.trim();
    if (value) payload[key] = value;
  }
  if (data.autoRedirect !== undefined) payload.autoRedirect = data.autoRedirect;
  if (data.redirectDelayMs !== undefined) payload.redirectDelayMs = data.redirectDelayMs;
  return payload;
}

/** Посилання з мітками. */
export async function createTrackingLinkV2Action(data: TrackingLinkInput) {
  const headers = await channelHeaders(true);
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.', link: null };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/tracking-links`, {
      method: 'POST',
      headers,
      body: JSON.stringify(linkPayload(data)),
    });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.', link: null };
  }

  if (!res.ok) {
    return { error: await readError(res, 'Не вдалося створити посилання'), link: null };
  }

  const link = (await res.json()) as { publicPath: string; slug: string };
  revalidatePath('/v2/links');
  return { error: null, link };
}

/** S2-09: кілька посилань однією операцією — або всі, або жодного. */
export async function createTrackingLinksBulkV2Action(
  base: TrackingLinkInput,
  items: Array<{ name: string; creativeTag?: string }>,
) {
  const headers = await channelHeaders(true);
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.', links: null };

  const cleanItems = items
    .map((item) => ({ name: item.name.trim(), creativeTag: item.creativeTag?.trim() || undefined }))
    .filter((item) => item.name);
  if (cleanItems.length === 0) return { error: 'Додайте хоча б одну назву посилання', links: null };
  if (cleanItems.length > 50) return { error: 'За раз можна створити до 50 посилань', links: null };

  const { name: _ignored, ...shared } = linkPayload(base);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/tracking-links/bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ base: shared, items: cleanItems }),
    });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.', links: null };
  }
  if (!res.ok) {
    return { error: await readError(res, 'Не вдалося створити посилання'), links: null };
  }
  const links = (await res.json()) as Array<{ publicPath: string; name: string | null }>;
  revalidatePath('/v2/links');
  return { error: null, links };
}

/**
 * S2-07 / S2-18: редагування. `null` очищає поле. Адреса, канал і історія
 * не змінюються — бекенд не приймає ці поля.
 */
export async function updateTrackingLinkV2Action(
  id: string,
  data: Partial<Record<Exclude<(typeof LINK_STRING_KEYS)[number], 'channelId'>, string | null>> & {
    autoRedirect?: boolean;
    redirectDelayMs?: number;
  },
) {
  const headers = await channelHeaders(true);
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.' };

  const payload: Record<string, string | boolean | number | null> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    payload[key] = typeof value === 'string' ? value.trim() || null : value;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/tracking-links/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.' };
  }
  if (!res.ok) return { error: await readError(res, 'Не вдалося зберегти зміни') };

  revalidatePath('/v2/links');
  revalidatePath('/v2/reports');
  return { error: null };
}

/* ─── Бот клієнта (S2-02) ─────────────────────────────────────────── */

export async function connectClientBotV2Action(token: string) {
  const headers = await channelHeaders(true);
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.' };
  const clean = token.trim();
  if (clean.length < 20) return { error: 'Вставте повний токен бота від @BotFather' };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/client-bots`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token: clean }),
    });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.' };
  }
  if (!res.ok) return { error: await readError(res, 'Не вдалося підключити бота') };

  revalidatePath('/v2/channels');
  revalidatePath('/v2/links');
  return { error: null };
}

export async function disconnectClientBotV2Action(id: string) {
  const headers = await channelHeaders();
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.' };

  const res = await fetch(`${API_URL}/api/client-bots/${id}`, { method: 'DELETE', headers });
  if (!res.ok) return { error: await readError(res, 'Не вдалося відключити бота') };

  revalidatePath('/v2/channels');
  revalidatePath('/v2/links');
  return { error: null };
}

/* ─── Заявки на вступ (S2-14 / S2-15) ─────────────────────────────── */

export async function updateJoinRequestSettingsV2Action(
  channelId: string,
  data: { joinRequestsEnabled?: boolean; autoApproveJoinRequests?: boolean },
) {
  const headers = await channelHeaders(true);
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.' };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/channels/${channelId}/join-requests`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.' };
  }
  if (!res.ok) return { error: await readError(res, 'Не вдалося зберегти налаштування') };

  revalidatePath('/v2/channels');
  return { error: null };
}

/**
 * Запрошувальне посилання.
 *
 * Бекенд робить живий виклик createChatInviteLink — якщо бот втратив права,
 * повертається зрозуміла українська помилка, яку показуємо як є.
 */
export async function createSeedInviteLinkV2Action(data: {
  channelId: string;
  campaignId: string;
  name: string;
}) {
  const headers = await channelHeaders(true);
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.', link: null };

  const name = data.name.trim();
  if (!name) return { error: 'Вкажіть назву джерела для цього посилання', link: null };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/invite-links`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channelId: data.channelId, campaignId: data.campaignId, name }),
    });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.', link: null };
  }

  if (!res.ok) {
    return { error: await readError(res, 'Не вдалося створити посилання'), link: null };
  }

  const link = (await res.json()) as { telegramInviteLink: string };
  revalidatePath('/v2/links');
  return { error: null, link };
}

/** Архівація посилання з мітками. Історія кліків зберігається. */
export async function setTrackingLinkActiveV2Action(id: string, isActive: boolean) {
  const headers = await channelHeaders();
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.' };

  const res = await fetch(
    `${API_URL}/api/tracking-links/${id}/${isActive ? 'activate' : 'archive'}`,
    { method: 'PATCH', headers },
  );

  if (!res.ok) {
    return {
      error: await readError(
        res,
        isActive ? 'Не вдалося відновити посилання' : 'Не вдалося архівувати посилання',
      ),
    };
  }

  revalidatePath('/v2/links');
  return { error: null };
}

/** Відкликання запрошувального посилання — Telegram перестає приймати по ньому вступ. */
export async function revokeInviteLinkV2Action(id: string) {
  const headers = await channelHeaders();
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.' };

  const res = await fetch(`${API_URL}/api/invite-links/${id}/revoke`, {
    method: 'PATCH',
    headers,
  });

  if (!res.ok) {
    return { error: await readError(res, 'Не вдалося відкликати посилання') };
  }

  revalidatePath('/v2/links');
  return { error: null };
}

/* ─── Реклама (етап 03) ───────────────────────────────────────────── */

export type AdPlatformKey = 'meta' | 'ga4' | 'google-ads';

export interface IntegrationCheckResult {
  ok: boolean;
  checkedAt: string;
  checks: Array<{ id: string; label: string; status: 'ok' | 'warning' | 'error'; detail: string }>;
}

async function adsRequest<T>(path: string, init: RequestInit & { json?: unknown }, fallback: string) {
  const headers = await channelHeaders(init.json !== undefined);
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.', data: null as T | null };
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      cache: 'no-store',
    });
  } catch {
    return { error: 'Сервіс аналітики не відповідає. Спробуйте ще раз.', data: null as T | null };
  }
  if (!res.ok) return { error: await readError(res, fallback), data: null as T | null };
  const data = (await res.json().catch(() => null)) as T | null;
  revalidatePath('/v2/ads');
  return { error: null, data };
}

/** Збереження даних підключення. Відправка після цього вимкнена до перевірки (S3-01, S3-05). */
export async function saveAdIntegrationV2Action(platform: AdPlatformKey, data: Record<string, string>) {
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value.trim()) payload[key] = value.trim();
  }
  const res = await adsRequest(`/api/integrations/${platform}`, { method: 'POST', json: payload }, 'Не вдалося зберегти підключення');
  return { error: res.error };
}

export async function verifyAdIntegrationV2Action(platform: AdPlatformKey) {
  const res = await adsRequest<IntegrationCheckResult>(
    `/api/integrations/${platform}/verify`, { method: 'POST' }, 'Не вдалося виконати перевірку',
  );
  return { error: res.error, check: res.data };
}

/** S3-03: увімкнути GA4, Ads або обидва. Вмикання — лише після успішної перевірки (бекенд). */
export async function setAdIntegrationActiveV2Action(platform: AdPlatformKey, isActive: boolean) {
  const res = await adsRequest(`/api/integrations/${platform}/active`, { method: 'POST', json: { isActive } },
    isActive ? 'Не вдалося увімкнути відправку' : 'Не вдалося вимкнути відправку');
  return { error: res.error };
}

export async function sendAdTestEventV2Action(platform: AdPlatformKey) {
  const res = await adsRequest<{ success: boolean; error?: string; skipped?: boolean }>(
    `/api/integrations/${platform}/test-event`, { method: 'POST' }, 'Не вдалося надіслати тестову подію',
  );
  if (res.error) return { error: res.error };
  if (!res.data?.success) {
    return {
      error: res.data?.skipped
        ? 'Тестова подія не пішла: спершу увімкніть відправку для цієї системи.'
        : 'Рекламна система відхилила тестову подію. Перевірте дані підключення.',
    };
  }
  return { error: null };
}

export async function googleAdsAuthUrlV2Action() {
  const res = await adsRequest<{ url: string }>('/api/integrations/google-ads/auth-url', { method: 'GET' },
    'Не вдалося почати вхід через Google');
  return { error: res.error, url: res.data?.url ?? null };
}

export interface ConversionSettings {
  conversionDelayHours: number;
  skipQuickUnsubscribes: boolean;
  sendReachEvent: boolean;
  sendGiftEvent: boolean;
  connected: string[];
  last30Days: Record<string, number>;
  byEvent: Array<{ eventName: string; status: string; count: number }>;
  recentFailures: Array<{ platform: string; eventName: string; error: string | null; at: string }>;
}

export async function updateConversionSettingsV2Action(data: Partial<Pick<ConversionSettings,
  'conversionDelayHours' | 'skipQuickUnsubscribes' | 'sendReachEvent' | 'sendGiftEvent'>>) {
  const res = await adsRequest<ConversionSettings>('/api/conversion-settings', { method: 'PUT', json: data },
    'Не вдалося зберегти налаштування');
  return { error: res.error };
}
