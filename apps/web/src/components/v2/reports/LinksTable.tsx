import Link from 'next/link';
import { Card, EmptyState } from '@/components/v2/ui';
import { formatPercentUk } from '@/lib/labels';
import type { TrackingLinkReportRow } from '@/lib/api';

/** «Посилання» — розріз по кожному трекінговому посиланню окремо, а не по кампанії. */
export function LinksTable({ rows }: { rows: TrackingLinkReportRow[] }) {
  const sorted = [...rows].sort((a, b) => b.clicks - a.clicks);

  if (sorted.length === 0) {
    return (
      <Card title="Посилання">
        <EmptyState
          title="Ще немає жодного трекінгового посилання"
          description="Трекінгове посилання дає точну атрибуцію — видно, який саме клік привів підписника."
          action={
            <Link href="/v2/links" className="text-sm text-brand-600 hover:underline">
              Створити посилання
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card title="Посилання" hint="Той самий трафік, розрізаний по конкретному посиланню">
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="font-medium py-2 px-5">Посилання</th>
              <th className="font-medium py-2 px-3 text-right">Кліки</th>
              <th className="font-medium py-2 px-3 text-right">Підписники</th>
              <th className="font-medium py-2 px-3 text-right">Ефективність</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <td className="py-2.5 px-5">
                  <p className="font-medium text-slate-900">{row.name || `/${row.slug}`}</p>
                  <p className="text-xs text-slate-400">
                    {row.campaignName ? `${row.campaignName} · ` : ''}
                    {row.channelTitle}
                  </p>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">{row.clicks}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{row.subscribers}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  {row.clicks > 0 ? formatPercentUk(row.conversionRate) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
