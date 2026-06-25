import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';

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
  let links: TrackingLink[] = [];
  try {
    links = await api<TrackingLink[]>('/api/tracking-links');
  } catch { /* empty */ }

  return (
    <div>
      <PageHeader
        title="Tracking Links"
        description="Landing page для paid traffic (Meta, Google, TikTok) або shortlink для organic/influencer"
      />
      {links.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
          <p>Створіть tracking link через API POST /api/tracking-links</p>
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
                <span className={`text-xs px-2 py-1 rounded ${l.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
                  {l.isActive ? 'Активне' : 'Неактивне'}
                </span>
              </div>
              <div className="flex gap-4 mt-3 text-sm text-slate-500">
                <span>{l.channel.title}</span>
                {l.campaign && <span>{l.campaign.name}</span>}
                <span>{l._count.clickEvents} кліків</span>
                <span>{l.destinationMode}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
