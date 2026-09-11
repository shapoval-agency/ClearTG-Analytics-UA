import Link from 'next/link';
import { StatCard, Badge } from '@/components/v2/ui';
import { formatPercentUk } from '@/lib/labels';
import type { DashboardOverview } from '@/lib/api';

/**
 * Рівно п'ять чисел з брифу — без reach і без карток «зайвих». Баланс подій
 * (S1-25, MVP_SCOPE.md) — не окрема картка, а один рядок під сіткою:
 * дублювати повний розбір атрибуції з «Звітів» тут не потрібно, досить
 * індикатора «сходиться / ні».
 */
export function OverviewKpiRow({ overview }: { overview: DashboardOverview }) {
  const netGrowth = overview.subscribers - overview.unsubscribes;
  const hasClicks = overview.clicks > 0;

  return (
    <div className="mb-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard label="Кліки" value={overview.clicks} />
        <StatCard label="Підписки" value={overview.subscribers} />
        <StatCard label="Відписки" value={overview.unsubscribes} />
        <StatCard label="Чистий приріст" value={netGrowth > 0 ? `+${netGrowth}` : netGrowth} />
        <StatCard
          label="Конверсія клік → підписка"
          value={hasClicks ? formatPercentUk(overview.clickToSubscribeRate) : '—'}
        />
      </div>

      {overview.subscribers > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm mt-3">
          <span className="text-slate-500">Баланс подій:</span>
          {overview.dataIntegrity.ok ? (
            <Badge tone="ok">сходиться</Badge>
          ) : (
            <Badge tone="error">{overview.dataIntegrity.missing} підписок без визначеного джерела</Badge>
          )}
          {!overview.dataIntegrity.ok && (
            <Link href="/v2/subscribers" className="text-xs text-brand-600 hover:underline">
              Перевірити учасників
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
