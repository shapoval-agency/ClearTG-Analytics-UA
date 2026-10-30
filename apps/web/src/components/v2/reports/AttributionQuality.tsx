import { Badge, Card } from '@/components/v2/ui';
import { formatPercentUk } from '@/lib/labels';
import type { DashboardOverview } from '@/lib/api';

const EXACT = new Set(['EXACT_CLICK_INVITE', 'CAMPAIGN_INVITE']);

export function AttributionQuality({
  overview,
  compact = false,
}: {
  overview: DashboardOverview;
  compact?: boolean;
}) {
  const groups = overview.attributions.reduce(
    (acc, row) => {
      if (EXACT.has(row.type)) acc.exact += row.count;
      else if (row.type === 'PROBABILISTIC') acc.calculated += row.count;
      else acc.unknown += row.count;
      return acc;
    },
    { exact: 0, calculated: 0, unknown: 0 },
  );
  const total = groups.exact + groups.calculated + groups.unknown;
  const share = (count: number) => (total > 0 ? formatPercentUk(count / total) : '—');
  const unknownChangePoints = (overview.unknownSourceMonitor.change * 100).toLocaleString('uk-UA', {
    maximumFractionDigits: 1,
  });

  return (
    <Card title="Якість визначення джерела" hint="Точне, розраховане та невизначене джерело підписки">
      {overview.unknownSourceMonitor.alert && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Badge tone="warn">Потрібна увага</Badge>
          <p className="mt-2">
            За останні 7 днів частка невизначеного джерела зросла на{' '}
            {unknownChangePoints} п.п. проти попередніх 7 днів.
            Перевірте активні посилання та права бота.
          </p>
        </div>
      )}
      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <div className="rounded-lg bg-emerald-50 p-3">
          <p className="text-sm text-emerald-800">Точне</p>
          <p className="mt-1 text-xl font-semibold text-emerald-950">{groups.exact}</p>
          <p className="text-xs text-emerald-700">{share(groups.exact)} підписок</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-sm text-blue-800">Розраховане</p>
          <p className="mt-1 text-xl font-semibold text-blue-950">{groups.calculated}</p>
          <p className="text-xs text-blue-700">{share(groups.calculated)} підписок</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-3">
          <p className="text-sm text-slate-700">Не визначено</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{groups.unknown}</p>
          <p className="text-xs text-slate-600">{share(groups.unknown)} підписок</p>
        </div>
      </div>
    </Card>
  );
}
