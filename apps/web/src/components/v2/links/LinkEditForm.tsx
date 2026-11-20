'use client';

import { useMemo, useState, useTransition } from 'react';
import { updateTrackingLinkV2Action } from '@/app/v2/actions';
import { CustomSelect } from '@/components/v2/CustomSelect';
import type { BuilderBot, BuilderCampaign } from './LinkBuilder';
import {
  DESTINATION_MODE,
  isTelegramPersonalUrl,
  normalizePersonalUrl,
  type EditableLink,
  type LinkDestinationKind,
} from './link-kind';

const DESTINATION_LABELS: Record<LinkDestinationKind, string> = {
  channel: 'Канал',
  post: 'Конкретний допис',
  bot: 'Ваш бот',
  personal: 'Особистий акаунт',
};

/**
 * S2-07 / S2-18: редагування посилання без втрати історії.
 *
 * Адреса посилання, канал і вже зібрана статистика не змінюються. Зміна
 * того, КУДИ веде посилання, — небезпечна дія: її наслідки пояснюються до
 * збереження, а не «Ви впевнені?».
 */
export function LinkEditForm({
  linkId,
  value,
  campaigns,
  bots,
  clicks,
  onDone,
}: {
  linkId: string;
  value: EditableLink;
  campaigns: BuilderCampaign[];
  bots: BuilderBot[];
  clicks: number;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EditableLink>(value);
  const [confirmed, setConfirmed] = useState(false);

  const set = <K extends keyof EditableLink>(key: K, next: EditableLink[K]) =>
    setForm((prev) => ({ ...prev, [key]: next }));

  const channelCampaigns = useMemo(
    () => campaigns.filter((c) => c.channelId === value.channelId),
    [campaigns, value.channelId],
  );
  const activeBots = bots.filter((b) => b.isActive || b.id === value.botConnectionId);

  const destinationChanged =
    form.destination !== value.destination ||
    (form.destination === 'post' && form.postUrl.trim() !== value.postUrl) ||
    (form.destination === 'personal' && normalizePersonalUrl(form.personalUrl) !== value.personalUrl) ||
    (form.destination === 'bot' && form.botConnectionId !== value.botConnectionId);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.destination === 'post' && !form.postUrl.trim()) {
      setError('Вкажіть адресу допису');
      return;
    }
    if (form.destination === 'personal' && !isTelegramPersonalUrl(normalizePersonalUrl(form.personalUrl))) {
      setError('Вкажіть особистий акаунт як @username або https://t.me/username');
      return;
    }
    if (form.destination === 'bot' && !form.botConnectionId) {
      setError('Оберіть бота');
      return;
    }
    if (destinationChanged && clicks > 0 && !confirmed) {
      setError('Підтвердьте зміну напрямку посилання нижче');
      return;
    }

    startTransition(async () => {
      const res = await updateTrackingLinkV2Action(linkId, {
        name: form.name,
        campaignId: form.campaignId || null,
        utmSource: form.utmSource,
        utmMedium: form.utmMedium,
        utmCampaign: form.utmCampaign,
        utmContent: form.utmContent,
        utmTerm: form.utmTerm,
        creativeTag: form.creativeTag,
        destinationMode: DESTINATION_MODE[form.destination],
        landingPostUrl: form.destination === 'post' ? form.postUrl : null,
        destinationUrl: form.destination === 'personal' ? normalizePersonalUrl(form.personalUrl) : null,
        botConnectionId: form.destination === 'bot' ? form.botConnectionId : null,
        autoRedirect: !form.measureReach,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone();
    });
  }

  const field = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm';
  const labelCls = 'mb-1 block text-xs font-bold text-[#102044]';

  return (
    <form onSubmit={save} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
      <p className="text-xs text-slate-500">
        Адреса посилання й канал не змінюються — реклама, де воно вже стоїть, продовжить працювати,
        а зібрані кліки й підписки залишаться з цим посиланням.
      </p>

      <div>
        <label className={labelCls} htmlFor={`edit-name-${linkId}`}>Назва</label>
        <input id={`edit-name-${linkId}`} className={field} value={form.name}
          onChange={(e) => set('name', e.target.value)} />
      </div>

      <div>
        <label className={labelCls} htmlFor={`edit-campaign-${linkId}`}>Кампанія</label>
        <CustomSelect
          id={`edit-campaign-${linkId}`}
          value={form.campaignId}
          onChange={(v) => set('campaignId', v)}
          options={[
            { value: '', label: 'Без кампанії' },
            ...channelCampaigns.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>

      <div>
        <label className={labelCls} htmlFor={`edit-destination-${linkId}`}>Куди веде</label>
        <CustomSelect
          id={`edit-destination-${linkId}`}
          value={form.destination}
          onChange={(v) => { set('destination', v as LinkDestinationKind); setConfirmed(false); }}
          options={(Object.keys(DESTINATION_LABELS) as LinkDestinationKind[])
            .filter((d) => d !== 'bot' || activeBots.length > 0)
            .map((d) => ({ value: d, label: DESTINATION_LABELS[d] }))}
        />
        {form.destination === 'post' && (
          <input className={`${field} mt-2`} type="url" value={form.postUrl} placeholder="https://t.me/channel/123"
            onChange={(e) => set('postUrl', e.target.value)} aria-label="Адреса допису" />
        )}
        {form.destination === 'personal' && (
          <input className={`${field} mt-2`} value={form.personalUrl} placeholder="@manager"
            onChange={(e) => set('personalUrl', e.target.value)} aria-label="Особистий акаунт" />
        )}
        {form.destination === 'bot' && (
          <div className="mt-2">
            <CustomSelect
              value={form.botConnectionId}
              onChange={(v) => set('botConnectionId', v)}
              options={[
                { value: '', label: 'Оберіть бота…' },
                ...activeBots.map((b) => ({ value: b.id, label: `@${b.botUsername}` })),
              ]}
            />
          </div>
        )}
      </div>

      {destinationChanged && clicks > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Що зміниться після збереження</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>Нові кліки поведуть у «{DESTINATION_LABELS[form.destination]}», а не туди, куди вели раніше.</li>
            <li>Адреса посилання та всі {clicks} кліків і їхні підписки залишаться у звітах без змін.</li>
            <li>Якщо цю адресу вставлено на сайт чи в рекламу — перевірте, що новий напрямок їм відповідає.</li>
          </ul>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Розумію, змінити напрямок
          </label>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={form.measureReach}
          onChange={(e) => set('measureReach', e.target.checked)} />
        <span>
          <span className="font-medium text-slate-900">Перевіряти перехід у Telegram</span>
          <span className="block text-xs text-slate-500">
            Сторінка з кнопкою замість миттєвого переходу — тоді «Дійшли до Telegram» рахується чесно.
            Діє на нові кліки.
          </span>
        </span>
      </label>

      <details>
        <summary className="cursor-pointer text-sm text-slate-600">Мітки для звітів</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {([
            ['utmSource', 'utm_source'],
            ['utmMedium', 'utm_medium'],
            ['utmCampaign', 'utm_campaign'],
            ['utmContent', 'utm_content'],
            ['utmTerm', 'utm_term'],
            ['creativeTag', 'Креатив'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className={labelCls} htmlFor={`edit-${key}-${linkId}`}>{label}</label>
              <input id={`edit-${key}-${linkId}`} className={field} value={form[key]}
                onChange={(e) => set(key, e.target.value)} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Нові мітки діють на наступні кліки. Уже зібрані кліки зберігають мітки, з якими прийшли.
        </p>
      </details>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? 'Зберігаємо…' : 'Зберегти'}
        </button>
        <button type="button" disabled={pending} onClick={onDone}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-white">
          Скасувати
        </button>
      </div>
    </form>
  );
}
