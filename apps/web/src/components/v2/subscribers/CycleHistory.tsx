import clsx from 'clsx';
import { Badge } from '@/components/v2/ui';
import { formatDateUk } from '@/lib/labels';
import type { SubscriberFeedRow } from '@/lib/api';

/**
 * Історія циклів «підписка → відписка → повторна підписка».
 *
 * `getSubscriberDossier()` віддає один профіль — один цикл. У людини їх може
 * бути кілька (немає `@@unique` на `SubscriberProfile`, коментар у
 * schema.prisma:476). Бекенд для «зібрати всю історію людини одним викликом»
 * не чіпали (заборонено брифом) — цей список збирається на сторінці другим
 * викликом уже готового `GET /api/dashboard/subscribers?search=<telegramUserId>`,
 * відфільтрованим по точному співпадінню (див. v2-subscribers-plan.md).
 *
 * Точну дату відписки для ІНШИХ циклів (не поточного) звідси не отримати —
 * `SubscriberFeedRow` її не містить, а окремий виклик досьє на кожен цикл
 * був би зайвим для сценарію, який ще жодного разу не траплявся в реальних
 * даних (DATA_TRUST_CHECK.md). Тому тут — однаково для всіх циклів: дата
 * підписки, статус, джерело. Точна дата відписки поточного циклу — в
 * основній картці вище, не тут.
 */
export function CycleHistory({
  cycles,
  currentId,
}: {
  cycles: SubscriberFeedRow[];
  currentId: string;
}) {
  return (
    <ol className="space-y-3">
      {cycles.map((cycle, index) => (
        <li
          key={cycle.id}
          className={clsx(
            'rounded-lg border p-3',
            cycle.id === currentId ? 'border-brand-300 bg-brand-50' : 'border-slate-200',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">
              Цикл {index + 1}
              {cycle.id === currentId && (
                <span className="text-brand-600 font-normal"> · ця картка</span>
              )}
            </p>
            <Badge tone={cycle.isActive ? 'ok' : 'neutral'}>
              {cycle.isActive ? 'Активний' : 'Неактивний'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">Підписався {formatDateUk(cycle.subscribedAt)}</p>
          <p className="text-xs text-slate-600 mt-1">{cycle.joinSource}</p>
        </li>
      ))}
    </ol>
  );
}
