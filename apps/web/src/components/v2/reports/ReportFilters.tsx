'use client';

import { useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import clsx from 'clsx';
import { PERIOD_OPTIONS, type ReportPeriod } from './period';

export interface ReportFilterChannel {
  id: string;
  title: string;
  isActive: boolean;
}

/**
 * Фільтри «Звітів» — тільки період і канал, як просить бриф.
 *
 * Стан живе в URL (`?period=&channelId=`), а не в React state: сторінка —
 * серверний компонент, дані вантажаться під конкретні query-параметри. Зміна
 * фільтра — це навігація на нову URL, а не client-side refetch.
 */
export function ReportFilters({
  channels,
  period,
  channelId,
}: {
  channels: ReportFilterChannel[];
  period: ReportPeriod;
  channelId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function navigate(next: { period: ReportPeriod; channelId?: string }) {
    const params = new URLSearchParams();
    if (next.period !== 'all') params.set('period', next.period);
    if (next.channelId) params.set('channelId', next.channelId);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className={clsx('flex flex-wrap items-center gap-3 mb-6', pending && 'opacity-60')}>
      <div
        role="group"
        aria-label="Період"
        className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
      >
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={pending}
            aria-pressed={opt.value === period}
            onClick={() => navigate({ period: opt.value, channelId })}
            className={clsx(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              opt.value === period
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {channels.length > 1 && (
        <div>
          <label className="sr-only" htmlFor="v2-reports-channel">
            Канал
          </label>
          <select
            id="v2-reports-channel"
            disabled={pending}
            value={channelId ?? ''}
            onChange={(e) => navigate({ period, channelId: e.target.value || undefined })}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
          >
            <option value="">Усі канали</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {!c.isActive ? ' (архів)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
