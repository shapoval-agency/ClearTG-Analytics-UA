import { StatCard } from '@/components/v2/ui';
import { formatPercentUk } from '@/lib/labels';
import type { DashboardOverview } from '@/lib/api';

/**
 * Верхній блок — рівно шість чисел з брифу, більше нічого. `reached`/
 * `reachRate` і `clickToSubscribeRate` вже пораховані на бекенді; приріст —
 * єдине, що рахується тут же, з тих самих двох чисел (не нова метрика,
 * а арифметика над уже отриманими даними).
 */
export function KpiRow({ overview }: { overview: DashboardOverview }) {
  const netGrowth = overview.subscribers - overview.unsubscribes;
  const hasClicks = overview.clicks > 0;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
      <StatCard label="Кліки" value={overview.clicks} />
      <StatCard
        label="Дійшли до Telegram"
        value={hasClicks ? formatPercentUk(overview.reachRate) : '—'}
        hint={hasClicks ? `${overview.reached} з ${overview.clicks} кліків` : undefined}
      />
      <StatCard label="Підписки" value={overview.subscribers} />
      <StatCard label="Відписки" value={overview.unsubscribes} />
      <StatCard
        label="Чистий приріст"
        value={netGrowth > 0 ? `+${netGrowth}` : netGrowth}
      />
      <StatCard
        label="Конверсія клік → підписка"
        value={hasClicks ? formatPercentUk(overview.clickToSubscribeRate) : '—'}
      />
    </div>
  );
}
