'use client';

import { PageHeader } from '@/components/ui';
import { useLocalData } from '@/hooks/useLocalData';
import { channelById } from '@/lib/local-store';

export function LocalChannelDetail({ id }: { id: string }) {
  const { state, ready } = useLocalData();
  if (!ready || !state) return <p className="text-slate-500">Завантаження…</p>;

  const channel = channelById(state, id);
  if (!channel) return <div className="text-slate-500">Канал не знайдено</div>;

  const campaigns = state.campaigns.filter((c) => c.channelId === id);

  return (
    <div>
      <PageHeader
        title={channel.title}
        description={channel.username ? `@${channel.username}` : undefined}
      />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Кліки</p>
          <p className="text-xl font-semibold">{channel.clicks}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Події</p>
          <p className="text-xl font-semibold">{channel.membershipEvents}</p>
        </div>
      </div>
      <h2 className="font-semibold mb-3">Кампанії</h2>
      {campaigns.length === 0 ? (
        <p className="text-slate-500 text-sm">Немає кампаній</p>
      ) : (
        <ul className="space-y-2">
          {campaigns.map((c) => (
            <li key={c.id} className="bg-white rounded-lg border px-4 py-3">{c.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
