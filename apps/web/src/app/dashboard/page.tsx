import { api, DashboardOverview } from '@/lib/api';
import { PageHeader, StatCard } from '@/components/ui';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { isLocalMode } from '@/lib/local-mode';
import { LocalDashboard } from '@/components/local/LocalDashboard';
import Link from 'next/link';
import {
  attributionTypeLabel,
  confidenceLabelUk,
  formatDateUk,
  sourceSummary,
} from '@/lib/labels';

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function DashboardPage() {
  if (isLocalMode()) return <LocalDashboard />;

  const session = await getSession();
  if (!session.workspaceId) redirect('/onboarding');

  let data: DashboardOverview | null = null;
  let recentSubscribers: Array<{
    id: string;
    subscribedAt: string;
    channelTitle: string;
    attributionType: string;
    campaignName: string | null;
    trackingLinkSlug: string | null;
    confidenceScore: number;
    utmSource: string | null;
    utmCampaign: string | null;
  }> = [];
  let recentUnsubscribes: Array<{
    id: string;
    occurredAt: string;
    channelTitle: string;
    attributionType: string | null;
    campaignName: string | null;
    trackingLinkSlug: string | null;
    utmSource: string | null;
    utmCampaign: string | null;
  }> = [];

  try {
    [data, recentSubscribers, recentUnsubscribes] = await Promise.all([
      api<DashboardOverview>('/api/dashboard/overview'),
      api<typeof recentSubscribers>('/api/dashboard/subscribers').then((r) => r.slice(0, 5)),
      api<typeof recentUnsubscribes>('/api/dashboard/unsubscribes').then((r) => r.slice(0, 5)),
    ]);
  } catch {
    data = null;
  }

  let digest: {
    date: string;
    subscriptions: number;
    unsubscribes: number;
    netGrowth: number;
    clicks: number;
    clickToSubscribeRate: number;
  } | null = null;
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    digest = await api<{
      date: string;
      subscriptions: number;
      unsubscribes: number;
      netGrowth: number;
      clicks: number;
      clickToSubscribeRate: number;
    }>(
      `/api/dashboard/daily-digest?date=${yesterday.toISOString().slice(0, 10)}`,
    );
  } catch {
    digest = null;
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
          <p className="text-sm mt-1">Перевірте API_INTERNAL_URL у Vercel або увімкніть LOCAL_MODE.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Підписників всього" value={data.subscribers} />
            <StatCard label="У каналі зараз" value={data.activeSubscribers ?? data.subscribers} />
            <StatCard label="Відписки" value={data.unsubscribes} />
            <StatCard label="Кліки (реклама)" value={data.clicks} hint="Якщо використовуєте /l/ посилання" />
          </div>

          {digest && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-8">
              <h2 className="font-semibold mb-1">Звіт за вчора ({digest.date})</h2>
              <p className="text-xs text-slate-500 mb-4">Щоденна зведена аналітика для UA-ринку</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                <div><p className="text-slate-500">Підписки</p><p className="text-xl font-semibold">{digest.subscriptions}</p></div>
                <div><p className="text-slate-500">Відписки</p><p className="text-xl font-semibold">{digest.unsubscribes}</p></div>
                <div><p className="text-slate-500">Чистий приріст</p><p className="text-xl font-semibold">{digest.netGrowth}</p></div>
                <div><p className="text-slate-500">Кліки</p><p className="text-xl font-semibold">{digest.clicks}</p></div>
                <div><p className="text-slate-500">CR клік→підписка</p><p className="text-xl font-semibold">{pct(digest.clickToSubscribeRate)}</p></div>
              </div>
            </div>
          )}

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
                      <span className="text-slate-600">{attributionTypeLabel(a.type)}</span>
                      <span>{a.count} ({pct(a.share)}) · {a.confidenceLabel}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold">Останні підписки</h2>
                <Link href="/subscribers" className="text-sm text-brand-600 hover:underline">
                  Усі →
                </Link>
              </div>
              {recentSubscribers.length === 0 ? (
                <p className="text-slate-400 text-sm">Ще немає підписок</p>
              ) : (
                <div className="space-y-3">
                  {recentSubscribers.map((s) => (
                    <div key={s.id} className="text-sm border-b border-slate-100 pb-2 last:border-0">
                      <div className="flex justify-between">
                        <span className="font-medium">{sourceSummary(s)}</span>
                        <span className="text-slate-400">{formatDateUk(s.subscribedAt)}</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {s.channelTitle} · {attributionTypeLabel(s.attributionType)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold">Останні відписки</h2>
                <Link href="/subscribers" className="text-sm text-brand-600 hover:underline">
                  Усі →
                </Link>
              </div>
              {recentUnsubscribes.length === 0 ? (
                <p className="text-slate-400 text-sm">Відписок немає</p>
              ) : (
                <div className="space-y-3">
                  {recentUnsubscribes.map((u) => (
                    <div key={u.id} className="text-sm border-b border-slate-100 pb-2 last:border-0">
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {u.attributionType ? sourceSummary(u) : 'Невідоме джерело'}
                        </span>
                        <span className="text-slate-400">{formatDateUk(u.occurredAt)}</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{u.channelTitle}</p>
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
