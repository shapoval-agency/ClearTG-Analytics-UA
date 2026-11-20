'use client';

import { useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import clsx from 'clsx';
import { CustomSelect } from '@/components/v2/CustomSelect';
import type { LinkStatusFilter } from './link-kind';

const STATUS_OPTIONS: Array<{ value: LinkStatusFilter; label: string }> = [
  { value: 'all', label: 'Усі' },
  { value: 'active', label: 'Активні' },
  { value: 'archived', label: 'Архівні' },
];

/** S2-01: посилання кількох каналів не змішуються — фільтр живе в URL. */
export function LinkFilters({
  channels,
  channelId,
  status,
}: {
  channels: Array<{ id: string; title: string }>;
  channelId?: string;
  status: LinkStatusFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function navigate(next: { channelId?: string; status: LinkStatusFilter }) {
    const params = new URLSearchParams();
    if (next.channelId) params.set('channelId', next.channelId);
    if (next.status !== 'all') params.set('status', next.status);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div className={clsx('mb-5 flex flex-col gap-3 sm:flex-row sm:items-center', pending && 'opacity-60')}>
      <div role="group" aria-label="Стан посилань"
        className="flex w-full rounded-xl border border-[#dbe4f0] bg-white p-1 shadow-sm sm:w-auto">
        {STATUS_OPTIONS.map((opt) => (
          <button key={opt.value} type="button" disabled={pending} aria-pressed={opt.value === status}
            onClick={() => navigate({ channelId, status: opt.value })}
            className={clsx(
              'min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:flex-none',
              opt.value === status ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50',
            )}>
            {opt.label}
          </button>
        ))}
      </div>
      {channels.length > 1 && (
        <CustomSelect
          id="v2-links-channel"
          className="w-full sm:w-64"
          value={channelId ?? ''}
          onChange={(value) => navigate({ channelId: value || undefined, status })}
          options={[
            { value: '', label: 'Усі канали' },
            ...channels.map((c) => ({ value: c.id, label: c.title })),
          ]}
        />
      )}
    </div>
  );
}
