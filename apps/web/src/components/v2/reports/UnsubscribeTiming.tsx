import { WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { Card, EmptyState } from '@/components/v2/ui';
import { formatPercentUk } from '@/lib/labels';
import type { UnsubscribeTimingReport } from '@/lib/api';

const BUCKETS = [
  { key: 'day1', label: 'Перша доба', color: 'bg-rose-500' },
  { key: 'week', label: '2–7 днів', color: 'bg-amber-400' },
  { key: 'month', label: '8–30 днів', color: 'bg-blue-400' },
  { key: 'later', label: 'Пізніше 30 днів', color: 'bg-emerald-400' },
] as const;

export function UnsubscribeTiming({ report }: { report: UnsubscribeTimingReport }) {
  if (report.total === 0) {
    return (
      <Card title="Коли відписуються" hint="Скільки часу підписники залишаються в каналі">
        <EmptyState
          title="За цей період відписок немає"
          description="Коли з’являться відписки, тут буде видно, чи йдуть люди одразу, протягом тижня або пізніше."
        />
      </Card>
    );
  }

  return (
    <Card title="Коли відписуються" hint="Час від підписки до відписки за обраний період">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-label="Розподіл відписок за строком">
        {BUCKETS.map((bucket) => (
          <span
            key={bucket.key}
            className={bucket.color}
            style={{ width: `${report.buckets[bucket.key].share * 100}%` }}
          />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {BUCKETS.map((bucket) => {
          const value = report.buckets[bucket.key];
          return (
            <div key={bucket.key} className="rounded-2xl bg-slate-50 p-3.5">
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className={`size-2.5 rounded-full ${bucket.color}`} />
                {bucket.label}
              </p>
              <p className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-[#102044]">{value.count}</p>
              <p className="text-xs text-slate-400">{formatPercentUk(value.share)} від відписок</p>
            </div>
          );
        })}
      </div>

      {report.unknown > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            Для {report.unknown} {report.unknown === 1 ? 'відписки' : 'відписок'} немає пов’язаної дати підписки — вони не включені у відсотки вище.
          </p>
        </div>
      )}
    </Card>
  );
}
