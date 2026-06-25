import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';

interface Channel {
  id: string;
  title: string;
  username: string | null;
  botIsAdmin: boolean;
  campaigns: Array<{ id: string; name: string }>;
  _count: { membershipEvents: number; clickEvents: number; unsubscribeEvents: number };
}

export default async function ChannelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let channel: Channel | null = null;
  try {
    channel = await api<Channel>(`/api/channels/${id}`);
  } catch { /* empty */ }

  if (!channel) {
    return <div className="text-slate-500">Канал не знайдено</div>;
  }

  return (
    <div>
      <PageHeader title={channel.title} description={channel.username ? `@${channel.username}` : undefined} />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Кліки</p><p className="text-xl font-semibold">{channel._count.clickEvents}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Події</p><p className="text-xl font-semibold">{channel._count.membershipEvents}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Відписки</p><p className="text-xl font-semibold">{channel._count.unsubscribeEvents}</p></div>
      </div>
      <h2 className="font-semibold mb-3">Кампанії</h2>
      {channel.campaigns.length === 0 ? (
        <p className="text-slate-500 text-sm">Немає кампаній</p>
      ) : (
        <ul className="space-y-2">
          {channel.campaigns.map((c) => (
            <li key={c.id} className="bg-white rounded-lg border px-4 py-3">{c.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
