/** Чиста логіка форми подарунка — без React, щоб перевіряти тестами. */

export interface GiftFormValues {
  channelId: string;
  name: string;
  description: string;
  contentUrl: string;
  contentText: string;
  buttonText: string;
  consentText: string;
}

export const DEFAULT_GIFT_BUTTON = 'Отримати подарунок';
export const DEFAULT_GIFT_CONSENT =
  'Отримуючи матеріал, ви погоджуєтесь отримувати повідомлення від цього бота. Відписатися можна будь-коли командою /stop.';

/** Повертає текст першої помилки або null, якщо все гаразд. */
export function validateGiftForm(v: GiftFormValues): string | null {
  if (!v.channelId) return 'Оберіть канал';
  if (v.name.trim().length < 2) return 'Напишіть назву подарунка';
  const url = v.contentUrl.trim();
  if (!url && !v.contentText.trim()) return 'Додайте посилання або текст матеріалу';
  if (url && !/^https?:\/\/\S+\.\S+/i.test(url)) return 'Посилання має починатися з https://';
  if (!v.buttonText.trim()) return 'Напишіть напис на кнопці';
  if (v.consentText.trim().length < 10) return 'Текст перед видачею — щонайменше 10 символів';
  return null;
}

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

/** Готовий текст поста: назва й опис подарунка. */
export function defaultPostText(gift: { name: string; description: string | null }): string {
  return [`🎁 ${gift.name}`, gift.description?.trim()].filter(Boolean).join('\n\n');
}
