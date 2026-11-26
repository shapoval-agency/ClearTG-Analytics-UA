import Link from 'next/link';
import { api, AuthError } from '@/lib/api';
import { PageHeader, ErrorState, DisconnectedState, EmptyState } from '@/components/v2/ui';
import { LinksTabs } from '@/components/v2/links/LinksTabs';
import { GiftCard, type GiftItem } from '@/components/v2/gifts/GiftCard';
import { NewGiftPanel } from '@/components/v2/gifts/NewGiftPanel';
import type { GiftChannel } from '@/components/v2/gifts/GiftForm';

export const dynamic = 'force-dynamic';

/**
 * Подарунки (S4-01, S4-03, S4-04): підписник натискає кнопку під постом,
 * бот перевіряє підписку й видає матеріал. Видно, скільки людей забрали і з яких джерел.
 */
export default async function V2GiftsPage() {
  let gifts: GiftItem[] = [];
  let channels: Array<GiftChannel & { isActive?: boolean }> = [];
  let failed = false;
  let sessionExpired = false;

  try {
    [gifts, channels] = await Promise.all([
      api<GiftItem[]>('/api/lead-magnets'),
      api<Array<GiftChannel & { isActive?: boolean }>>('/api/channels'),
    ]);
  } catch (err) {
    if (err instanceof AuthError) sessionExpired = true;
    else failed = true;
  }

  const header = (
    <>
      <PageHeader
        title="Подарунки"
        description="Кнопка «Отримати подарунок» під постом: бот перевіряє підписку і сам видає матеріал. Подарунок приводить підписників, а не лише рахує їх."
      />
      <LinksTabs active="gifts" />
    </>
  );

  if (sessionExpired) {
    return (
      <>
        {header}
        <ErrorState title="Сесія завершилася" description="Увійдіть знову, щоб побачити свої подарунки." />
        <Link href="/login?next=/v2/links/gifts"
          className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Увійти
        </Link>
      </>
    );
  }

  if (failed) {
    return (
      <>
        {header}
        <ErrorState
          title="Не вдалося завантажити подарунки"
          description="Сервіс аналітики зараз не відповідає. Оновіть сторінку — якщо не допомогло, зверніться до підтримки."
        />
      </>
    );
  }

  const activeChannels = channels.filter((c) => c.isActive !== false).map(({ id, title }) => ({ id, title }));

  if (activeChannels.length === 0) {
    return (
      <>
        {header}
        <DisconnectedState
          title="Спочатку підключіть канал"
          description="Подарунок отримують підписники каналу, тому спершу потрібно його підключити."
          action={
            <Link href="/v2/channels" className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
              Перейти до каналів
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <NewGiftPanel channels={activeChannels} startOpen={gifts.length === 0} />
      {gifts.length === 0 ? (
        <EmptyState
          title="Подарунків ще немає"
          description="Створіть перший: чекліст, гайд, промокод — те, заради чого людина підпишеться на канал."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {gifts.map((gift) => <GiftCard key={gift.id} gift={gift} channels={activeChannels} />)}
        </div>
      )}
    </>
  );
}
