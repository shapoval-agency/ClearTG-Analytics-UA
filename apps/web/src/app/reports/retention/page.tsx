import { api, DashboardOverview } from '@/lib/api';
import { PageHeader } from '@/components/ui';


function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

export default async function ReportsRetentionPage() {
  let data: DashboardOverview | null = null;
  try {
    data = await api<DashboardOverview>('/api/dashboard/overview');
  } catch { /* empty */ }

  return (
    <div>
      <PageHeader title="Звіт: Утримання" />
      {data ? (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-6 text-center">
            <p className="text-3xl font-semibold">{pct(data.retention.d1)}</p>
            <p className="text-slate-500 mt-2">D1 Retention</p>
          </div>
          <div className="bg-white rounded-xl border p-6 text-center">
            <p className="text-3xl font-semibold">{pct(data.retention.d7)}</p>
            <p className="text-slate-500 mt-2">D7 Retention</p>
          </div>
          <div className="bg-white rounded-xl border p-6 text-center">
            <p className="text-3xl font-semibold">{pct(data.retention.d30)}</p>
            <p className="text-slate-500 mt-2">D30 Retention</p>
          </div>
        </div>
      ) : <p className="text-slate-500">Немає даних</p>}
    </div>
  );
}
