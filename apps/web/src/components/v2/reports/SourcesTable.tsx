import Link from 'next/link';
import { Card, EmptyState } from '@/components/v2/ui';
import { formatPercentUk } from '@/lib/labels';
import type { CampaignReportRow } from '@/lib/api';

/**
 * «Джерела» — розріз по кампанії. Кампанія в цьому продукті і є джерело
 * трафіку (платформа + назва), тому окремого блоку «джерела» поруч не
 * робимо — `getCampaignReports()` вже рахує саме це.
 *
 * `unattributedSubscribers` — різниця між загальною кількістю підписок
 * (verhній блок) і сумою підписок по кампаніях нижче. Рахується на сторінці,
 * не тут, бо залежить від overview. Якщо > 0 — окремий чесний рядок
 * «Джерело невідоме», а не мовчазна розбіжність сум і не вигадане джерело.
 */
export function SourcesTable({
  rows,
  unattributedSubscribers,
}: {
  rows: CampaignReportRow[];
  unattributedSubscribers: number;
}) {
  const sorted = [...rows].sort((a, b) => b.clicks - a.clicks);

  if (sorted.length === 0 && unattributedSubscribers === 0) {
    return (
      <Card title="Джерела">
        <EmptyState
          title="Ще немає жодної кампанії"
          description="Створіть посилання під конкретне джерело трафіку — і воно з'явиться тут окремим рядком."
          action={
            <Link href="/v2/links" className="text-sm text-brand-600 hover:underline">
              Перейти до «Посилання»
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card title="Джерела" hint="Що приводить підписників, а що просто витрачає бюджет">
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="font-medium py-2 px-5">Кампанія</th>
              <th className="font-medium py-2 px-3 text-right">Кліки</th>
              <th className="font-medium py-2 px-3 text-right">Підписки</th>
              <th className="font-medium py-2 px-3 text-right">Відписки</th>
              <th className="font-medium py-2 px-3 text-right">Конверсія</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <td className="py-2.5 px-5">
                  <p className="font-medium text-slate-900">{row.name}</p>
                  <p className="text-xs text-slate-400">{row.channelTitle}</p>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">{row.clicks}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{row.subscribers}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{row.unsubscribes}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  {row.clicks > 0 ? formatPercentUk(row.conversionRate) : '—'}
                </td>
              </tr>
            ))}
            {unattributedSubscribers > 0 && (
              <tr className="border-t border-dashed border-slate-200">
                <td className="py-2.5 px-5">
                  <p className="text-slate-500 italic">Джерело невідоме</p>
                  <p className="text-xs text-slate-400">
                    Не прив&apos;язано до жодної кампанії з переліку вище — пряме посилання, посилання без кампанії або вступ поза рекламою
                  </p>
                </td>
                <td className="py-2.5 px-3 text-right text-slate-300">—</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                  {unattributedSubscribers}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-300">—</td>
                <td className="py-2.5 px-3 text-right text-slate-300">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
