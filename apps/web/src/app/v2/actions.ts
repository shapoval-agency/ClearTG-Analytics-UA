'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { setWorkspace } from '@/lib/session';
import { getApiOrigin } from '@/lib/api-origin';

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

/** Посилання з мітками. */
export async function createTrackingLinkV2Action(data: {
  channelId: string;
  campaignId?: string;
  name?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  creativeTag?: string;
}) {
  const headers = await channelHeaders(true);
  if (!headers) return { error: 'Сесія завершилася. Увійдіть знову.', link: null };

  // Порожні рядки не відправляємо — інакше в БД осядуть порожні мітки.
  const payload: Record<string, string> = { channelId: data.channelId };
  for (const key of [
    'campaignId', 'name', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'creativeTag',
  ] as const) {
    const value = data[key]?.trim();
    if (value) payload[key] = value;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/tracking-links`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
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
