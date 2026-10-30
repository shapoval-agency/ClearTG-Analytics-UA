'use client';

import { useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import clsx from 'clsx';
import { CustomSelect } from '@/components/v2/CustomSelect';
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
    <div className={clsx('mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center', pending && 'opacity-60')}>
      <div
        role="group"
        aria-label="Період"
        className="flex max-w-full overflow-x-auto rounded-xl border border-[#dbe4f0] bg-white p-1 shadow-sm"
      >
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={pending}
            aria-pressed={opt.value === period}
            onClick={() => navigate({ period: opt.value, channelId })}
            className={clsx(
              'min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:flex-none',
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
        <div className="sm:ml-auto sm:min-w-60">
          <label className="sr-only" htmlFor="v2-reports-channel">
            Канал
          </label>
          <CustomSelect
            id="v2-reports-channel"
            disabled={pending}
            value={channelId ?? ''}
            onChange={(value) => navigate({ period, channelId: value || undefined })}
            align="end"
            options={[
              { value: '', label: 'Усі канали' },
              ...channels.map((channel) => ({
                value: channel.id,
                label: `${channel.title}${!channel.isActive ? ' (архів)' : ''}`,
              })),
            ]}
          />
        </div>
      )}
    </div>
  );
}
