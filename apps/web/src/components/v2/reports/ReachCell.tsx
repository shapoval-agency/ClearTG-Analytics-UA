import { measuredReach } from '@/lib/api';
import { formatPercentUk } from '@/lib/labels';

export const REACH_NOT_MEASURED_HINT =
  'Посилання з миттєвим переходом не можуть підтвердити, що Telegram справді відкрився. Оберіть у посиланні «Як відкривати Telegram» → «Сторінка з кнопкою», щоб це вимірювати.';

/**
 * S2-10: «Дійшли до Telegram» — лише серед кліків, де це вимірювалось.
 * Якщо всі кліки з миттєвим переходом, чесно пишемо «не вимірюється»,
 * а не 0% і не 100%.
 */
export function ReachCell({
  row,
  compact = false,
}: {
  row: { clicks: number; reached: number; reachTracked?: number };
  compact?: boolean;
}) {
  if (row.clicks === 0) return <span>—</span>;
  const reach = measuredReach(row);
  if (!reach) {
    return (
      <span className="text-xs text-slate-400" title={REACH_NOT_MEASURED_HINT}>
        не вимірюється
      </span>
    );
  }
  const partial = reach.tracked < row.clicks;
  if (compact) {
    return (
      <span title={partial ? `Виміряно ${reach.tracked} з ${row.clicks} кліків` : undefined}>
        {row.reached} · {formatPercentUk(reach.rate)}
      </span>
    );
  }
  return (
    <>
      <p>{row.reached}</p>
      <p className="text-xs text-slate-400" title={partial ? REACH_NOT_MEASURED_HINT : undefined}>
        {formatPercentUk(reach.rate)}
        {partial && ` з ${reach.tracked}`}
      </p>
    </>
  );
}
