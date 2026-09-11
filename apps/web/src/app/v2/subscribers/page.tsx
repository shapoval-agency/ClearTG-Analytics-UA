import Link from 'next/link';
import { api, AuthError, type SubscriberFeedRow } from '@/lib/api';
import { PageHeader, ErrorState, DisconnectedState, EmptyState } from '@/components/v2/ui';
import type { ChannelListItem } from '@/components/v2/channels/ChannelCard';
import { SubscriberFilters } from '@/components/v2/subscribers/SubscriberFilters';
import { SubscriberTable } from '@/components/v2/subscribers/SubscriberTable';

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
 * Учасники — п'ятий і останній розділ MVP-навігації.
 *
 * Не CRM: єдина мета — перевірити довіру до решти кабінету на конкретній
 * людині. Бекенд не змінювався — getSubscriberFeed() вже приймає search/status
 * (і, з попередніх етапів, channelId/from/to, які тут свідомо НЕ виводимо
 * у фільтри — бриф прямо просить лишити тільки пошук і статус).
 */
export default async function V2SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const { search, status: statusParam } = await searchParams;
  const status = statusParam === 'active' || statusParam === 'left' ? statusParam : undefined;
  const query = buildQuery({ search, status });

  const header = (
    <PageHeader
      title="Учасники"
      description="Перевірка цифр на конкретній людині: звідки прийшла і що з нею було далі."
    />
  );

  let channels: ChannelListItem[] = [];
  let subscribers: SubscriberFeedRow[] = [];
  let failed = false;
  let sessionExpired = false;

  try {
    [channels, subscribers] = await Promise.all([
      api<ChannelListItem[]>('/api/channels'),
      api<SubscriberFeedRow[]>(`/api/dashboard/subscribers${query}`),
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
        <ErrorState title="Сесія завершилася" description="Увійдіть знову, щоб побачити учасників." />
        <Link
          href="/login?next=/v2/subscribers"
          className="inline-block mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          Увійти
        </Link>
      </>
    );
  }

  // ── Error: сервіс недоступний ──────────────────────────────────────
  if (failed) {
    return (
      <>
        {header}
        <ErrorState
          title="Не вдалося завантажити учасників"
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
          description="Учасники з'являються тут після підписок у вашому Telegram-каналі — спершу потрібно його підключити."
          action={
            <Link href="/v2/channels" className="text-sm font-medium text-amber-800 hover:underline">
              Перейти до «Канали»
            </Link>
          }
        />
      </>
    );
  }

  const isFiltered = Boolean(search || status);

  // ── Empty: підписників взагалі ще не було — не залежить від фільтра ─
  if (subscribers.length === 0 && !isFiltered) {
    return (
      <>
        {header}
        <EmptyState
          title="Учасників ще немає"
          description="Після першої підписки тут з'являться учасники."
          action={
            <Link href="/v2/links" className="text-sm font-medium text-brand-600 hover:underline">
              Створити посилання
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <SubscriberFilters search={search} status={status} />

      {subscribers.length === 0 ? (
        // ── Empty: за цим пошуком/фільтром нікого не знайдено ──────────
        <EmptyState
          title="Нікого не знайдено"
          description="Спробуйте змінити пошуковий запит або скинути фільтр статусу."
        />
      ) : (
        <SubscriberTable rows={subscribers} />
      )}
    </>
  );
}
