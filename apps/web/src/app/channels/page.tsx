import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import Link from 'next/link';
import { isLocalMode } from '@/lib/local-mode';
import { LocalChannels } from '@/components/local/LocalChannels';
import { SyncChannelForm } from '@/components/SyncChannelForm';
import { setChannelActiveAction } from '@/lib/actions';
import { DeleteChannelButton } from '@/components/DeleteChannelButton';

interface Channel {
  id: string;
  title: string;
  username: string | null;
  botIsAdmin: boolean;
  isActive: boolean;
  _count: { membershipEvents: number; clickEvents: number };
}

export default async function ChannelsPage() {
  if (isLocalMode()) return <LocalChannels />;

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'cleartg_bot';

  let channels: Channel[] = [];
  let loadError: string | null = null;
  try {
    channels = await api<Channel[]>('/api/channels');
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Помилка завантаження';
  }

  return (
    <div>
      <PageHeader title="Канали" description="Telegram-канали, підключені до workspace" />

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6 text-sm text-blue-900">
        <p className="font-medium mb-2">Підключення каналу</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>Відкрийте свій Telegram-канал → Адміністратори → Додати адміністратора</li>
          <li>Знайдіть бота <strong>@{botUsername}</strong> і додайте його</li>
          <li>Увімкніть право «Додавання учасників» (для invite-лінків)</li>
          <li>Канал з&apos;явиться тут автоматично протягом кількох секунд</li>
        </ol>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 text-sm text-red-800">
          Не вдалося завантажити канали. Спробуйте{' '}
          <a href="/login?next=/channels" className="underline font-medium">увійти знову</a>
          {' '}(http://localhost:3002, не Vercel).
        </div>
      )}

      {channels.length === 0 ? (
        <>
          <SyncChannelForm />
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            <p>Ще немає каналів. Додайте бота адміністратором — він з&apos;явиться тут.</p>
          </div>
        </>
      ) : (
        <div className="grid gap-4 mb-6">
          {channels.map((ch) => {
            const hasData = ch._count.clickEvents > 0 || ch._count.membershipEvents > 0;
            return (
              <div key={ch.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex justify-between items-start gap-4">
                  <Link href={`/channels/${ch.id}`} className="hover:opacity-80 transition-opacity flex-1 min-w-0">
                    <h3 className="font-medium">{ch.title}</h3>
                    {ch.username ? (
                      <p className="text-sm text-slate-500">@{ch.username}</p>
                    ) : (
                      <p className="text-sm text-slate-400">приватний канал (без @username)</p>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded ${ch.botIsAdmin ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {ch.botIsAdmin ? 'Бот адмін' : 'Потрібні права'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${ch.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
                      {ch.isActive ? 'Активний' : 'Архівний'}
                    </span>
                    <form action={setChannelActiveAction.bind(null, ch.id, !ch.isActive)}>
                      <button type="submit" className="text-xs text-slate-500 underline hover:text-slate-700">
                        {ch.isActive ? 'Архівувати' : 'Активувати'}
                      </button>
                    </form>
                    <DeleteChannelButton id={ch.id} title={ch.title} hasData={hasData} />
                  </div>
                </div>
                <Link href={`/channels/${ch.id}`} className="flex gap-4 mt-3 text-sm text-slate-500 hover:text-slate-700">
                  <span>{ch._count.clickEvents} кліків</span>
                  <span>{ch._count.membershipEvents} подій</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {channels.length > 0 && (
        <details className="text-sm text-slate-500">
          <summary className="cursor-pointer hover:text-slate-700">Додати інший канал вручну</summary>
          <div className="mt-3">
            <SyncChannelForm />
          </div>
        </details>
      )}
    </div>
  );
}
