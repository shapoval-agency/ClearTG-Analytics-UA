import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import Link from 'next/link';

interface Campaign {
  id: string;
  name: string;
  adPlatform: string;
  channel: { title: string };
  _count: { clickEvents: number; trackingLinks: number };
}

interface CampaignReport {
  id: string;
  clicks: number;
  subscribers: number;
  conversionRate: number;
}

export default async function CampaignsPage() {
  let campaigns: Campaign[] = [];
  let reports: CampaignReport[] = [];
  try {
    [campaigns, reports] = await Promise.all([
      api<Campaign[]>('/api/campaigns'),
      api<CampaignReport[]>('/api/dashboard/campaigns'),
    ]);
  } catch { /* empty */ }

  const reportMap = new Map(reports.map((r) => [r.id, r]));

  return (
    <div>
      <PageHeader title="Кампанії" description="Рекламні кампанії та джерела трафіку" />
      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500">Немає кампаній</div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const r = reportMap.get(c.id);
            return (
            <Link key={c.id} href={`/campaigns/${c.id}`} className="block bg-white rounded-xl border p-5 hover:border-brand-300">
              <div className="flex justify-between">
                <h3 className="font-medium">{c.name}</h3>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded">{c.adPlatform}</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{c.channel.title}</p>
              <p className="text-sm text-slate-400 mt-2">
                {r?.clicks ?? c._count.clickEvents} кліків · {r?.subscribers ?? 0} підписок
                {r ? ` · CR ${(r.conversionRate * 100).toFixed(1)}%` : ''}
                {' · '}{c._count.trackingLinks} посилань
              </p>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
