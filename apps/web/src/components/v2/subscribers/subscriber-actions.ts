import type { SubscriberDossier } from '@/lib/api';

export interface SubscriberAction {
  key: string;
  label: string;
  /** null — подія без точної дати (наприклад, перевірка утримання). */
  at: string | null;
  tone: 'neutral' | 'ok' | 'warn';
}

const CONVERSION_STATUS: Record<string, string> = {
  SENT: 'передано в рекламний кабінет',
  PENDING: 'чекає відправки в рекламний кабінет',
  FAILED: 'не вдалося передати в рекламний кабінет',
};

/**
 * S2-22: ключові дії людини одним хронологічним списком — від кліку до
 * утримання. Лише факти з досьє: якщо щось не вимірювалось (утримання ще не
 * перевірено, перехід у Telegram не вимірюється), рядка немає.
 */
export function buildSubscriberActions(dossier: SubscriberDossier): SubscriberAction[] {
  const actions: SubscriberAction[] = [];
  const attr = dossier.attribution;

  if (attr?.clickedAt) {
    const linkName = attr.trackingLinkName?.trim() || attr.campaign;
    actions.push({
      key: 'click',
      label: linkName ? `Клік по посиланню «${linkName}»` : 'Клік по рекламному посиланню',
      at: attr.clickedAt,
      tone: 'neutral',
    });
  }
  if (attr?.telegramOpenedAt && attr.reachTracked !== false) {
    actions.push({ key: 'reach', label: 'Відкрив Telegram', at: attr.telegramOpenedAt, tone: 'neutral' });
  }
  actions.push({ key: 'subscribe', label: `Підписався на «${dossier.channel.title}»`, at: dossier.subscribedAt, tone: 'ok' });

  for (const claim of dossier.leadMagnets) {
    actions.push({ key: `lm-${claim.slug}-${claim.claimedAt}`, label: `Отримав лід-магніт «${claim.name}»`, at: claim.claimedAt, tone: 'ok' });
  }
  for (const conversion of dossier.conversions) {
    const status = CONVERSION_STATUS[conversion.status] ?? 'не передається в рекламний кабінет';
    actions.push({
      key: `conv-${conversion.eventName}-${conversion.eventTime}`,
      label: `Конверсія «${conversion.eventName}» — ${status}`,
      at: conversion.eventTime,
      tone: conversion.status === 'FAILED' ? 'warn' : 'neutral',
    });
  }
  for (const unsubscribe of dossier.unsubscribes) {
    actions.push({ key: `unsub-${unsubscribe.id}`, label: 'Відписався', at: unsubscribe.occurredAt, tone: 'warn' });
  }

  const retention: Array<[boolean | null, string]> = [
    [dossier.retainedD1, '1 день'],
    [dossier.retainedD7, '7 днів'],
    [dossier.retainedD30, '30 днів'],
  ];
  for (const [kept, period] of retention) {
    if (kept === null) continue;
    actions.push({
      key: `ret-${period}`,
      label: kept ? `Залишався в каналі через ${period}` : `Не залишився в каналі до ${period}`,
      at: null,
      tone: kept ? 'ok' : 'warn',
    });
  }
  if (dossier.botStarted) {
    actions.push({
      key: 'bot',
      label: dossier.botOptedOut ? 'Запускав бота, потім заблокував' : 'Запустив бота',
      at: null,
      tone: dossier.botOptedOut ? 'warn' : 'ok',
    });
  }

  return actions.sort((a, b) => {
    if (a.at && b.at) return new Date(a.at).getTime() - new Date(b.at).getTime();
    if (a.at) return -1;
    if (b.at) return 1;
    return 0;
  });
}
