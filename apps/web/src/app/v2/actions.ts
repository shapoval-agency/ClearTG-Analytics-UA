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
