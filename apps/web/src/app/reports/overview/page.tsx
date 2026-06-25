import { api, DashboardOverview } from '@/lib/api';
import { PageHeader } from '@/components/ui';


function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

export default async function ReportsOverviewPage() {
  let data: DashboardOverview | null = null;
  try {
    data = await api<DashboardOverview>('/api/dashboard/overview');
  } catch { /* empty */ }

  return (
    <div>
      <PageHeader title="Звіт: Огляд" />
      {!data ? <p className="text-slate-500">Немає даних</p> : (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Кліки:</span> <strong>{data.clicks}</strong></div>
            <div><span className="text-slate-500">Підписники:</span> <strong>{data.subscribers}</strong></div>
            <div><span className="text-slate-500">Конверсія:</span> <strong>{pct(data.clickToSubscribeRate)}</strong></div>
            <div><span className="text-slate-500">Відписки:</span> <strong>{data.unsubscribes}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}
