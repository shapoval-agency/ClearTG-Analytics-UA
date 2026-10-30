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
  const ratio = (count: number) => (total > 0 ? `${(count / total) * 100}%` : '0%');
  const share = (count: number) => (total > 0 ? formatPercentUk(count / total) : '—');
  // Під час поетапного деплою UI може на кілька хвилин випереджати API.
  // Старі відповіді не мають монітора unknown-source — у такому разі просто
  // не показуємо попередження, але сам звіт і навігація залишаються робочими.
  const unknownSourceMonitor = overview.unknownSourceMonitor ?? { change: 0, alert: false };
  const unknownChangePoints = (unknownSourceMonitor.change * 100).toLocaleString('uk-UA', {
    maximumFractionDigits: 1,
  });

  return (
    <Card title="Якість визначення джерела" hint="Точне, розраховане та невизначене джерело підписки">
      {unknownSourceMonitor.alert && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Badge tone="warn">Потрібна увага</Badge>
          <p className="mt-2">
            За останні 7 днів частка невизначеного джерела зросла на{' '}
            {unknownChangePoints} п.п. проти попередніх 7 днів.
            Перевірте активні посилання та права бота.
          </p>
        </div>
      )}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" aria-label="Розподіл якості атрибуції">
        <span className="bg-emerald-400" style={{ width: ratio(groups.exact) }} />
        <span className="bg-brand-500" style={{ width: ratio(groups.calculated) }} />
        <span className="bg-slate-300" style={{ width: ratio(groups.unknown) }} />
      </div>
      <div className={`mt-5 grid gap-4 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {[
          { label: 'Точне', count: groups.exact, color: 'bg-emerald-400' },
          { label: 'Розраховане', count: groups.calculated, color: 'bg-brand-500' },
          { label: 'Не визначено', count: groups.unknown, color: 'bg-slate-300' },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className={`size-2.5 shrink-0 rounded-full ${item.color}`} />
              {item.label}
            </p>
            <p className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-[#102044]">{share(item.count)}</p>
            <p className="text-xs text-slate-400">{item.count} підписок</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
