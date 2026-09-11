import Link from 'next/link';
import {
  api,
  AuthError,
  type SubscriberDossier,
  type SubscriberFeedRow,
} from '@/lib/api';
import { PageHeader, Card, Badge, ErrorState } from '@/components/v2/ui';
import { attributionTypeLabel, confidenceLabelUk, formatDateUk, formatPercentUk } from '@/lib/labels';
import { CycleHistory } from '@/components/v2/subscribers/CycleHistory';

export const dynamic = 'force-dynamic';

const AD_SOURCE_TYPES = ['EXACT_CLICK_INVITE', 'CAMPAIGN_INVITE', 'PROBABILISTIC'];

/**
 * Картка учасника.
 *
 * getSubscriberDossier() віддає ОДИН профіль — один цикл підписка→(відписка).
 * Історія кількох циклів (resubscribe) збирається тут другим викликом уже
 * готового /api/dashboard/subscribers?search=<telegramUserId> — деталі й
 * чому так, а не новим backend-методом, в v2-subscribers-plan.md.
 */
export default async function V2SubscriberDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const header = (
    <PageHeader title="Учасник">
      <Link href="/v2/subscribers" className="text-sm text-brand-600 hover:underline">
        ← До списку учасників
      </Link>
    </PageHeader>
  );

  let dossier: SubscriberDossier | null = null;
  let sessionExpired = false;
  let notFoundError = false;
  let failed = false;

  try {
    dossier = await api<SubscriberDossier>(`/api/dashboard/subscribers/${id}`);
  } catch (err) {
    if (err instanceof AuthError) sessionExpired = true;
    else if (err instanceof Error && err.message.includes('404')) notFoundError = true;
    else failed = true;
  }

  if (sessionExpired) {
    return (
      <>
        {header}
        <ErrorState title="Сесія завершилася" description="Увійдіть знову, щоб побачити картку." />
        <Link
          href={`/login?next=/v2/subscribers/${id}`}
          className="inline-block mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          Увійти
        </Link>
      </>
    );
  }

  if (notFoundError) {
    return (
      <>
        {header}
        <ErrorState
          title="Учасника не знайдено"
          description="Можливо, посилання застаріло або запис належить іншому робочому простору."
        />
      </>
    );
  }

  if (failed || !dossier) {
    return (
      <>
        {header}
        <ErrorState
          title="Не вдалося завантажити картку"
          description="Сервіс аналітики зараз не відповідає. Оновіть сторінку — якщо не допомогло, зверніться до підтримки."
        />
      </>
    );
  }

  // Історія циклів — другорядна інформація: якщо запит впав, картка все одно
  // повинна показати основні дані, тому помилку тут не піднімаємо нагору.
  let cycles: SubscriberFeedRow[] = [];
  try {
    const candidates = await api<SubscriberFeedRow[]>(
      `/api/dashboard/subscribers?search=${encodeURIComponent(dossier.telegramUserId)}&channelId=${dossier.channel.id}&limit=50`,
    );
    cycles = candidates
      .filter((c) => c.telegramUserId === dossier!.telegramUserId)
      .sort((a, b) => new Date(a.subscribedAt).getTime() - new Date(b.subscribedAt).getTime());
  } catch {
    cycles = [];
  }

  const attr = dossier.attribution;
  const hasAdSource = Boolean(
    attr && AD_SOURCE_TYPES.includes(attr.type) && (attr.campaign || attr.trackingLink),
  );
  const isOrganic = attr?.type === 'ORGANIC';

  // getSubscriberDossier() віддає для посилання лише slug (attr.trackingLink),
  // без людської назви — на відміну від getSubscriberFeed(), де вона вже є.
  // Не чіпаючи бекенд, дістаємо назву з уже завантаженого cycles (той самий
  // профіль там теж присутній, якщо запит історії не впав).
  const currentCycle = cycles.find((c) => c.id === dossier!.id);
  const trackingLinkDisplay = attr?.trackingLink
    ? (currentCycle?.trackingLinkName ?? `/${attr.trackingLink}`)
    : null;

  const lastUnsubscribe = dossier.unsubscribes[0] ?? null;

  return (
    <>
      {header}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Основна інформація">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Учасник</dt>
              <dd className="font-medium text-slate-900">
                {dossier.telegramUsername ? `@${dossier.telegramUsername}` : `ID ${dossier.telegramUserId}`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Канал</dt>
              <dd className="text-slate-800">{dossier.channel.title}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Статус</dt>
              <dd>
                <Badge tone={dossier.isActive ? 'ok' : 'neutral'}>
                  {dossier.isActive ? 'Активний' : 'Неактивний'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Дата підписки</dt>
              <dd className="text-slate-800">{formatDateUk(dossier.subscribedAt)}</dd>
            </div>
            {!dossier.isActive && (
              <div>
                <dt className="text-slate-500">Дата відписки</dt>
                <dd className="text-slate-800">
                  {lastUnsubscribe ? formatDateUk(lastUnsubscribe.occurredAt) : '—'}
                  <span className="text-slate-400"> · пробув у каналі {dossier.daysInChannel} дн.</span>
                </dd>
              </div>
            )}
            {dossier.isActive && (
              <div>
                <dt className="text-slate-500">У каналі</dt>
                <dd className="text-slate-800">{dossier.daysInChannel} дн.</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card title="Джерело">
          {hasAdSource && attr ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Точність</dt>
                <dd className="text-slate-800">
                  {attributionTypeLabel(attr.type)}
                  <span className="text-slate-400">
                    {' '}
                    · впевненість {confidenceLabelUk(attr.confidence)} ({formatPercentUk(attr.confidence)})
                  </span>
                </dd>
              </div>
              {attr.campaign && (
                <div>
                  <dt className="text-slate-500">Кампанія</dt>
                  <dd className="text-slate-800">{attr.campaign}</dd>
                </div>
              )}
              {trackingLinkDisplay && (
                <div>
                  <dt className="text-slate-500">Посилання</dt>
                  <dd className="text-slate-800">{trackingLinkDisplay}</dd>
                </div>
              )}
            </dl>
          ) : isOrganic ? (
            <p className="text-sm text-slate-700">
              Прямий вступ у Telegram — без переходу за рекламним посиланням.
            </p>
          ) : (
            <p className="text-sm text-slate-500 italic">Джерело не визначено</p>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card
          title="Історія"
          hint={
            cycles.length > 1
              ? `${cycles.length} цикли підписки на цей канал`
              : 'Єдиний зафіксований цикл підписки на цей канал'
          }
        >
          {cycles.length > 0 ? (
            <CycleHistory cycles={cycles} currentId={dossier.id} />
          ) : (
            <p className="text-sm text-slate-500">
              Підписався {formatDateUk(dossier.subscribedAt)}
              {!dossier.isActive && lastUnsubscribe && (
                <> · відписався {formatDateUk(lastUnsubscribe.occurredAt)}</>
              )}
              .
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
