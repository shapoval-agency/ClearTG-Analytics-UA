import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import { CreateTrackingLinkForm } from './CreateTrackingLinkForm';
import { EmbedSnippet } from '@/components/EmbedSnippet';
import { isLocalMode } from '@/lib/local-mode';
import { LocalLinks } from '@/components/local/LocalLinks';
import { setTrackingLinkActiveAction } from '@/lib/actions';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

interface TrackingLink {
  id: string;
  slug: string;
  name: string | null;
  linkMode: 'LANDING_PAGE' | 'SHORTLINK';
  publicPath: string;
  destinationMode: string;
  isActive: boolean;
  channel: { title: string };
  campaign: { name: string; adPlatform?: string } | null;
  _count: { clickEvents: number };
}

const LINK_MODE_LABELS: Record<TrackingLink['linkMode'], string> = {
  LANDING_PAGE: 'Landing Page (paid)',
  SHORTLINK: 'Shortlink (organic/influencer)',
};

export default async function LinksPage() {
  if (isLocalMode()) return <LocalLinks />;

  let links: TrackingLink[] = [];
  let channels: Array<{ id: string; title: string }> = [];
  let campaigns: Array<{ id: string; name: string }> = [];
  try {
    [links, channels, campaigns] = await Promise.all([
      api<TrackingLink[]>('/api/tracking-links'),
      api<Array<{ id: string; title: string }>>('/api/channels'),
      api<Array<{ id: string; name: string }>>('/api/campaigns'),
    ]);
  } catch { /* empty */ }

  return (
    <div>
      <PageHeader
        title="Tracking Links"
        description="Landing page для paid traffic (Meta, Google, TikTok) або shortlink для organic/influencer"
      />
          {APP_URL.includes('localhost') && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900">
              <strong>localhost не працює для інших.</strong> Запустіть{' '}
              <code className="text-xs bg-amber-100 px-1 rounded">pnpm dev:tunnel</code>
              {' '}у другому терміналі — отримаєте публічний https://….loca.lt URL для посилань.
            </div>
          )}
      <CreateTrackingLinkForm channels={channels} campaigns={campaigns} />
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
                <span>{l.destinationMode}</span>
              </div>
              <EmbedSnippet slug={l.slug} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
