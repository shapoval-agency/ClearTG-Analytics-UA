import Link from 'next/link';
import { Card, Badge } from '@/components/v2/ui';
import { formatDateUk } from '@/lib/labels';
import type { SubscriberFeedRow } from '@/lib/api';

/**
 * Список учасників. Технічні поля (внутрішній `id`, сирий `attributionType`)
 * не показуємо — `joinSource` вже готова людська фраза з бекенду
 * (`getSubscriberFeed()`), кампанія/посилання — окремими колонками, як
 * просить бриф.
 */
export function SubscriberTable({ rows }: { rows: SubscriberFeedRow[] }) {
  return (
    <Card>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="font-medium py-2 px-5">Учасник</th>
              <th className="font-medium py-2 px-3">Дата підписки</th>
              <th className="font-medium py-2 px-3">Статус</th>
              <th className="font-medium py-2 px-3">Джерело</th>
              <th className="font-medium py-2 px-3">Кампанія</th>
              <th className="font-medium py-2 px-3">Посилання</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="py-2.5 px-5">
                  <Link
                    href={`/v2/subscribers/${row.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {row.telegramUsername ? `@${row.telegramUsername}` : `ID ${row.telegramUserId}`}
                  </Link>
                  <p className="text-xs text-slate-400">{row.channelTitle}</p>
                </td>
                <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {formatDateUk(row.subscribedAt)}
                </td>
                <td className="py-2.5 px-3">
                  <Badge tone={row.isActive ? 'ok' : 'neutral'}>
                    {row.isActive ? 'Активний' : 'Неактивний'}
                  </Badge>
                </td>
                <td className="py-2.5 px-3 text-slate-700">{row.joinSource}</td>
                <td className="py-2.5 px-3 text-slate-600">{row.campaignName ?? '—'}</td>
                <td className="py-2.5 px-3 text-slate-600">
                  {row.trackingLinkName ?? (row.trackingLinkSlug ? `/${row.trackingLinkSlug}` : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
