import Link from 'next/link';
import { UserCircle } from '@phosphor-icons/react/dist/ssr';
import { Card, Badge } from '@/components/v2/ui';
import { formatDateUk } from '@/lib/labels';
import type { SubscriberFeedRow } from '@/lib/api';

function participantLabel(row: SubscriberFeedRow) {
  return row.telegramUsername ? `@${row.telegramUsername}` : `ID ${row.telegramUserId}`;
}

export function SubscriberTable({ rows }: { rows: SubscriberFeedRow[] }) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article
            key={row.id}
            className="rounded-[18px] border border-[#dbe4f0] bg-white p-4 shadow-[0_10px_34px_rgba(20,52,110,0.055)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <UserCircle size={25} weight="fill" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/v2/subscribers/${row.id}`} className="block truncate font-bold text-brand-700">
                      {participantLabel(row)}
                    </Link>
                    <p className="text-xs text-slate-400">{row.channelTitle}</p>
                  </div>
                  <Badge tone={row.isActive ? 'ok' : 'neutral'}>
                    {row.isActive ? 'Активний' : 'Неактивний'}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
                  <div>
                    <dt className="text-slate-400">Підписка</dt>
                    <dd className="mt-1 font-semibold text-slate-700">{formatDateUk(row.subscribedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Кампанія</dt>
                    <dd className="mt-1 truncate font-semibold text-slate-700">{row.campaignName ?? '—'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-400">Джерело</dt>
                    <dd className="mt-1 text-slate-700">{row.joinSource}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Card className="hidden md:block">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-semibold">Учасник</th>
                <th className="px-3 py-3 font-semibold">Дата підписки</th>
                <th className="px-3 py-3 font-semibold">Статус</th>
                <th className="px-3 py-3 font-semibold">Джерело</th>
                <th className="px-3 py-3 font-semibold">Кампанія</th>
                <th className="px-3 py-3 font-semibold">Посилання</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-brand-50/40">
                  <td className="px-5 py-3.5">
                    <Link href={`/v2/subscribers/${row.id}`} className="font-bold text-brand-700 hover:text-brand-800">
                      {participantLabel(row)}
                    </Link>
                    <p className="text-xs text-slate-400">{row.channelTitle}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-slate-600">{formatDateUk(row.subscribedAt)}</td>
                  <td className="px-3 py-3.5">
                    <Badge tone={row.isActive ? 'ok' : 'neutral'}>{row.isActive ? 'Активний' : 'Неактивний'}</Badge>
                  </td>
                  <td className="max-w-72 px-3 py-3.5 text-slate-700">{row.joinSource}</td>
                  <td className="px-3 py-3.5 text-slate-600">{row.campaignName ?? '—'}</td>
                  <td className="px-3 py-3.5 text-slate-600">
                    {row.trackingLinkName ?? (row.trackingLinkSlug ? `/${row.trackingLinkSlug}` : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
