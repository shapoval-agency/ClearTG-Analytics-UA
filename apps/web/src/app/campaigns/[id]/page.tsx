import { api } from '@/lib/api';
import { getApiOrigin } from '@/lib/api-origin';
import { PageHeader } from '@/components/ui';

interface Campaign {
  id: string;
  name: string;
  adPlatform: string;
  source: string | null;
  medium: string | null;
  attributionWindowMinutes: number;
  channel: { title: string };
  trackingLinks: Array<{
    id: string;
    slug: string;
    name: string | null;
    linkMode?: 'LANDING_PAGE' | 'SHORTLINK';
  }>;
  _count: { clickEvents: number; attributions: number };
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let campaign: Campaign | null = null;
  try {
    campaign = await api<Campaign>(`/api/campaigns/${id}`);
  } catch { /* empty */ }

  if (!campaign) return <div className="text-slate-500">Кампанію не знайдено</div>;

  const apiUrl = process.env.NEXT_PUBLIC_APP_URL ?? getApiOrigin();

  return (
    <div>
      <PageHeader title={campaign.name} description={`${campaign.channel.title} · ${campaign.adPlatform}`} />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Кліки</p><p className="text-xl font-semibold">{campaign._count.clickEvents}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Атрибуції</p><p className="text-xl font-semibold">{campaign._count.attributions}</p></div>
      </div>
      <h2 className="font-semibold mb-3">Tracking Links</h2>
      {campaign.trackingLinks.length === 0 ? (
        <p className="text-slate-500 text-sm">Немає посилань</p>
      ) : (
        <ul className="space-y-2">
          {campaign.trackingLinks.map((l) => {
            const path = l.linkMode === 'SHORTLINK' ? `/r/${l.slug}` : `/l/${l.slug}`;
            return (
            <li key={l.id} className="bg-white rounded-lg border px-4 py-3 font-mono text-sm">
              {apiUrl}{path}
              {l.name && <span className="text-slate-500 ml-2">({l.name})</span>}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
