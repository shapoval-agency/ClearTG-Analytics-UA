import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import { CreateLeadMagnetForm } from './CreateLeadMagnetForm';

interface LeadMagnet {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  contentUrl: string | null;
  isActive: boolean;
  channel: { title: string };
  _count: { claims: number };
}

interface Channel {
  id: string;
  title: string;
}

export default async function LeadMagnetsPage() {
  let items: LeadMagnet[] = [];
  let channels: Channel[] = [];

  try {
    [items, channels] = await Promise.all([
      api<LeadMagnet[]>('/api/lead-magnets'),
      api<Channel[]>('/api/channels'),
    ]);
  } catch { /* empty */ }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'cleartg_bot';

  return (
    <div>
      <PageHeader
        title="Lead Magnets"
        description="Opt-in flow: користувач сам запускає бота, погоджується і отримує матеріал після перевірки підписки"
      />

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <CreateLeadMagnetForm channels={channels} />
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-900">
          <p className="font-medium mb-2">Як це працює</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-800">
            <li>Користувач переходить за bot-link</li>
            <li>Бачить текст згоди та підписується на канал вручну</li>
            <li>Надсилає боту: <strong>ПОГОДЖУЮСЬ</strong></li>
            <li>Отримує матеріал лише після перевірки підписки</li>
          </ol>
          <p className="mt-3 text-xs text-blue-700">/stop — відписка від бота. Без масових розсилок.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-slate-500">Ще немає lead magnets</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="text-sm text-slate-500">{item.channel.title}</p>
                </div>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded">{item._count.claims} claims</span>
              </div>
              {item.description && <p className="text-sm text-slate-600 mt-2">{item.description}</p>}
              <p className="font-mono text-sm text-brand-600 mt-3">
                https://t.me/{botUsername}?start=lm_{item.slug}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
