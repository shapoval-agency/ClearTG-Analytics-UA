import Link from 'next/link';
import {
  api,
  AuthError,
  type DashboardOverview,
  type CampaignReportRow,
  type SubscriberFeedRow,
  type UnsubscribeFeedRow,
} from '@/lib/api';
import { PageHeader, ErrorState, EmptyState } from '@/components/v2/ui';
import type { ChannelListItem } from '@/components/v2/channels/ChannelCard';
import type { TrackingLinkApi, InviteLinkApi } from '@/components/v2/links/link-kind';
import { ReportFilters } from '@/components/v2/reports/ReportFilters';
import { resolvePeriod } from '@/components/v2/reports/period';
import { OnboardingChecklist, type OnboardingStep } from '@/components/v2/overview/OnboardingChecklist';
import { OverviewKpiRow } from '@/components/v2/overview/OverviewKpiRow';
import { ActiveChannelsBlock } from '@/components/v2/overview/ActiveChannelsBlock';
import { TopSources } from '@/components/v2/overview/TopSources';
import { RecentActivity, type ActivityItem } from '@/components/v2/overview/RecentActivity';

export const dynamic = 'force-dynamic';

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Підписки й відписки — два різні запити, звести в одну стрічку треба на сторінці. */
function buildActivity(subs: SubscriberFeedRow[], unsubs: UnsubscribeFeedRow[]): ActivityItem[] {
  const subItems: ActivityItem[] = subs.map((s) => ({
    key: `sub-${s.id}`,
    type: 'subscribe',
    at: s.subscribedAt,
    label: s.telegramUsername ? `@${s.telegramUsername}` : `ID ${s.telegramUserId}`,
    detail: s.joinSource,
    href: `/v2/subscribers/${s.id}`,
  }));
  const unsubItems: ActivityItem[] = unsubs.map((u) => ({
    key: `unsub-${u.id}`,
    type: 'unsubscribe',
    at: u.occurredAt,
    label: u.telegramUsername ? `@${u.telegramUsername}` : `ID ${u.telegramUserId}`,
    detail: u.channelTitle,
  }));
  return [...subItems, ...unsubItems]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);
}

/**
 * Огляд — головний екран, останній розділ MVP-навігації.
 *
 * Не аналітична система: 10 секунд на відповідь «чи є проблема», а не
 * повний розбір (для нього — «Звіти» й «Учасники»). Дані й фільтри — ті
 * самі три вже готові API, що й у «Звітах» (getOverview/getCampaignReports з
 * from/to/channelId), плюс короткі зрізи getSubscriberFeed/getUnsubscribeFeed
 * для блоку активності. Жодного нового backend-виклику.
 */
export default async function V2OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; channelId?: string }>;
}) {
  const { period: periodParam, channelId } = await searchParams;
  const period = resolvePeriod(periodParam);
  const query = buildQuery({ from: period.from, to: period.to, channelId });

  const header = (
    <PageHeader
      title="Огляд"
      description="Що відбувається з вашими каналами й рекламою зараз."
    />
  );

  let channels: ChannelListItem[] = [];
  let overview: DashboardOverview | null = null;
  let campaigns: CampaignReportRow[] = [];
  let recentSubs: SubscriberFeedRow[] = [];
  let recentUnsubs: UnsubscribeFeedRow[] = [];
  let trackingLinks: TrackingLinkApi[] = [];
  let inviteLinks: InviteLinkApi[] = [];
  let failed = false;
  let sessionExpired = false;

  try {
    [channels, overview, campaigns, recentSubs, recentUnsubs, trackingLinks, inviteLinks] = await Promise.all([
      api<ChannelListItem[]>('/api/channels'),
      api<DashboardOverview>(`/api/dashboard/overview${query}`),
      api<CampaignReportRow[]>(`/api/dashboard/campaigns${query}`),
      api<SubscriberFeedRow[]>(`/api/dashboard/subscribers${buildQuery({ channelId, limit: '5' })}`),
      api<UnsubscribeFeedRow[]>(`/api/dashboard/unsubscribes${buildQuery({ channelId, limit: '5' })}`),
      api<TrackingLinkApi[]>('/api/tracking-links'),
      api<InviteLinkApi[]>('/api/invite-links'),
    ]);
  } catch (err) {
    if (err instanceof AuthError) sessionExpired = true;
    else failed = true;
  }

  // ── Error: сесія завершилася ───────────────────────────────────────
  if (sessionExpired) {
    return (
      <>
        {header}
        <ErrorState title="Сесія завершилася" description="Увійдіть знову, щоб побачити огляд." />
        <Link
          href="/login?next=/v2"
          className="inline-block mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          Увійти
        </Link>
      </>
    );
  }

  // ── Error: сервіс недоступний ──────────────────────────────────────
  if (failed || !overview) {
    return (
      <>
        {header}
        <ErrorState
          title="Не вдалося завантажити огляд"
          description="Сервіс аналітики зараз не відповідає. Оновіть сторінку — якщо не допомогло, зверніться до підтримки."
        />
      </>
    );
  }

  const isUnfiltered = period.value === 'all' && !channelId;
  // На відміну від «Звітів» (там достатньо clicks===0 — розділ саме про
  // рекламу), тут дивимось на ОБИДВА: канал може рости органічно (підписки
  // без жодного кліку) — таку активність ховати не можна, це і є «що
  // відбувається». Порожньо лише коли справді немає ні кліків, ні підписок.
  const hasAnyActivity = overview.clicks > 0 || overview.subscribers > 0;

  // ── Онбординг: взагалі жодної активності — не залежить від фільтра ──
  if (!hasAnyActivity && isUnfiltered) {
    const steps: OnboardingStep[] = [
      {
        label: 'Підключити канал',
        done: channels.length > 0,
        href: '/v2/channels',
        cta: 'Підключити канал',
      },
      {
        label: 'Створити посилання під джерело трафіку',
        done: trackingLinks.length > 0 || inviteLinks.length > 0,
        href: '/v2/links',
        cta: 'Створити посилання',
      },
      {
        label: 'Запустити трафік і отримати перший клік',
        done: overview.clicks > 0,
      },
    ];

    return (
      <>
        {header}
        <OnboardingChecklist steps={steps} />
      </>
    );
  }

  return (
    <>
      {header}
      <ReportFilters channels={channels} period={period.value} channelId={channelId} />

      {!hasAnyActivity ? (
        // ── Empty: дані загалом є, але не за цей фільтр ──────────────
        <EmptyState
          title="За цей період даних немає"
          description="Спробуйте розширити період або обрати інший канал — за весь час дані є."
        />
      ) : (
        <>
          <OverviewKpiRow overview={overview} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ActiveChannelsBlock channels={channels} />
            <TopSources rows={campaigns} />
            <div className="lg:col-span-2">
              <RecentActivity items={buildActivity(recentSubs, recentUnsubs)} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
