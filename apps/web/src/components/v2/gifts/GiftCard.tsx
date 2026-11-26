'use client';

import { useState, useTransition } from 'react';
import { giftStatsV2Action, publishGiftV2Action, updateGiftV2Action, type GiftStats } from '@/app/v2/actions';
import { Badge } from '@/components/v2/ui';
import { CopyButton } from '@/components/v2/links/CopyButton';
import { GiftForm, type GiftChannel } from './GiftForm';
import { defaultPostText, formatRate } from './gift-form';

export interface GiftItem {
  id: string;
  name: string;
  description: string | null;
  contentUrl: string | null;
  contentText: string | null;
  buttonText: string;
  consentText: string;
  isActive: boolean;
  botLink: string;
  channel: { id: string; title: string };
  _count: { claims: number };
}

type Panel = null | 'edit' | 'publish' | 'stats';

/** Один подарунок: посилання, публікація в канал, забираємість (S4-01, S4-04). */
export function GiftCard({ gift, channels }: { gift: GiftItem; channels: GiftChannel[] }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<React.ReactNode>(null);
  const [postText, setPostText] = useState(() => defaultPostText(gift));
  const [stats, setStats] = useState<GiftStats | null>(null);

  function open(next: Panel) {
    setError(null);
    setNotice(null);
    setPanel(panel === next ? null : next);
    if (next === 'stats' && panel !== 'stats') {
      startTransition(async () => {
        const res = await giftStatsV2Action(gift.id);
        if (res.error) return setError(res.error);
        setStats(res.stats);
      });
    }
  }

  function toggleActive() {
    setError(null);
    startTransition(async () => {
      const res = await updateGiftV2Action(gift.id, { isActive: !gift.isActive });
      if (res.error) setError(res.error);
    });
  }

  function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!postText.trim()) return setError('Напишіть текст поста');
    setError(null);
    startTransition(async () => {
      const res = await publishGiftV2Action(gift.id, postText);
      if (res.error) return setError(res.error);
      setPanel(null);
      setNotice(res.postUrl
        ? <>Пост опубліковано: <a href={res.postUrl} target="_blank" rel="noreferrer" className="underline">{res.postUrl}</a></>
        : 'Пост опубліковано в канал.');
    });
  }

  const tab = (key: Exclude<Panel, null>, label: string) => (
    <button type="button" onClick={() => open(key)} aria-expanded={panel === key}
      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${panel === key ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
      {label}
    </button>
  );

  return (
    <article className="min-w-0 rounded-[18px] border border-[#dbe4f0] bg-white p-4 shadow-[0_10px_34px_rgba(20,52,110,0.055)] sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[#102044] sm:text-lg">🎁 {gift.name}</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {gift.channel.title} · забрали: <span className="font-semibold tabular-nums text-slate-800">{gift._count.claims}</span>
          </p>
        </div>
        <Badge tone={gift.isActive ? 'ok' : 'neutral'}>{gift.isActive ? 'Видається' : 'Вимкнено'}</Badge>
      </header>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5">
        <code className="min-w-0 flex-1 truncate text-xs text-slate-700 sm:text-sm" title={gift.botLink}>{gift.botLink}</code>
        <CopyButton value={gift.botLink} />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        Посилання для кнопки під вашим постом або в рекламі. Людина відкриє бота, натисне «Отримати» — і отримає матеріал, якщо підписана.
      </p>

      <div className="mt-3 flex flex-wrap gap-1">
        {tab('publish', 'Опублікувати пост')}
        {tab('stats', 'Хто забрав')}
        {tab('edit', 'Змінити')}
        <button type="button" onClick={toggleActive} disabled={pending}
          className="rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50">
          {gift.isActive ? 'Вимкнути' : 'Увімкнути'}
        </button>
      </div>

      {panel === 'publish' && (
        <form onSubmit={publish} className="mt-3 space-y-3 rounded-xl border border-slate-200 p-3.5">
          <label htmlFor={`post-${gift.id}`} className="block text-sm font-bold text-[#102044]">Текст поста</label>
          <textarea id={`post-${gift.id}`} rows={4} value={postText} onChange={(e) => setPostText(e.target.value)} maxLength={4000}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
          <p className="text-xs text-slate-500">
            Бот опублікує пост у «{gift.channel.title}» з кнопкою «{gift.buttonText}». Боту потрібне право «Публікація повідомлень».
          </p>
          <button type="submit" disabled={pending || !gift.isActive}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">
            {pending ? 'Публікуємо…' : 'Опублікувати в канал'}
          </button>
          {!gift.isActive && <p className="text-sm text-amber-700">Подарунок вимкнено — увімкніть його перед публікацією.</p>}
        </form>
      )}

      {panel === 'stats' && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3.5">
          {!stats ? (
            <p className="text-sm text-slate-500">{pending ? 'Рахуємо…' : 'Немає даних'}</p>
          ) : (
            <>
              <dl className="grid grid-cols-3 gap-3">
                <div><dt className="text-xs text-slate-500">Нових підписників</dt><dd className="text-xl font-bold tabular-nums">{stats.subscribers}</dd></div>
                <div><dt className="text-xs text-slate-500">Забрали</dt><dd className="text-xl font-bold tabular-nums">{stats.claims}</dd></div>
                <div><dt className="text-xs text-slate-500">Частка</dt><dd className="text-xl font-bold tabular-nums">{formatRate(stats.claimRate)}</dd></div>
              </dl>
              <p className="mt-1 text-xs text-slate-500">
                Нові підписники — з дня створення подарунка. «Забрали» включає і тих, хто був підписаний раніше.
              </p>
              {stats.bySource.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th className="py-1.5 pr-3 font-medium">Джерело</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Підписники</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Забрали</th>
                        <th className="py-1.5 text-right font-medium">Частка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.bySource.map((r) => (
                        <tr key={r.source} className="border-t border-slate-100">
                          <td className="max-w-[220px] truncate py-1.5 pr-3" title={r.source}>{r.source}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{r.subscribers}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{r.claims}</td>
                          <td className="py-1.5 text-right tabular-nums">{formatRate(r.claimRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {panel === 'edit' && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3.5">
          <GiftForm
            channels={channels}
            giftId={gift.id}
            initial={{
              channelId: gift.channel.id,
              name: gift.name,
              description: gift.description ?? '',
              contentUrl: gift.contentUrl ?? '',
              contentText: gift.contentText ?? '',
              buttonText: gift.buttonText,
              consentText: gift.consentText,
            }}
            onDone={() => { setPanel(null); setNotice('Збережено.'); }}
          />
        </div>
      )}

      {notice && <p className="mt-3 text-sm text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </article>
  );
}
