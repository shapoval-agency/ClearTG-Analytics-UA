import Link from 'next/link';
import { headers } from 'next/headers';
import { api, AuthError, type ClientBotConnection, type DigestSettings, type IntegrationStatus } from '@/lib/api';
import { PageHeader, ErrorState, DisconnectedState } from '@/components/v2/ui';
import { ChannelCard, type ChannelListItem } from '@/components/v2/channels/ChannelCard';
import { ConnectChannelPanel } from '@/components/v2/channels/ConnectChannelPanel';
import type { BotStatusResponse } from '@/components/v2/channels/channel-status';
import { IntegrationHealthPanel } from '@/components/v2/channels/IntegrationHealthPanel';
import { DigestSettingsPanel } from '@/components/v2/channels/DigestSettingsPanel';
import { ClientBotPanel } from '@/components/v2/channels/ClientBotPanel';
import { ApiKeysPanel } from '@/components/v2/channels/ApiKeysPanel';
import type { ApiKeyItem } from '@/app/v2/actions';

export const dynamic = 'force-dynamic';

/** Адреса для прикладу в документації API: той самий домен, /api проксюється на API. */
async function publicBaseUrl() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Збережені права бота можуть бути застарілими: канал підключили до появи
 * поля `botCanInviteUsers` (у БД воно тоді false) або Telegram-подію про зміну
 * прав пропущено. Тому для активного каналу, де збережено проблему з правами
 * (або старий API не віддав поле), уточнюємо реальний стан через bot-status —
 * він же оновлює запис у БД. Канали без проблем Telegram не смикають.
 */
async function hydrateLegacyBotPermissions(channels: ChannelListItem[]) {
  return Promise.all(channels.map(async (channel) => {
    const storedOk = channel.botIsAdmin && channel.botCanInviteUsers === true;
    if (!channel.isActive || storedOk) return channel;

    try {
      const check = await api<BotStatusResponse>(`/api/channels/${channel.id}/bot-status`);
      return {
        ...channel,
        botIsAdmin: check.isAdmin,
        botCanInviteUsers: check.canInviteUsers,
      };
    } catch {
      // Якщо жива перевірка тимчасово недоступна, не підміняємо unknown на
      // false: картка не повинна показувати вигадану проблему з правами.
      return channel;
    }
  }));
}

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
  let integrationStatus: IntegrationStatus | null = null;
  let digestSettings: DigestSettings | null = null;
  let clientBots: ClientBotConnection[] | null = null;
  let apiKeys: ApiKeyItem[] | null = null;
  let failed = false;
  let sessionExpired = false;

  try {
    const storedChannels = await api<ChannelListItem[]>('/api/channels');
    channels = await hydrateLegacyBotPermissions(storedChannels);
    // Нові S2 endpoints не повинні ламати базовий список під час rolling deploy,
    // коли web уже оновився, а API ще збирається.
    const [integrationResult, digestResult, botsResult, apiKeysResult] = await Promise.allSettled([
      api<IntegrationStatus>('/api/channels/integration-status'),
      api<DigestSettings>('/api/telegram/digest-settings'),
      api<ClientBotConnection[]>('/api/client-bots'),
      api<ApiKeyItem[]>('/api/api-keys'),
    ]);
    if (integrationResult.status === 'fulfilled') integrationStatus = integrationResult.value;
    if (digestResult.status === 'fulfilled') digestSettings = digestResult.value;
    if (botsResult.status === 'fulfilled') clientBots = botsResult.value;
    if (apiKeysResult.status === 'fulfilled') apiKeys = apiKeysResult.value;
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
        <IntegrationHealthPanel status={integrationStatus} />
        <DigestSettingsPanel initial={digestSettings} channels={list} />
        <ConnectChannelPanel botUsername={botUsername} variant="empty" />
      </>
    );
  }

  // ── Success (+ Disconnected, якщо всі канали архівні) ──────────────
  return (
    <>
      {header}

      <IntegrationHealthPanel status={integrationStatus} />
      <DigestSettingsPanel initial={digestSettings} channels={list} />

      {active.length === 0 && (
        <div className="mb-6">
          <DisconnectedState
            title="Збір зупинено по всіх каналах"
            description="Усі канали архівовані — нові підписки й відписки не фіксуються. Історія збережена: відновіть будь-який канал, і збір продовжиться."
          />
        </div>
      )}

      {active.length > 0 && (
        <div className="mb-6 grid gap-4 xl:grid-cols-2">
          {active.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-bold text-slate-500">
            Архівні канали ({archived.length})
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {archived.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        </section>
      )}

      <ConnectChannelPanel botUsername={botUsername} variant="compact" />
      {clientBots && <ClientBotPanel bots={clientBots} />}
      {apiKeys && <ApiKeysPanel keys={apiKeys} apiBaseUrl={await publicBaseUrl()} />}
    </>
  );
}
