import Link from 'next/link';
import { Card } from '@/components/v2/ui';
import type { CampaignReportRow } from '@/lib/api';

/** Топ-3 кампанії за підписками — ті самі дані, що вже рахує «Звіти → Джерела». */
export function TopSources({ rows }: { rows: CampaignReportRow[] }) {
  const top = [...rows]
    .filter((r) => r.subscribers > 0)
    .sort((a, b) => b.subscribers - a.subscribers)
    .slice(0, 3);

  return (
    <Card title="Джерела" hint="Найкращі за кількістю підписок">
      {top.length === 0 ? (
        <p className="text-sm text-slate-500">Поки що жодна кампанія не привела підписників.</p>
      ) : (
        <ul className="space-y-2.5">
          {top.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-800 truncate">{row.name}</span>
              <span className="text-slate-600 tabular-nums whitespace-nowrap">{row.subscribers} підписок</span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/v2/reports" className="block mt-3 text-sm text-brand-600 hover:underline">
        Усі звіти →
      </Link>
    </Card>
  );
}
