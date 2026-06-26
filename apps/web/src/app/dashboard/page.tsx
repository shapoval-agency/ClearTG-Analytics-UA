import { api, DashboardOverview } from '@/lib/api';
import { PageHeader, StatCard } from '@/components/ui';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.workspaceId) redirect('/onboarding');

  let data: DashboardOverview | null = null;
  try {
    data = await api<DashboardOverview>('/api/dashboard/overview');
  } catch {
    data = null;
  }

  return (
    <div>
      <PageHeader
        title="Огляд"
        description="Чесна аналітика підписок та джерел трафіку"
      />

      {!data ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800">
          <p className="font-medium">API недоступний</p>
          <p className="text-sm mt-1">Перевірте Railway API та змінну API_INTERNAL_URL у Vercel.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Кліки" value={data.clicks} />
            <StatCard label="Підписники" value={data.subscribers} />
            <StatCard label="Відписки" value={data.unsubscribes} />
            <StatCard
              label="Click → Subscribe"
              value={pct(data.clickToSubscribeRate)}
              hint="Конверсія з кліку в підписку"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold mb-4">Утримання (Retention)</h2>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-slate-600">D1</span><span className="font-medium">{pct(data.retention.d1)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">D7</span><span className="font-medium">{pct(data.retention.d7)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">D30</span><span className="font-medium">{pct(data.retention.d30)}</span></div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold mb-4">Атрибуція</h2>
              <p className="text-xs text-slate-500 mb-3">
                Джерело підписки може бути визначене точно або приблизно. Рівень впевненості вказано в звіті.
              </p>
              {data.attributions.length === 0 ? (
                <p className="text-slate-400 text-sm">Немає даних</p>
              ) : (
                <div className="space-y-2">
                  {data.attributions.map((a) => (
                    <div key={a.type} className="flex justify-between text-sm">
                      <span className="text-slate-600">{a.type}</span>
                      <span>{a.count} ({pct(a.share)}) · {a.confidenceLabel}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold mb-4">Доставка подій (Pixel / CAPI)</h2>
            <p className="text-xs text-slate-500 mb-3">
              Події передаються в рекламні системи лише за наявності дозволених ідентифікаторів та відповідних підстав.
            </p>
            {data.deliveryStats.length === 0 ? (
              <p className="text-slate-400 text-sm">Немає подій</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {data.deliveryStats.map((s) => (
                  <span key={s.status} className="px-3 py-1 bg-slate-100 rounded-full text-sm">
                    {s.status}: {s.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
