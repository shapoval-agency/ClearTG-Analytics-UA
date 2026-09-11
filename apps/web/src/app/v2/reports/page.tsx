import Link from 'next/link';
import {
  api,
  AuthError,
  type DashboardOverview,
  type CampaignReportRow,
  type TrackingLinkReportRow,
} from '@/lib/api';
import { PageHeader, ErrorState, DisconnectedState, EmptyState } from '@/components/v2/ui';
import type { ChannelListItem } from '@/components/v2/channels/ChannelCard';
import { ReportFilters } from '@/components/v2/reports/ReportFilters';
import { KpiRow } from '@/components/v2/reports/KpiRow';
import { SourcesTable } from '@/components/v2/reports/SourcesTable';
import { LinksTable } from '@/components/v2/reports/LinksTable';
import { resolvePeriod } from '@/components/v2/reports/period';

export const dynamic = 'force-dynamic';

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Звіти — третій реалізований модуль MVP, поверх backend з
 * v2-reports-backend-review.md (period/channel-фільтри, reach вже готові
 * й протестовані). Тут лише фронтенд — жодних нових API чи полів.
 *
 * Один розділ зі спільними фільтрами (період, канал) замість шести
 * розрізнених сторінок старого кабінету. «Джерела» і «кампанії» — той самий
 * розріз (getCampaignReports() вже групує по кампанії), тому окремого блоку
 * не робимо. Розбивку по 5 типах атрибуції (S1-23) в цій ітерації свідомо
 * не показуємо окремим блоком — замість неї чесний рядок «Джерело не визначено»
 * прямо в «Джерелах», коли сума по кампаніях менша за загальну кількість
 * підписок (див. v2-reports-ui-plan.md, розділ 2).
 */
export default async function V2ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; channelId?: string }>;
}) {
  const { period: periodParam, channelId } = await searchParams;
  const period = resolvePeriod(periodParam);
  const query = buildQuery({ from: period.from, to: period.to, channelId });

  const header = (
    <PageHeader
      title="Звіти"
      description="Яке джерело приводить підписників і наскільки добре воно працює."
    />
  );

  let channels: ChannelListItem[] = [];
  let overview: DashboardOverview | null = null;
  let campaigns: CampaignReportRow[] = [];
  let links: TrackingLinkReportRow[] = [];
  let failed = false;
  let sessionExpired = false;

  try {
    [channels, overview, campaigns, links] = await Promise.all([
      api<ChannelListItem[]>('/api/channels'),
      api<DashboardOverview>(`/api/dashboard/overview${query}`),
      api<CampaignReportRow[]>(`/api/dashboard/campaigns${query}`),
      api<TrackingLinkReportRow[]>(`/api/dashboard/tracking-links${query}`),
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
        <ErrorState title="Сесія завершилася" description="Увійдіть знову, щоб побачити звіти." />
        <Link
          href="/login?next=/v2/reports"
          className="inline-block mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          Увійти
        </Link>
      </>
    );
  }

  // ── Error: сервіс недоступний ──────────────────────────────────────
  // Технічний текст помилки не показуємо — він лишається в логах сервера.
  if (failed || !overview) {
    return (
      <>
        {header}
        <ErrorState
          title="Не вдалося завантажити звіти"
          description="Сервіс аналітики зараз не відповідає. Оновіть сторінку — якщо не допомогло, зверніться до підтримки."
        />
      </>
    );
  }

  // ── Disconnected: каналів взагалі немає ────────────────────────────
  if (channels.length === 0) {
    return (
      <>
        {header}
        <DisconnectedState
          title="Спочатку підключіть канал"
          description="Звіти показують, звідки прийшли підписники вашого каналу — тому спершу потрібно його підключити."
          action={
            <Link href="/v2/channels" className="text-sm font-medium text-amber-800 hover:underline">
              Перейти до «Канали»
            </Link>
          }
        />
      </>
    );
  }

  const isUnfiltered = period.value === 'all' && !channelId;

  // ── Empty: реклами взагалі ще не було — не залежить від фільтра ───
  if (overview.clicks === 0 && isUnfiltered) {
    return (
      <>
        {header}
        <EmptyState
          title="Ви ще не запускали рекламу"
          description="Створіть трекінгове посилання під джерело трафіку — щойно з'являться перші кліки, тут буде видно результат."
          action={
            <Link href="/v2/links" className="text-sm font-medium text-brand-600 hover:underline">
              Перейти до «Посилання»
            </Link>
          }
        />
      </>
    );
  }

  // Різниця між загальною кількістю підписок і сумою по кампаніях — ті, хто
  // прийшов не через рекламу (пряме посилання, органіка). Не ховаємо в жодну
  // кампанію — «Джерела» покаже це окремим чесним рядком.
  const unattributedSubscribers = Math.max(
    0,
    overview.subscribers - campaigns.reduce((sum, c) => sum + c.subscribers, 0),
  );

  return (
    <>
      {header}
      <ReportFilters channels={channels} period={period.value} channelId={channelId} />

      {overview.clicks === 0 ? (
        // ── Empty: дані загалом є, але не за цей фільтр ──────────────
        <EmptyState
          title="За цей період даних немає"
          description="Спробуйте розширити період або обрати інший канал — за весь час дані є."
        />
      ) : (
        <>
          <KpiRow overview={overview} />
          <div className="grid gap-6">
            <SourcesTable rows={campaigns} unattributedSubscribers={unattributedSubscribers} />
            <LinksTable rows={links} />
          </div>
        </>
      )}
    </>
  );
}
