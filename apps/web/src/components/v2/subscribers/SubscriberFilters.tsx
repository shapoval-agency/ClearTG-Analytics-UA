'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import clsx from 'clsx';

const STATUS_OPTIONS: Array<{ value?: 'active' | 'left'; label: string }> = [
  { value: undefined, label: 'Усі' },
  { value: 'active', label: 'Активні' },
  { value: 'left', label: 'Неактивні' },
];

/**
 * Фільтри «Учасників» — тільки пошук і статус, як просить бриф. Стан живе в
 * URL (`?search=&status=`), той самий підхід, що й у `ReportFilters` з
 * `/v2/reports`: сторінка лишається серверним компонентом, зміна фільтра —
 * навігація на нову URL.
 */
export function SubscriberFilters({
  search,
  status,
}: {
  search?: string;
  status?: 'active' | 'left';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(search ?? '');

  function navigate(next: { search?: string; status?: 'active' | 'left' }) {
    const params = new URLSearchParams();
    if (next.search) params.set('search', next.search);
    if (next.status) params.set('status', next.status);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className={clsx('flex flex-wrap items-center gap-3 mb-6', pending && 'opacity-60')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: query.trim() || undefined, status });
        }}
        className="flex items-center gap-2"
      >
        <label className="sr-only" htmlFor="v2-subscribers-search">
          Пошук за ім&apos;ям або Telegram ID
        </label>
        <input
          id="v2-subscribers-search"
          type="search"
          value={query}
          disabled={pending}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ім'я або Telegram ID…"
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-56 bg-white"
        />
        <button
          type="submit"
          disabled={pending}
          className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          Знайти
        </button>
      </form>

      <div role="group" aria-label="Статус" className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.value === status;
          return (
            <button
              key={opt.label}
              type="button"
              disabled={pending}
              aria-pressed={active}
              onClick={() => navigate({ search, status: opt.value })}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
