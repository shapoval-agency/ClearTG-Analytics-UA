import { StatCard } from '@/components/v2/ui';
import { formatPercentUk } from '@/lib/labels';
import type { DashboardOverview } from '@/lib/api';

/**
 * Верхній блок — рівно шість чисел з брифу, більше нічого. `reached`/
 * `reachRate` і `clickToSubscribeRate` вже пораховані на бекенді; приріст —
 * єдине, що рахується тут же, з тих самих двох чисел (не нова метрика,
 * а арифметика над уже отриманими даними).
 */
function countChange(current: number, previous: number): string {
  const change = current - previous;
  const value = change > 0 ? `+${change}` : String(change);
  return `До попереднього періоду: ${value}`;
}

function rateChange(current: number, previous: number): string {
  const points = (current - previous) * 100;
  const value = `${points > 0 ? '+' : ''}${points.toLocaleString('uk-UA', { maximumFractionDigits: 1 })} п.п.`;
  return `До попереднього періоду: ${value}`;
}

export function KpiRow({
  overview,
  previous,
}: {
  overview: DashboardOverview;
  previous?: DashboardOverview | null;
}) {
  const netGrowth = overview.subscribers - overview.unsubscribes;
  const hasClicks = overview.clicks > 0;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
      <StatCard label="Кліки" value={overview.clicks}
        hint={previous ? countChange(overview.clicks, previous.clicks) : undefined} />
      <StatCard
        label="Дійшли до Telegram"
        value={hasClicks ? formatPercentUk(overview.reachRate) : '—'}
        hint={hasClicks
          ? `${overview.reached} з ${overview.clicks} кліків${previous ? ` · ${rateChange(overview.reachRate, previous.reachRate)}` : ''}`
          : undefined}
      />
      <StatCard label="Підписки" value={overview.subscribers}
        hint={previous ? countChange(overview.subscribers, previous.subscribers) : undefined} />
      <StatCard label="Відписки" value={overview.unsubscribes}
        hint={previous ? countChange(overview.unsubscribes, previous.unsubscribes) : undefined} />
      <StatCard
        label="Чистий приріст"
        value={netGrowth > 0 ? `+${netGrowth}` : netGrowth}
        hint={previous
          ? countChange(netGrowth, previous.subscribers - previous.unsubscribes)
          : undefined}
      />
      <StatCard
        label="Конверсія клік → підписка"
        value={hasClicks ? formatPercentUk(overview.clickToSubscribeRate) : '—'}
        hint={previous ? rateChange(overview.clickToSubscribeRate, previous.clickToSubscribeRate) : undefined}
      />
    </div>
  );
}
