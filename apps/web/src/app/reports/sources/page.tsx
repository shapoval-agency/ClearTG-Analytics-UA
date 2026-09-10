import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import Link from 'next/link';

interface CampaignReport {
  id: string;
  name: string;
  adPlatform: string;
  channelTitle: string;
  clicks: number;
  uniqueClickers: number;
  subscribers: number;
  unsubscribes: number;
  conversionRate: number;
}

interface TrackingLinkReport {
  id: string;
  slug: string;
  name: string | null;
  campaignName: string | null;
  channelTitle: string;
  clicks: number;
  uniqueClickers: number;
  subscribers: number;
  unsubscribes: number;
  conversionRate: number;
  autoRedirect: boolean;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

/** П.12 з ТЗ: 20 кліків з одного пристрою — все одно 20 кліків, але поруч
 * видно, скільки з них — різні люди (наближено по ipHash+userAgentHash). */
function ClicksCell({ clicks, uniqueClickers }: { clicks: number; uniqueClickers: number }) {
  return (
    <>
      {clicks}
      {clicks > 0 && uniqueClickers < clicks && (
        <span className="block text-xs text-slate-400">≈{uniqueClickers} відвідувачів</span>
      )}
    </>
  );
}

type SortKey = 'clicks' | 'subscribers' | 'cr';

function sortRows<T extends { clicks: number; subscribers: number; conversionRate: number }>(
  rows: T[],
  sort?: string,
): T[] {
  const desc = !sort?.endsWith('_asc');
  const key = (sort?.replace('_asc', '') as SortKey) || null;
  if (!key) return rows;
  const valueOf = (r: T) => (key === 'clicks' ? r.clicks : key === 'subscribers' ? r.subscribers : r.conversionRate);
  return [...rows].sort((a, b) => (desc ? valueOf(b) - valueOf(a) : valueOf(a) - valueOf(b)));
}

function SortLink({
  label,
  sortKey,
  paramName,
  current,
  extraParams,
}: {
  label: string;
  sortKey: SortKey;
  paramName: 'sortCampaigns' | 'sortLinks';
  current?: string;
  extraParams: Record<string, string | undefined>;
}) {
  const isActive = current === sortKey || current === `${sortKey}_asc`;
  const next = current === sortKey ? `${sortKey}_asc` : sortKey;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(extraParams)) {
    if (v) params.set(k, v);
  }
  params.set(paramName, next);
  return (
    <Link href={`/reports/sources?${params.toString()}`} className="inline-flex items-center gap-1 hover:text-slate-800">
      {label}
      {isActive && <span className="text-[10px]">{current?.endsWith('_asc') ? '▲' : '▼'}</span>}
    </Link>
  );
}

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export default async function ReportsSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ sortCampaigns?: string; sortLinks?: string; campaignName?: string }>;
}) {
  const { sortCampaigns, sortLinks, campaignName } = await searchParams;
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

  const campaignNames = [...new Set(links.map((l) => l.campaignName).filter((n): n is string => Boolean(n)))].sort();

  const sortedCampaigns = sortRows(campaigns, sortCampaigns);
  let sortedLinks = sortRows(links, sortLinks);
  if (campaignName) sortedLinks = sortedLinks.filter((l) => l.campaignName === campaignName);

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
        {sortedCampaigns.length === 0 ? (
          <p className="text-slate-500 text-sm">Немає кампаній</p>
        ) : (
          <table className="w-full bg-white rounded-xl border text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-4">Кампанія</th>
                <th className="p-4">Платформа</th>
                <th className="p-4">
                  <SortLink label="Кліки" sortKey="clicks" paramName="sortCampaigns" current={sortCampaigns} extraParams={{ sortLinks, campaignName }} />
                </th>
                <th className="p-4">
                  <SortLink label="Підписки" sortKey="subscribers" paramName="sortCampaigns" current={sortCampaigns} extraParams={{ sortLinks, campaignName }} />
                </th>
                <th className="p-4">Відписки</th>
                <th className="p-4">
                  <SortLink label="CR" sortKey="cr" paramName="sortCampaigns" current={sortCampaigns} extraParams={{ sortLinks, campaignName }} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedCampaigns.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-4 font-medium">{c.name}</td>
                  <td className="p-4">{c.adPlatform}</td>
                  <td className="p-4"><ClicksCell clicks={c.clicks} uniqueClickers={c.uniqueClickers} /></td>
                  <td className="p-4">{c.subscribers}</td>
                  <td className="p-4">{c.unsubscribes ?? 0}</td>
                  <td className="p-4">{pct(c.conversionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold">Tracking-посилання</h2>
          {campaignNames.length > 0 && (
            <form method="get" className="flex items-center gap-2">
              {sortLinks && <input type="hidden" name="sortLinks" value={sortLinks} />}
              <label className="text-xs text-slate-500">Кампанія:</label>
              <select
                name="campaignName"
                defaultValue={campaignName ?? ''}
                className="border rounded-lg px-2 py-1 text-sm"
              >
                <option value="">Усі кампанії</option>
                {campaignNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button type="submit" className="text-sm text-brand-600 hover:underline">Застосувати</button>
              {campaignName && (
                <Link href={`/reports/sources${qs({ sortLinks })}`} className="text-xs text-slate-500 underline hover:text-slate-700">
                  Скинути
                </Link>
              )}
            </form>
          )}
        </div>
        {sortedLinks.length === 0 ? (
          <p className="text-slate-500 text-sm">{campaignName ? 'Немає посилань для цієї кампанії' : 'Немає посилань'}</p>
        ) : (
          <table className="w-full bg-white rounded-xl border text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-4">Посилання</th>
                <th className="p-4">Кампанія</th>
                <th className="p-4">
                  <SortLink label="Кліки" sortKey="clicks" paramName="sortLinks" current={sortLinks} extraParams={{ sortCampaigns, campaignName }} />
                </th>
                <th className="p-4">
                  <SortLink label="Підписки" sortKey="subscribers" paramName="sortLinks" current={sortLinks} extraParams={{ sortCampaigns, campaignName }} />
                </th>
                <th className="p-4">Відписки</th>
                <th className="p-4">
                  <SortLink label="CR" sortKey="cr" paramName="sortLinks" current={sortLinks} extraParams={{ sortCampaigns, campaignName }} />
                </th>
                <th className="p-4">Редирект</th>
              </tr>
            </thead>
            <tbody>
              {sortedLinks.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="p-4">
                    <span className="font-mono text-brand-600">/{l.slug}</span>
                    {l.name && <span className="block text-slate-500 text-xs">{l.name}</span>}
                  </td>
                  <td className="p-4">{l.campaignName ?? '—'}</td>
                  <td className="p-4"><ClicksCell clicks={l.clicks} uniqueClickers={l.uniqueClickers} /></td>
                  <td className="p-4">{l.subscribers}</td>
                  <td className="p-4">{l.unsubscribes ?? 0}</td>
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
