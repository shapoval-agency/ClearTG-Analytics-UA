'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { updateConversionSettingsV2Action, type ConversionSettings } from '@/app/v2/actions';
import { Card } from '@/components/v2/ui';
import { CustomSelect } from '@/components/v2/CustomSelect';

const DELAY_OPTIONS = [0, 1, 3, 6, 12, 24, 48, 72];

function delayLabel(hours: number) {
  if (hours === 0) return 'Одразу після підписки';
  if (hours < 24) return `Через ${hours} год`;
  return `Через ${hours / 24} ${hours === 24 ? 'добу' : 'доби'}`;
}

/**
 * Що і коли йде в рекламні кабінети (етап 03).
 * S3-09 затримка, S3-10 відсів швидких відписок, S3-12 і S3-16 — додаткові цілі.
 */
export function ConversionSettingsPanel({ initial }: { initial: ConversionSettings }) {
  const [pending, startTransition] = useTransition();
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function save(patch: Partial<ConversionSettings>) {
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setError(null);
    startTransition(async () => {
      const res = await updateConversionSettingsV2Action(patch);
      if (res.error) {
        setError(res.error);
        setSettings(previous);
      }
    });
  }

  const toggleRow = (
    key: 'skipQuickUnsubscribes' | 'sendReachEvent' | 'sendGiftEvent',
    title: string,
    text: React.ReactNode,
  ) => (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
      <input type="checkbox" className="mt-1" disabled={pending} checked={settings[key]}
        onChange={(e) => save({ [key]: e.target.checked })} />
      <span className="min-w-0">
        <span className="block font-medium text-slate-900">{title}</span>
        <span className="block text-slate-500">{text}</span>
      </span>
    </label>
  );

  return (
    <Card title="Що передаємо в рекламу" hint="Реклама вчиться на тих, кого ви їй покажете — тож показуємо лише справжніх підписників">
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <span className="font-medium">Головна ціль — «Підписка».</span>{' '}
          Відправляється лише підписка, пов’язана з рекламним кліком. Органіку й «джерело не визначено» ми не передаємо.
        </div>

        <div>
          <label htmlFor="conversion-delay" className="mb-1 block text-sm font-bold text-[#102044]">
            Коли відправляти підписку
          </label>
          <CustomSelect
            id="conversion-delay"
            className="w-full sm:w-72"
            value={String(settings.conversionDelayHours)}
            onChange={(v) => save({ conversionDelayHours: Number(v) })}
            options={DELAY_OPTIONS.map((h) => ({ value: String(h), label: delayLabel(h) }))}
          />
          <p className="mt-1 text-xs text-slate-500">
            Затримка дає час відсіяти тих, хто підписався і одразу пішов. Але реклама отримує сигнал пізніше —
            для старту зазвичай вистачає 1–6 годин. Якщо в кампанії задана власна затримка, діє вона.
          </p>
        </div>

        {toggleRow(
          'skipQuickUnsubscribes',
          'Не передавати тих, хто вже відписався',
          'Перед відправкою перевіряємо, чи людина ще в каналі. Разом із затримкою це прибирає «підписався й пішов» з навчання реклами.',
        )}
        {toggleRow(
          'sendReachEvent',
          'Окрема ціль «Дійшов до Telegram»',
          <>
            Окрема подія, коли людина справді відкрила Telegram. Працює лише для посилань зі сторінкою з кнопкою
            («Як відкривати Telegram» у <Link href="/v2/links" className="underline">посиланні</Link>). У Google Ads потрібна окрема дія-конверсія.
          </>,
        )}
        {toggleRow(
          'sendGiftEvent',
          'Окрема ціль «Забрав подарок»',
          'Подія, коли підписник отримав лід-магніт у боті. Такі люди цінніші — реклама вчиться шукати схожих. У Google Ads потрібна окрема дія-конверсія.',
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </Card>
  );
}
