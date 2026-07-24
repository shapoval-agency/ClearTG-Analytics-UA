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
