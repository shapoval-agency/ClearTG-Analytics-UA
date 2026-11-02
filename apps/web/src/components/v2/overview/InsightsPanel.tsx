import Link from 'next/link';
import { CheckCircle, TrendDown, Warning } from '@phosphor-icons/react/dist/ssr';
import { Card } from '@/components/v2/ui';
import type { DashboardOverview } from '@/lib/api';

export function InsightsPanel({ insights }: { insights: NonNullable<DashboardOverview['insights']> }) {
  return (
    <Card
      className="mb-6"
      title="Важливі зміни"
      hint="Порівнюємо останні 7 повних днів із попередніми 7 і не показуємо шум на малих вибірках."
    >
      {insights.length === 0 ? (
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle size={22} weight="fill" className="shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold">Різких змін не виявлено</p>
            <p className="mt-1 text-sm text-emerald-700">Джерела, відписки та частка невідомої атрибуції в нормальному діапазоні.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {insights.map((insight) => {
            const Icon = insight.kind === 'source-drop' ? TrendDown : Warning;
            const critical = insight.severity === 'critical';
            return (
              <Link
                key={insight.id}
                href={insight.href}
                className={`group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${critical ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}
              >
                <Icon size={22} weight="fill" className={critical ? 'text-rose-600' : 'text-amber-600'} aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-[#102044]">{insight.title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">{insight.description}</p>
                <span className="mt-3 inline-block text-sm font-bold text-brand-700 group-hover:underline">Подивитися деталі →</span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
