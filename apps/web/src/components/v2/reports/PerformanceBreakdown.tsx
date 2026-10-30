import { Card, EmptyState } from '@/components/v2/ui';
import { formatPercentUk } from '@/lib/labels';
import type { PerformanceBreakdownRow } from './report-breakdowns';

export function PerformanceBreakdown({
  title,
  hint,
  primaryHeading,
  emptyTitle,
  emptyDescription,
  rows,
}: {
  title: string;
  hint: string;
  primaryHeading: string;
  emptyTitle: string;
  emptyDescription: string;
  rows: PerformanceBreakdownRow[];
}) {
  if (rows.length === 0) {
    return (
      <Card title={title} hint={hint}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </Card>
    );
  }

  return (
    <Card title={title} hint={hint}>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => {
          const remaining = row.subscribers - row.unsubscribes;
          return (
            <article key={row.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="break-words font-bold text-[#102044]">{row.label}</p>
              <p className="mt-1 text-xs text-slate-500">{row.source} · {row.campaign}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><dt className="text-xs text-slate-400">Кліки</dt><dd className="font-bold">{row.clicks}</dd></div>
                <div><dt className="text-xs text-slate-400">Дійшли</dt><dd className="font-bold">{row.reached} · {row.clicks > 0 ? formatPercentUk(row.reached / row.clicks) : '—'}</dd></div>
                <div><dt className="text-xs text-slate-400">Підписки</dt><dd className="font-bold">{row.subscribers}</dd></div>
                <div><dt className="text-xs text-slate-400">Залишилось</dt><dd className="font-bold">{remaining}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>

      <div className="-mx-5 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
              <th className="px-5 py-2 font-medium">{primaryHeading}</th>
              <th className="px-3 py-2 font-medium">Джерело / кампанія</th>
              <th className="px-3 py-2 text-right font-medium">Кліки</th>
              <th className="px-3 py-2 text-right font-medium">Дійшли</th>
              <th className="px-3 py-2 text-right font-medium">Підписки</th>
              <th className="px-3 py-2 text-right font-medium">Залишилось</th>
              <th className="px-5 py-2 text-right font-medium">Конверсія</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-slate-100 last:border-0 hover:bg-brand-50/40">
                <td className="max-w-[320px] px-5 py-3 font-semibold text-[#102044]">
                  <span className="block truncate" title={row.label}>{row.label}</span>
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-700">{row.source}</p>
                  <p className="text-xs text-slate-400">{row.campaign}</p>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{row.clicks}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <p>{row.reached}</p>
                  <p className="text-xs text-slate-400">{row.clicks > 0 ? formatPercentUk(row.reached / row.clicks) : '—'}</p>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{row.subscribers}</td>
                <td className="px-3 py-3 text-right tabular-nums">{row.subscribers - row.unsubscribes}</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums">
                  {row.clicks > 0 ? formatPercentUk(row.subscribers / row.clicks) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
