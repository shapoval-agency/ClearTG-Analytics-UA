export type TelegramChatType = 'private' | 'group' | 'supergroup' | 'channel' | string;

/** Канали та супергрупи — де ми бачимо chat_member/my_chat_member і рахуємо підписки/відписки. */
const TRACKABLE_CHAT_TYPES = new Set<TelegramChatType>(['channel', 'supergroup']);

export function isTrackableChatType(chatType: TelegramChatType): boolean {
  return TRACKABLE_CHAT_TYPES.has(chatType);
}

const BOT_ADMIN_STATUSES = new Set(['administrator', 'creator']);

export function isBotAdminStatus(status: string): boolean {
  return BOT_ADMIN_STATUSES.has(status);
}

export interface BotStatusTransition {
  oldStatus: string;
  newStatus: string;
}

/** Бота щойно зробили адміном (був не-адміном, став адміном). */
export function didBotBecomeAdmin(t: BotStatusTransition): boolean {
  return !isBotAdminStatus(t.oldStatus) && isBotAdminStatus(t.newStatus);
}

/** Бота прибрали з адмінів (був адміном, перестав бути). */
export function didBotLoseAdmin(t: BotStatusTransition): boolean {
  return isBotAdminStatus(t.oldStatus) && !isBotAdminStatus(t.newStatus);
}

export interface BotAdminRights {
  status: string;
  can_invite_users?: boolean;
}

/**
 * true, якщо бот адмін, але без права створювати запрошення —
 * без цього права per-click invite-посилання (точна атрибуція) не працюють.
 */
export function isMissingInvitePermission(rights: BotAdminRights): boolean {
  if (rights.status !== 'administrator') return false;
  return rights.can_invite_users !== true;
}

export interface RecentSubscriberRow {
  username: string | null;
  telegramUserId: string;
  channelTitle: string;
  subscribedAt: Date;
  isActive: boolean;
}

/** Текст для кнопки «Останні підписники» в боті — конкретні люди, а не лише агрегат. */
export function formatRecentSubscribersList(rows: RecentSubscriberRow[], now: Date = new Date()): string {
  if (rows.length === 0) return 'Ще немає підписників.';

  const lines = rows.map((r) => {
    const who = r.username ? `@${r.username}` : `id ${r.telegramUserId}`;
    const status = r.isActive ? '✅' : '❌';
    const days = Math.max(0, Math.floor((now.getTime() - r.subscribedAt.getTime()) / 86_400_000));
    return `${status} ${who} — ${r.channelTitle}, ${r.subscribedAt.toLocaleString('uk-UA')} (${days} дн.)`;
  });

  return `👥 Останні підписники:\n\n${lines.join('\n')}`;
}
