'use client';

import { PageHeader, StatCard } from '@/components/ui';
import { useLocalData } from '@/hooks/useLocalData';
import { getOverview } from '@/lib/local-store';

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export function LocalDashboard() {
  const { state, ready } = useLocalData();

  if (!ready || !state) {
    return <p className="text-slate-500">Завантаження…</p>;
  }

  const data = getOverview(state);

  return (
    <div>
      <PageHeader
        title="Огляд"
        description="Чесна аналітика підписок та джерел трафіку"
      />

      {data.clicks === 0 && data.subscribers === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-slate-600 text-sm">
          Поки немає кліків і підписок — це нормально без бекенду. Додайте канал, кампанію та
          tracking-посилання; після підключення API статистика піде з реальних подій.
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 mt-6">
        <StatCard label="Кліки" value={data.clicks} />
        <StatCard label="Підписники" value={data.subscribers} />
        <StatCard label="Відписки" value={data.unsubscribes} />
        <StatCard
          label="Click → Subscribe"
          value={pct(data.clickToSubscribeRate)}
          hint="Конверсія з кліку в підписку"
        />
      </div>
    </div>
  );
}
