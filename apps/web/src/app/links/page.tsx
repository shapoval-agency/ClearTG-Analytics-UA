import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import { CreateTrackingLinkForm } from './CreateTrackingLinkForm';
import { CreateSeedInviteLinkForm } from './CreateSeedInviteLinkForm';
import { EmbedSnippet } from '@/components/EmbedSnippet';
import { isLocalMode } from '@/lib/local-mode';
import { LocalLinks } from '@/components/local/LocalLinks';
import { setTrackingLinkActiveAction, revokeSeedInviteLinkAction } from '@/lib/actions';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

interface TrackingLink {
  id: string;
  slug: string;
  name: string | null;
  linkMode: 'LANDING_PAGE' | 'SHORTLINK';
  publicPath: string;
  destinationMode: string;
  postNumber: number | null;
  isActive: boolean;
  channel: { title: string };
  campaign: { name: string; adPlatform?: string } | null;
  _count: { clickEvents: number };
}

interface SeedInviteLink {
  id: string;
  name: string | null;
  telegramInviteLink: string;
  isRevoked: boolean;
  createdAt: string;
  channel: { title: string };
  campaign: { name: string; adPlatform?: string } | null;
  _count: { membershipEvents: number };
}

const LINK_MODE_LABELS: Record<TrackingLink['linkMode'], string> = {
  LANDING_PAGE: 'Landing Page (paid)',
  SHORTLINK: 'Shortlink (organic/influencer)',
};

export default async function LinksPage() {
  if (isLocalMode()) return <LocalLinks />;

  let links: TrackingLink[] = [];
  let seedLinks: SeedInviteLink[] = [];
  let channels: Array<{ id: string; title: string; username?: string | null }> = [];
  let campaigns: Array<{ id: string; name: string; adPlatform?: string }> = [];
  let botConnections: Array<{ id: string; botUsername: string; isActive: boolean }> = [];
  try {
    [links, seedLinks, channels, campaigns, botConnections] = await Promise.all([
      api<TrackingLink[]>('/api/tracking-links'),
      api<SeedInviteLink[]>('/api/invite-links'),
      api<Array<{ id: string; title: string; username?: string | null }>>('/api/channels'),
      api<Array<{ id: string; name: string; adPlatform?: string }>>('/api/campaigns'),
      api<Array<{ id: string; botUsername: string; isActive: boolean }>>('/api/client-bots'),
    ]);
  } catch { /* empty */ }

  return (
    <div>
      <PageHeader
        title="Tracking Links"
        description="Landing page для paid traffic (Meta, Google, TikTok) або shortlink для organic/influencer"
      />
      <div className="bg-white rounded-xl border p-5 mb-6 overflow-x-auto">
        <h2 className="font-semibold mb-3">4 типи посилань — що обрати</h2>
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-4">Тип</th>
              <th className="py-2 pr-4">Точність джерела</th>
              <th className="py-2 pr-4">Вміє</th>
              <th className="py-2">Не вміє</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            <tr className="border-b">
              <td className="py-2 pr-4 font-medium">Звичайне посилання (t.me/назва)</td>
              <td className="py-2 pr-4 text-slate-400">Немає — «джерело невідоме»</td>
              <td className="py-2 pr-4">Просто веде в канал</td>
              <td className="py-2">Нічого не повідомляє про джерело — тому вона нижче в списку</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4 font-medium">Запрошувальне (блок нижче)</td>
              <td className="py-2 pr-4 text-green-700">100% — факт від Telegram</td>
              <td className="py-2 pr-4">Точно знати джерело для посівів</td>
              <td className="py-2">Конкретний пост, UTM-мітки</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4 font-medium">Tracking-посилання (форма нижче)</td>
              <td className="py-2 pr-4 text-amber-700">Висока, але розрахункова</td>
              <td className="py-2 pr-4">Конкретний пост, повний набір UTM-міток, платну рекламу</td>
              <td className="py-2">Стовідсоткової точності — клік↔підписка вгадується у вікні атрибуції</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">Через бота («Свій бот» у формі нижче)</td>
              <td className="py-2 pr-4 text-green-700">100% — факт від Telegram</td>
              <td className="py-2 pr-4">Конкретний пост (у боті), мітку разом з /start</td>
              <td className="py-2">Працює лише всередині Telegram, не для зовнішньої реклами напряму</td>
            </tr>
          </tbody>
        </table>
      </div>
          {APP_URL.includes('localhost') && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900">
              <strong>localhost не працює для інших.</strong> Запустіть{' '}
              <code className="text-xs bg-amber-100 px-1 rounded">pnpm dev:tunnel</code>
              {' '}у другому терміналі — отримаєте публічний https://….loca.lt URL для посилань.
            </div>
          )}
      <CreateTrackingLinkForm channels={channels} campaigns={campaigns} botConnections={botConnections} />
      {links.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
          <p>Створіть перше tracking-посилання вище.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((l) => (
            <div key={l.id} className="bg-white rounded-xl border p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-mono text-brand-600">{APP_URL}{l.publicPath}</p>
                  {l.name && <p className="text-sm text-slate-600 mt-1">{l.name}</p>}
                  <p className="text-xs text-slate-500 mt-1">{LINK_MODE_LABELS[l.linkMode]}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${l.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
                    {l.isActive ? 'Активне' : 'Неактивне'}
                  </span>
                  <form action={setTrackingLinkActiveAction.bind(null, l.id, !l.isActive)}>
                    <button
                      type="submit"
                      className="text-xs text-slate-500 underline hover:text-slate-700"
                    >
                      {l.isActive ? 'Архівувати' : 'Активувати'}
                    </button>
                  </form>
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-sm text-slate-500">
                <span>{l.channel.title}</span>
                {l.campaign && <span>{l.campaign.name}</span>}
                <span>{l._count.clickEvents} кліків</span>
                <span>
                  {l.destinationMode === 'PUBLIC_POST' && l.postNumber
                    ? `На пост #${l.postNumber}`
                    : l.destinationMode}
                </span>
              </div>
              <EmbedSnippet slug={l.slug} />
            </div>
          ))}
        </div>
      )}

      <PageHeader
        title="Запрошувальні посилання (посіви)"
        description="Постійне посилання t.me/+код під конкретне джерело — Telegram сам повідомляє, якою скористались, тому джерело відоме на 100%. Без UTM і без конкретного поста — для цього є tracking-посилання вище."
      />
      <CreateSeedInviteLinkForm channels={channels} campaigns={campaigns} />
      {seedLinks.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
          <p>Ще немає запрошувальних посилань.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {seedLinks.map((l) => (
            <div key={l.id} className="bg-white rounded-xl border p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-mono text-brand-600">{l.telegramInviteLink}</p>
                  {l.name && <p className="text-sm text-slate-600 mt-1">{l.name}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${l.isRevoked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {l.isRevoked ? 'Відкликане' : 'Активне'}
                  </span>
                  {!l.isRevoked && (
                    <form action={revokeSeedInviteLinkAction.bind(null, l.id)}>
                      <button
                        type="submit"
                        className="text-xs text-slate-500 underline hover:text-slate-700"
                      >
                        Відкликати
                      </button>
                    </form>
                  )}
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-sm text-slate-500">
                <span>{l.channel.title}</span>
                {l.campaign && <span>{l.campaign.name}</span>}
                <span>{l._count.membershipEvents} підписок</span>
              </div>
              {l.isRevoked && (
                <p className="text-xs text-red-600 mt-2">
                  Посилання більше не працює в Telegram (відкликане тут або вручну в самому Telegram) —
                  накопичена статистика вище збережена.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
