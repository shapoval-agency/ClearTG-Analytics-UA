import Link from 'next/link';
import { api, AuthError } from '@/lib/api';
import { PageHeader, Card, ErrorState, DisconnectedState } from '@/components/v2/ui';
import { LinkList } from '@/components/v2/links/LinkList';
import {
  LinkBuilder,
  type BuilderChannel,
  type BuilderCampaign,
} from '@/components/v2/links/LinkBuilder';
import {
  normalizeTrackingLink,
  normalizeInviteLink,
  mergeLinkRows,
  type TrackingLinkApi,
  type InviteLinkApi,
} from '@/components/v2/links/link-kind';

export const dynamic = 'force-dynamic';

/**
 * Посилання — другий модуль MVP.
 *
 * Бекенд не змінювався. Ключове продуктове рішення: користувач не обирає
 * технічний режим посилання (LinkMode). Він каже, звідки піде трафік, —
 * а бекенд сам виводить режим із платформи кампанії (link-mode.ts) і
 * відхилить неприпустиму комбінацію.
 */
export default async function V2LinksPage() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002').replace(/\/$/, '');

  let trackingLinks: TrackingLinkApi[] = [];
  let inviteLinks: InviteLinkApi[] = [];
  let channels: BuilderChannel[] = [];
  let campaigns: BuilderCampaign[] = [];
  let failed = false;
  let sessionExpired = false;

  try {
    [trackingLinks, inviteLinks, channels, campaigns] = await Promise.all([
      api<TrackingLinkApi[]>('/api/tracking-links'),
      api<InviteLinkApi[]>('/api/invite-links'),
      api<BuilderChannel[]>('/api/channels'),
      api<BuilderCampaign[]>('/api/campaigns'),
    ]);
  } catch (err) {
    if (err instanceof AuthError) sessionExpired = true;
    else failed = true;
  }

  const header = (
    <PageHeader
      title="Посилання"
      description="Створіть посилання під конкретне джерело — і у звітах буде видно, звідки прийшов кожен підписник."
    />
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
            вони будуть як «джерело не визначене». Посилання під конкретне джерело дає
            відповідь, яка реклама справді працює.
          </p>
        </Card>
        <LinkBuilder channels={channels} campaigns={campaigns} appUrl={appUrl} />
      </>
    );
  }

  return (
    <>
      {header}
      <LinkList rows={rows} />
      <details className="bg-white rounded-xl border border-slate-200 p-5">
        <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-brand-700">
          + Створити посилання
        </summary>
        <div className="mt-4">
          <LinkBuilder channels={channels} campaigns={campaigns} appUrl={appUrl} />
        </div>
      </details>
    </>
  );
}
