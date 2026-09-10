'use client';

import { useState, useTransition } from 'react';
import {
  setTrackingLinkActiveV2Action,
  revokeInviteLinkV2Action,
} from '@/app/v2/actions';
import { Badge } from '@/components/v2/ui';
import { formatDateUk } from '@/lib/labels';
import { CopyButton } from './CopyButton';
import { trafficSourceLabel, type LinkRowData } from './link-kind';

/**
 * Рядок списку посилань.
 *
 * Показує назву, тип, канал, джерело, кампанію, мітки, дату і стан.
 * Внутрішні id, slug і технічні режими не показуються.
 */
export function LinkRow({ row }: { row: LinkRowData }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  function archive(next: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setTrackingLinkActiveV2Action(row.id, next);
      if (res.error) setError(res.error);
    });
  }

  function revoke() {
    setError(null);
    startTransition(async () => {
      const res = await revokeInviteLinkV2Action(row.id);
      if (res.error) setError(res.error);
      setConfirmingRevoke(false);
    });
  }

  return (
    <article className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-slate-900">{row.name}</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {row.channelTitle}
            {row.source && ` · ${trafficSourceLabel(row.source)}`}
            {row.campaignName && ` · ${row.campaignName}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{row.kindLabel}</Badge>
          <Badge tone={row.isActive ? 'ok' : 'neutral'}>{row.statusLabel}</Badge>
        </div>
      </div>

      <p className="font-mono text-sm text-brand-700 break-all mt-3">{row.url}</p>

      {row.marks.length > 0 && (
        <p className="text-sm text-slate-500 mt-2">{row.marks.join(' · ')}</p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-slate-400">
        {/* clicks === null для запрошувальних: Telegram не рахує кліки, нуль був би брехнею */}
        {row.clicks !== null && <span>{row.clicks} кліків</span>}
        <span>{formatDateUk(row.createdAt)}</span>
      </div>

      {error && (
        <p className="text-sm text-red-700 mt-3">{error}</p>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        {confirmingRevoke ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-900 font-medium">Відкликати «{row.name}»?</p>
            <p className="text-sm text-amber-800 mt-1">
              Telegram перестане приймати вступ за цим посиланням. Уже отримані підписки
              та їх джерело залишаться у звітах. Відновити посилання не можна.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" disabled={pending} onClick={revoke}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50">
                {pending ? 'Відкликаємо…' : 'Так, відкликати'}
              </button>
              <button type="button" disabled={pending} onClick={() => setConfirmingRevoke(false)}
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100">
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <CopyButton value={row.url} />
            {row.kind === 'tracking' && row.isActive && (
              <button type="button" disabled={pending} onClick={() => archive(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50">
                {pending ? 'Архівуємо…' : 'Архівувати'}
              </button>
            )}
            {row.kind === 'tracking' && !row.isActive && (
              <button type="button" disabled={pending} onClick={() => archive(true)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {pending ? 'Відновлюємо…' : 'Відновити'}
              </button>
            )}
            {row.kind === 'invite' && row.isActive && (
              <button type="button" disabled={pending} onClick={() => setConfirmingRevoke(true)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50">
                Відкликати
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
