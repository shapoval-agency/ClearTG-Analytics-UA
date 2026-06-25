import { api, DashboardOverview } from '@/lib/api';
import { PageHeader } from '@/components/ui';


export default async function AttributionConfidencePage() {
  let data: DashboardOverview | null = null;
  try {
    data = await api<DashboardOverview>('/api/dashboard/overview');
  } catch { /* empty */ }

  return (
    <div>
      <PageHeader
        title="Впевненість атрибуції"
        description="Ми не обіцяємо фіксовану точність. Кожна підписка має рівень впевненості: exact, high, medium, low, unknown."
      />
      {data?.attributions.length ? (
        <div className="space-y-3">
          {data.attributions.map((a) => (
            <div key={a.type} className="bg-white rounded-xl border p-5 flex justify-between">
              <div>
                <p className="font-medium">{a.type}</p>
                <p className="text-sm text-slate-500">{a.count} підписок</p>
              </div>
              <span className="px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-sm font-medium">
                {a.confidenceLabel}
              </span>
            </div>
          ))}
        </div>
      ) : <p className="text-slate-500">Немає даних</p>}
    </div>
  );
}
