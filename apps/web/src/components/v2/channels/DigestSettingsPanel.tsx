'use client';

import { useState, useTransition } from 'react';
import { Check, TelegramLogo } from '@phosphor-icons/react';
import { updateDigestSettingsV2Action } from '@/app/v2/actions';
import { CustomSelect } from '@/components/v2/CustomSelect';
import { Card } from '@/components/v2/ui';
import { TelegramBindButton } from '@/components/TelegramBindButton';
import type { DigestSettings } from '@/lib/api';

type ChannelOption = { id: string; title: string; isActive: boolean };

const FREQUENCIES = [
  { value: 'DAILY', label: 'Щодня' },
  { value: 'WEEKDAYS', label: 'У будні' },
  { value: 'WEEKLY', label: 'Щопонеділка' },
];
const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, '0')}:00`,
}));

export function DigestSettingsPanel({
  initial,
  channels,
}: {
  initial: DigestSettings | null;
  channels: ChannelOption[];
}) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const activeChannels = channels.filter((channel) => channel.isActive);

  if (!settings) return null;

  function toggleChannel(id: string) {
    setSaved(false);
    setSettings((current) => {
      if (!current) return current;
      const selected = current.channelIds.includes(id);
      return {
        ...current,
        channelIds: selected
          ? current.channelIds.filter((channelId) => channelId !== id)
          : [...current.channelIds, id],
      };
    });
  }

  function save() {
    if (!settings) return;
    const current = settings;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateDigestSettingsV2Action({
        enabled: current.enabled,
        frequency: current.frequency,
        hour: current.hour,
        channelIds: current.channelIds,
      });
      if (result.error || !result.settings) {
        setError(result.error ?? 'Не вдалося зберегти налаштування');
        return;
      }
      setSettings(result.settings);
      setSaved(true);
    });
  }

  return (
    <Card className="mb-6" title="Telegram-зведення" hint="Короткий результат періоду, головна зміна та посилання на деталі.">
      {!settings.telegramLinked ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex min-w-0 gap-3">
            <TelegramLogo size={24} weight="fill" className="shrink-0 text-[#229ED9]" aria-hidden="true" />
            <div>
              <p className="font-bold text-[#102044]">Спочатку привʼяжіть Telegram</p>
              <p className="mt-1 text-sm text-slate-600">Після привʼязки бот зможе надсилати персональне зведення.</p>
            </div>
          </div>
          <TelegramBindButton />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="font-bold text-[#102044]">Автоматичне зведення</p>
              <p className="mt-1 text-sm text-slate-500">Час вказано за Києвом.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              onClick={() => { setSaved(false); setSettings({ ...settings, enabled: !settings.enabled }); }}
              className={`relative h-7 w-12 rounded-full transition ${settings.enabled ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${settings.enabled ? 'left-6' : 'left-1'}`} />
              <span className="sr-only">{settings.enabled ? 'Вимкнути зведення' : 'Увімкнути зведення'}</span>
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Частота</span>
              <CustomSelect
                value={settings.frequency}
                options={FREQUENCIES}
                disabled={!settings.enabled}
                onChange={(value) => {
                  setSaved(false);
                  setSettings({ ...settings, frequency: value as DigestSettings['frequency'] });
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Час</span>
              <CustomSelect
                value={String(settings.hour)}
                options={HOURS}
                disabled={!settings.enabled}
                onChange={(value) => {
                  setSaved(false);
                  setSettings({ ...settings, hour: Number(value) });
                }}
              />
            </label>
          </div>

          <fieldset className="mt-4" disabled={!settings.enabled}>
            <legend className="text-sm font-semibold text-slate-700">Канали</legend>
            <p className="mt-1 text-xs text-slate-500">Нічого не обрано — зведення по всіх активних каналах.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {activeChannels.map((channel) => {
                const selected = settings.channelIds.includes(channel.id);
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => toggleChannel(channel.id)}
                    aria-pressed={selected}
                    className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition disabled:opacity-50 ${selected ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                  >
                    <span className={`grid size-5 shrink-0 place-items-center rounded-md border ${selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>
                      {selected && <Check size={13} weight="bold" aria-hidden="true" />}
                    </span>
                    <span className="truncate">{channel.title}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="min-h-11 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? 'Зберігаємо…' : 'Зберегти налаштування'}
            </button>
            {saved && <span className="text-sm font-semibold text-emerald-700">Збережено</span>}
            {error && <span className="text-sm text-rose-700">{error}</span>}
          </div>
        </>
      )}
    </Card>
  );
}
