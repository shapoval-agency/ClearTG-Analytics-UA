'use client';

import { useState, useTransition } from 'react';
import { createGiftV2Action, updateGiftV2Action } from '@/app/v2/actions';
import { DEFAULT_GIFT_BUTTON, DEFAULT_GIFT_CONSENT, validateGiftForm, type GiftFormValues } from './gift-form';

export interface GiftChannel {
  id: string;
  title: string;
}

/**
 * Створення / редагування подарунка (S4-01, S4-03).
 * Матеріал — посилання, текст або обидва.
 */
export function GiftForm({
  channels,
  initial,
  giftId,
  onDone,
}: {
  channels: GiftChannel[];
  initial?: Partial<GiftFormValues>;
  /** Є — редагування, нема — створення. */
  giftId?: string;
  onDone?: (botLink: string | null) => void;
}) {
  const [values, setValues] = useState<GiftFormValues>({
    channelId: initial?.channelId ?? channels[0]?.id ?? '',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    contentUrl: initial?.contentUrl ?? '',
    contentText: initial?.contentText ?? '',
    buttonText: initial?.buttonText ?? DEFAULT_GIFT_BUTTON,
    consentText: initial?.consentText ?? DEFAULT_GIFT_CONSENT,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof GiftFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateGiftForm(values);
    if (problem) return setError(problem);
    setError(null);
    startTransition(async () => {
      if (giftId) {
        const { channelId: _channelId, ...rest } = values;
        const res = await updateGiftV2Action(giftId, rest);
        if (res.error) return setError(res.error);
        onDone?.(null);
      } else {
        const res = await createGiftV2Action(values);
        if (res.error) return setError(res.error);
        onDone?.(res.botLink);
      }
    });
  }

  const field = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100';
  const label = 'mb-1 block text-sm font-bold text-[#102044]';
  const id = (name: string) => `gift-${giftId ?? 'new'}-${name}`;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!giftId && channels.length > 1 && (
        <div>
          <label htmlFor={id('channel')} className={label}>Канал</label>
          <select id={id('channel')} className={field} value={values.channelId} onChange={set('channelId')}>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">Подарунок отримають лише підписники цього каналу.</p>
        </div>
      )}

      <div>
        <label htmlFor={id('name')} className={label}>Назва подарунка</label>
        <input id={id('name')} className={field} value={values.name} onChange={set('name')} placeholder="Чекліст запуску реклами" maxLength={120} />
      </div>

      <div>
        <label htmlFor={id('description')} className={label}>
          Опис <span className="font-normal text-slate-400">(необов’язково)</span>
        </label>
        <textarea id={id('description')} rows={2} className={field} value={values.description} onChange={set('description')}
          placeholder="Що людина отримає і чим це корисно" maxLength={1000} />
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-3.5">
        <legend className="px-1 text-sm font-bold text-[#102044]">Матеріал — посилання, текст або обидва</legend>
        <div className="space-y-3">
          <div>
            <label htmlFor={id('url')} className="mb-1 block text-sm text-slate-700">Посилання</label>
            <input id={id('url')} type="url" inputMode="url" className={field} value={values.contentUrl} onChange={set('contentUrl')}
              placeholder="https://drive.google.com/…" />
          </div>
          <div>
            <label htmlFor={id('text')} className="mb-1 block text-sm text-slate-700">Текст</label>
            <textarea id={id('text')} rows={3} className={field} value={values.contentText} onChange={set('contentText')}
              placeholder="Наприклад, промокод або інструкція" maxLength={3500} />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id('button')} className={label}>Напис на кнопці</label>
          <input id={id('button')} className={field} value={values.buttonText} onChange={set('buttonText')} maxLength={40} />
        </div>
      </div>

      <div>
        <label htmlFor={id('consent')} className={label}>Що бот скаже перед видачею</label>
        <textarea id={id('consent')} rows={2} className={field} value={values.consentText} onChange={set('consentText')} maxLength={1000} />
        <p className="mt-1 text-xs text-slate-500">Натискання «Отримати» в боті вважається згодою з цим текстом.</p>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={pending}
        className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">
        {pending ? 'Зберігаємо…' : giftId ? 'Зберегти зміни' : 'Створити подарунок'}
      </button>
    </form>
  );
}
