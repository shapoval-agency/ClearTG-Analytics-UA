/**
 * Продуктовий статус каналу.
 *
 * Правило з ТЗ: користувачу не показуються технічні поля. `isActive` і
 * `botIsAdmin` — це стан у нашій БД, а людині потрібна відповідь на три
 * питання: працює чи ні, чому, і що робити.
 *
 * Чиста функція без React і мережі — щоб логіку «який стан показати»
 * можна було перевірити без браузера.
 */

export type ChannelStatus = 'working' | 'attention' | 'archived' | 'error';

export interface ChannelStatusView {
  status: ChannelStatus;
  label: string;
  /** Що це означає для користувача — без термінів Telegram API. */
  meaning: string;
  tone: 'ok' | 'warn' | 'error' | 'neutral';
}

/** Поля, які реально повертає GET /api/channels. */
export interface ChannelStatusInput {
  isActive: boolean;
  botIsAdmin: boolean;
}

/**
 * Статус зі збережених полів — миттєво, без звернення до Telegram.
 * Використовується для списку.
 */
export function deriveChannelStatus(channel: ChannelStatusInput): ChannelStatusView {
  if (!channel.isActive) {
    return {
      status: 'archived',
      label: 'Відключено',
      meaning: 'Збір зупинено. Історія підписок і відписок збережена.',
      tone: 'neutral',
    };
  }

  if (!channel.botIsAdmin) {
    return {
      status: 'attention',
      label: 'Потребує уваги',
      meaning:
        'Бот не адміністратор каналу — Telegram не повідомляє нам про підписки й відписки.',
      tone: 'warn',
    };
  }

  return {
    status: 'working',
    label: 'Працює',
    meaning: 'Підписки й відписки фіксуються автоматично.',
    tone: 'ok',
  };
}

/** Відповідь GET /api/channels/:id/bot-status. */
export interface BotStatusResponse {
  isAdmin: boolean;
  canInviteUsers: boolean;
  canManageChat: boolean;
  issues: string[];
  ready: boolean;
}

/**
 * Уточнення статусу після живої перевірки.
 *
 * Канал може числитися робочим у БД, але право «Додавання учасників» бути
 * вимкненим — тоді точне визначення джерела підписки не працює. У списку
 * цього не видно, бо GET /api/channels не повертає canInviteUsers.
 */
export function deriveStatusFromBotCheck(
  check: BotStatusResponse,
  isActive: boolean,
): ChannelStatusView {
  if (!isActive) return deriveChannelStatus({ isActive: false, botIsAdmin: check.isAdmin });

  if (!check.isAdmin) {
    return {
      status: 'attention',
      label: 'Потребує уваги',
      meaning:
        'Бот не адміністратор каналу — Telegram не повідомляє нам про підписки й відписки.',
      tone: 'warn',
    };
  }

  if (!check.canInviteUsers) {
    return {
      status: 'attention',
      label: 'Потребує уваги',
      meaning:
        'Бот адміністратор, але без права «Додавання учасників». Підписки видно, а точне джерело кожної — ні.',
      tone: 'warn',
    };
  }

  return {
    status: 'working',
    label: 'Працює',
    meaning: 'Бот має всі потрібні права. Джерело кожної підписки визначається точно.',
    tone: 'ok',
  };
}

/**
 * Що робити користувачу. Порожній масив = дій не потрібно.
 * Тексти беруться з issues[] бекенду, якщо вони є — вони вже українською
 * і написані під користувача.
 */
export function statusActionHints(check?: BotStatusResponse | null): string[] {
  if (check?.issues?.length) return check.issues;
  return [];
}
