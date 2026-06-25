import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';

interface CampaignReport {
  id: string;
  name: string;
  adPlatform: string;
  channelTitle: string;
  clicks: number;
  subscribers: number;
  conversionRate: number;
}

interface TrackingLinkReport {
  id: string;
  slug: string;
  name: string | null;
  campaignName: string | null;
  channelTitle: string;
  clicks: number;
  subscribers: number;
  conversionRate: number;
  autoRedirect: boolean;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function ReportsSourcesPage() {
  let campaigns: CampaignReport[] = [];
  let links: TrackingLinkReport[] = [];
  let loadError = false;
  try {
    [campaigns, links] = await Promise.all([
      api<CampaignReport[]>('/api/dashboard/campaigns'),
      api<TrackingLinkReport[]>('/api/dashboard/tracking-links'),
    ]);
  } catch {
    loadError = true;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Звіт: Джерела та конверсії"
        description="Кліки → підписки по кампаніях і tracking-посиланнях"
      />

      {loadError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          Не вдалося завантажити дані. Увійдіть через{' '}
          <a href="/login?next=/reports/sources" className="underline font-medium">/login</a>
          {' '}(demo: <code className="text-xs">demo@cleartg.ua</code>) і переконайтесь, що API працює на порту 3001.
        </div>
      )}

      <section>
        <h2 className="font-semibold mb-3">Кампанії</h2>
        {campaigns.length === 0 ? (
          <p className="text-slate-500 text-sm">Немає кампаній</p>
        ) : (
          <table className="w-full bg-white rounded-xl border text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-4">Кампанія</th>
                <th className="p-4">Платформа</th>
                <th className="p-4">Кліки</th>
                <th className="p-4">Підписки</th>
                <th className="p-4">CR</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-4 font-medium">{c.name}</td>
                  <td className="p-4">{c.adPlatform}</td>
                  <td className="p-4">{c.clicks}</td>
                  <td className="p-4">{c.subscribers}</td>
                  <td className="p-4">{pct(c.conversionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Tracking-посилання</h2>
        {links.length === 0 ? (
          <p className="text-slate-500 text-sm">Немає посилань</p>
        ) : (
          <table className="w-full bg-white rounded-xl border text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-4">Посилання</th>
                <th className="p-4">Кампанія</th>
                <th className="p-4">Кліки</th>
                <th className="p-4">Підписки</th>
                <th className="p-4">CR</th>
                <th className="p-4">Редирект</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="p-4">
                    <span className="font-mono text-brand-600">/{l.slug}</span>
                    {l.name && <span className="block text-slate-500 text-xs">{l.name}</span>}
                  </td>
                  <td className="p-4">{l.campaignName ?? '—'}</td>
                  <td className="p-4">{l.clicks}</td>
                  <td className="p-4">{l.subscribers}</td>
                  <td className="p-4">{pct(l.conversionRate)}</td>
                  <td className="p-4">{l.autoRedirect ? 'так' : 'кнопка'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
