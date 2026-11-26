import Link from 'next/link';
import { api, AuthError, type ClientBotConnection } from '@/lib/api';
import { PageHeader, Card, ErrorState, DisconnectedState } from '@/components/v2/ui';
import { LinksWorkspace } from '@/components/v2/links/LinksWorkspace';
import { LinksTabs } from '@/components/v2/links/LinksTabs';
import { LinkFilters } from '@/components/v2/links/LinkFilters';
import {
  LinkBuilder,
  type BuilderChannel,
  type BuilderCampaign,
} from '@/components/v2/links/LinkBuilder';
import {
  normalizeTrackingLink,
  normalizeInviteLink,
  mergeLinkRows,
  filterLinkRows,
  type LinkStatusFilter,
  type TrackingLinkApi,
  type InviteLinkApi,
} from '@/components/v2/links/link-kind';

export const dynamic = 'force-dynamic';

/**
 * Посилання — другий модуль MVP.
 *
 * Ключове продуктове рішення: користувач не обирає технічний режим
 * посилання (LinkMode). Він каже, звідки піде трафік, —
 * а бекенд сам виводить режим із платформи кампанії (link-mode.ts) і
 * відхилить неприпустиму комбінацію.
 */
export default async function V2LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ channelId?: string; status?: string }>;
}) {
  const { channelId, status: statusParam } = await searchParams;
  const status: LinkStatusFilter =
    statusParam === 'active' || statusParam === 'archived' ? statusParam : 'all';
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002').replace(/\/$/, '');

  let trackingLinks: TrackingLinkApi[] = [];
  let inviteLinks: InviteLinkApi[] = [];
  let channels: BuilderChannel[] = [];
  let campaigns: BuilderCampaign[] = [];
  let bots: ClientBotConnection[] = [];
  let failed = false;
  let sessionExpired = false;

  try {
    [trackingLinks, inviteLinks, channels, campaigns, bots] = await Promise.all([
      api<TrackingLinkApi[]>('/api/tracking-links'),
      api<InviteLinkApi[]>('/api/invite-links'),
      api<BuilderChannel[]>('/api/channels'),
      api<BuilderCampaign[]>('/api/campaigns'),
      // S2-02/S2-03: без ботів конструктор просто не пропонує «Ваш бот».
      api<ClientBotConnection[]>('/api/client-bots').catch(() => []),
    ]);
  } catch (err) {
    if (err instanceof AuthError) sessionExpired = true;
    else failed = true;
  }

  const header = (
    <>
      <PageHeader
        title="Посилання"
        description="Створіть посилання під конкретне джерело — і у звітах буде видно, звідки прийшов кожен підписник."
      />
      <LinksTabs active="links" />
    </>
  );

  if (sessionExpired) {
    return (
      <>
        {header}
        <ErrorState title="Сесія завершилася" description="Увійдіть знову, щоб побачити свої посилання." />
        <Link href="/login?next=/v2/links"
          className="inline-block mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Увійти
        </Link>
      </>
    );
  }

  // Технічний текст помилки не показуємо — він лишається в логах сервера.
  if (failed) {
    return (
      <>
        {header}
        <ErrorState
          title="Не вдалося завантажити посилання"
          description="Сервіс аналітики зараз не відповідає. Оновіть сторінку — якщо не допомогло, зверніться до підтримки."
        />
      </>
    );
  }

  // Без каналу посилання нікуди вести — відправляємо в «Канали».
  if (channels.length === 0) {
    return (
      <>
        {header}
        <DisconnectedState
          title="Спочатку підключіть канал"
          description="Посилання ведуть підписників у ваш Telegram-канал, тому спершу потрібно його підключити."
          action={
            <Link href="/v2/channels"
              className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
              Перейти до каналів
            </Link>
          }
        />
      </>
    );
  }

  const rows = mergeLinkRows([
    ...trackingLinks.map((l) => normalizeTrackingLink(l, appUrl)),
    ...inviteLinks.map(normalizeInviteLink),
  ]);

  // Empty: пояснюємо користь і одразу даємо конструктор.
  if (rows.length === 0) {
    return (
      <>
        {header}
        <Card className="mb-6">
          <h2 className="font-semibold text-slate-900">Створіть перше посилання</h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Якщо вести рекламу прямо на канал, підписки прийдуть без джерела — у звітах
            вони будуть як «джерело не визначено». Посилання під конкретне джерело дає
            відповідь, яка реклама справді працює.
          </p>
        </Card>
        <LinkBuilder channels={channels} campaigns={campaigns} bots={bots} appUrl={appUrl} />
      </>
    );
  }

  const visibleRows = filterLinkRows(rows, { channelId, status });

  return (
    <>
      {header}
      <LinkFilters channels={channels} channelId={channelId} status={status} />
      <LinksWorkspace
        rows={visibleRows}
        totalRows={rows.length}
        channels={channels}
        campaigns={campaigns}
        bots={bots}
        appUrl={appUrl}
      />
    </>
  );
}
