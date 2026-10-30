import Link from 'next/link';
import { UserMinus, UserPlus } from '@phosphor-icons/react/dist/ssr';
import { Card } from '@/components/v2/ui';
import { formatDateUk } from '@/lib/labels';

export interface ActivityItem {
  key: string;
  type: 'subscribe' | 'unsubscribe';
  at: string;
  label: string;
  detail: string;
  /** Тільки для підписок — SubscriberProfile.id відомий; для відписок точного profileId тут немає. */
  href?: string;
}

/** До 5 останніх подій — не повноцінна стрічка CRM: без пошуку, фільтрів і дій. */
export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Card title="Остання активність">
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Поки що подій не було.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const row = (
              <div className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={item.type === 'subscribe'
                    ? 'grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600'
                    : 'grid size-9 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600'}>
                    {item.type === 'subscribe'
                      ? <UserPlus size={18} weight="bold" aria-hidden="true" />
                      : <UserMinus size={18} weight="bold" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <span className={item.href ? 'font-semibold text-brand-700' : 'font-semibold text-[#102044]'}>{item.label}</span>
                    <p className="truncate text-xs text-slate-400">{item.detail}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateUk(item.at)}</span>
              </div>
            );
            return (
              <li key={item.key}>
                {item.href ? (
                  <Link href={item.href} className="block rounded-lg transition hover:bg-slate-50">
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/v2/subscribers" className="mt-4 inline-flex text-sm font-bold text-brand-600 hover:text-brand-700">
        Усі події →
      </Link>
    </Card>
  );
}
