import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import Link from 'next/link';


interface Channel {
  id: string;
  title: string;
  username: string | null;
  botIsAdmin: boolean;
  isActive: boolean;
  _count: { membershipEvents: number; clickEvents: number };
}

export default async function ChannelsPage() {
  let channels: Channel[] = [];
  try {
    channels = await api<Channel[]>('/api/channels');
  } catch { /* empty */ }

  return (
    <div>
      <PageHeader title="Канали" description="Telegram-канали, підключені до workspace" />
      {channels.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          <p>Немає каналів. Додайте бота адміністратором каналу та зареєструйте канал через API.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {channels.map((ch) => (
            <Link key={ch.id} href={`/channels/${ch.id}`} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-brand-300 transition-colors block">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{ch.title}</h3>
                  {ch.username && <p className="text-sm text-slate-500">@{ch.username}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded ${ch.botIsAdmin ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {ch.botIsAdmin ? 'Бот адмін' : 'Потрібні права'}
                </span>
              </div>
              <div className="flex gap-4 mt-3 text-sm text-slate-500">
                <span>{ch._count.clickEvents} кліків</span>
                <span>{ch._count.membershipEvents} подій</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
