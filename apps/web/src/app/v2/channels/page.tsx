import Link from 'next/link';
import { api, AuthError } from '@/lib/api';
import { PageHeader, ErrorState, DisconnectedState } from '@/components/v2/ui';
import { ChannelCard, type ChannelListItem } from '@/components/v2/channels/ChannelCard';
import { ConnectChannelPanel } from '@/components/v2/channels/ConnectChannelPanel';

export const dynamic = 'force-dynamic';

/**
 * Канали — перший перенесений модуль MVP.
 *
 * Бекенд не змінювався: використовуються існуючі GET /api/channels,
 * GET /api/channels/:id/bot-status, POST /api/channels/sync-telegram і
 * PATCH /api/channels/:id/archive · /activate.
 *
 * Список будується зі збережених полів (миттєво, з БД). Жива перевірка прав
 * у Telegram — окремою кнопкою на каналі: бекенд робить реальний виклик
 * getChatMember, і перевірка всіх каналів при кожному відкритті сторінки
 * впиралася б у ліміти Telegram.
 */
export default async function V2ChannelsPage() {
  const botUsername =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, '') ?? 'cleartg_bot';

  let channels: ChannelListItem[] | null = null;
  let failed = false;
  let sessionExpired = false;

  try {
    channels = await api<ChannelListItem[]>('/api/channels');
  } catch (err) {
    // middleware перекидає на /login лише коли cookie немає зовсім.
    // Протухлий токен доходить сюди — показуємо зрозумілий стан,
    // а не падаємо в error boundary.
    if (err instanceof AuthError) sessionExpired = true;
    else failed = true;
  }

  const header = (
    <PageHeader
      title="Канали"
      description="Стан кожного каналу: чи фіксуються підписки і що зробити, якщо ні."
    />
  );

  // ── Error: сесія завершилася ───────────────────────────────────────
  if (sessionExpired) {
    return (
      <>
        {header}
        <ErrorState
          title="Сесія завершилася"
          description="Увійдіть знову, щоб побачити свої канали."
        />
        <Link
          href="/login?next=/v2/channels"
          className="inline-block mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          Увійти
        </Link>
      </>
    );
  }

  // ── Error: сервіс недоступний ──────────────────────────────────────
  // Технічний текст помилки навмисно не показуємо — він нічого не дає
  // користувачу і залишається в логах сервера.
  if (failed) {
    return (
      <>
        {header}
        <ErrorState
          title="Не вдалося завантажити канали"
          description="Сервіс аналітики зараз не відповідає. Оновіть сторінку — якщо не допомогло, зверніться до підтримки."
        />
      </>
    );
  }

  const list = channels ?? [];
  const active = list.filter((c) => c.isActive);
  const archived = list.filter((c) => !c.isActive);

  // ── Empty: каналів немає взагалі ───────────────────────────────────
  if (list.length === 0) {
    return (
      <>
        {header}
        <ConnectChannelPanel botUsername={botUsername} variant="empty" />
      </>
    );
  }

  // ── Success (+ Disconnected, якщо всі канали архівні) ──────────────
  return (
    <>
      {header}

      {active.length === 0 && (
        <div className="mb-6">
          <DisconnectedState
            title="Збір зупинено по всіх каналах"
            description="Усі канали архівовані — нові підписки й відписки не фіксуються. Історія збережена: відновіть будь-який канал, і збір продовжиться."
          />
        </div>
      )}

      {active.length > 0 && (
        <div className="grid gap-4 mb-6">
          {active.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-slate-500 mb-3">
            Архівні канали ({archived.length})
          </h2>
          <div className="grid gap-4">
            {archived.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        </section>
      )}

      <ConnectChannelPanel botUsername={botUsername} variant="compact" />
    </>
  );
}
