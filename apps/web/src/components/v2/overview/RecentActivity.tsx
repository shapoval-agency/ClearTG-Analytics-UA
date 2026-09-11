import Link from 'next/link';
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
        <ul className="space-y-3">
          {items.map((item) => {
            const row = (
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className={item.type === 'subscribe' ? 'text-emerald-600' : 'text-slate-400'}>
                    {item.type === 'subscribe' ? '+ ' : '– '}
                  </span>
                  <span className={item.href ? 'text-brand-700' : 'text-slate-800'}>{item.label}</span>
                  <p className="text-xs text-slate-400 truncate">{item.detail}</p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateUk(item.at)}</span>
              </div>
            );
            return (
              <li key={item.key}>
                {item.href ? (
                  <Link href={item.href} className="block hover:opacity-70">
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
      <Link href="/v2/subscribers" className="block mt-3 text-sm text-brand-600 hover:underline">
        Усі учасники →
      </Link>
    </Card>
  );
}
