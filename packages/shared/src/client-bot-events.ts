import type { BotStatusTransition } from './telegram-events';

const START_CLICK_PREFIX = 'click_';

/**
 * Дістає clickId з /start payload виду "click_{clickId}" — це і є "короткий код"
 * замість повного набору UTM (Telegram обмежує payload 64 символами). Самі мітки
 * лежать у ClickEvent у базі, у посиланні їде лише id.
 */
export function parseClickStartPayload(payload: string): string | null {
  if (!payload.startsWith(START_CLICK_PREFIX)) return null;
  const clickId = payload.slice(START_CLICK_PREFIX.length).trim();
  return clickId.length > 0 ? clickId : null;
}

/**
 * Для приватного чату з ботом my_chat_member.new_chat_member.status === 'kicked'
 * означає саме "користувач заблокував бота" (а не бан у звичайному сенсі).
 */
export function didUserBlockBot(t: BotStatusTransition): boolean {
  return t.oldStatus !== 'kicked' && t.newStatus === 'kicked';
}

export function didUserUnblockBot(t: BotStatusTransition): boolean {
  return t.oldStatus === 'kicked' && t.newStatus !== 'kicked';
}

/**
 * Що робити, якщо клієнтський бот не зміг стартувати (polling).
 *
 * - `token_invalid` — токен відкликано або бота видалено (401/404): вимикаємо
 *   і просимо перепідключити.
 * - `webhook_conflict` — у бота налаштований чужий webhook: polling неможливий,
 *   поки клієнт сам його не прибере. Вимикаємо з поясненням.
 * - `retry` — усе інше, зокрема 409 «terminated by other getUpdates request»:
 *   під час деплою старий процес ще опитує Telegram. Це тимчасово — повторюємо.
 */
export type BotStartFailure = 'token_invalid' | 'webhook_conflict' | 'retry';

export function classifyBotStartError(error: { code?: number; description?: string }): BotStartFailure {
  const description = (error.description ?? '').toLowerCase();
  if (error.code === 401 || error.code === 404) return 'token_invalid';
  if (error.code === 409 && description.includes('webhook')) return 'webhook_conflict';
  return 'retry';
}

/** Паузи між повторними спробами старту, секунди (~8 хв загалом — довше за будь-який деплой). */
export const BOT_START_RETRY_DELAYS_SEC = [5, 15, 30, 60, 120, 240] as const;

/** Бот, якого вимкнула тимчасова помилка (а не відкликаний токен) — його можна відновити автоматично. */
export function isRecoverableBotError(lastError: string | null | undefined): boolean {
  if (!lastError) return false;
  const e = lastError.toLowerCase();
  return e.includes('409') && !e.includes('webhook');
}

/**
 * Позначка в lastError: токен бота не розшифровується (зашифрований іншим
 * ENCRYPTION_KEY, наприклад до міграції сервера). Відновити можна лише
 * повторним введенням токена — автоматично такий бот не піднімаємо.
 */
export const BOT_TOKEN_UNREADABLE = 'TOKEN_UNREADABLE';
