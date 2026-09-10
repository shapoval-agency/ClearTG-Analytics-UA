import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import { formatDateUk } from '@/lib/labels';
import Link from 'next/link';

interface Member {
  id: string;
  subscribedAt: string;
  channelTitle: string;
  telegramUserId: string;
  telegramUsername: string | null;
  isActive: boolean;
  joinSource: string;
}

interface Channel {
  id: string;
  title: string;
}

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; channelId?: string; status?: string }>;
}) {
  const { q, channelId, status } = await searchParams;
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'cleartg_bot';
  let members: Member[] = [];
  let channels: Channel[] = [];
  let loadError = false;

  try {
    [members, channels] = await Promise.all([
      api<Member[]>(`/api/dashboard/subscribers${qs({ search: q, channelId, status })}`),
      api<Channel[]>('/api/channels'),
    ]);
  } catch {
    loadError = true;
  }

  const active = members.filter((m) => m.isActive);
  const left = members.filter((m) => !m.isActive);
  const hasFilters = Boolean(q || channelId || status);

  return (
    <div>
      <PageHeader
        title="Учасники каналу"
        description="Хто підписався або кого ви додали в Telegram. Без tracking-посилань — бот фіксує події сам."
      >
        <a
          href={`/api/dashboard/subscribers/export.csv`}
          className="text-sm text-brand-600 hover:underline"
        >
          Експорт CSV
        </a>
      </PageHeader>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6 text-sm text-blue-900">
        <p className="font-medium mb-2">Як це працює</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>Бот <strong>@{botUsername}</strong> — адмін каналу з правом бачити учасників</li>
          <li>Додайте людину в канал або вона сама підпишеться</li>
          <li>Через кілька секунд зʼявиться тут (режим polling, tunnel не потрібен)</li>
          <li>Відписка з каналу теж фіксується</li>
        </ol>
      </div>

      {loadError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm">
          Не вдалося завантажити. Увійдіть на{' '}
          <a href="/login?next=/subscribers" className="underline">/login</a>.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">У каналі зараз</p>
          <p className="text-2xl font-semibold">{active.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Відписались</p>
          <p className="text-2xl font-semibold">{left.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Всього записів{hasFilters ? ' (за фільтром)' : ''}</p>
          <p className="text-2xl font-semibold">{members.length}</p>
        </div>
      </div>

      <form className="bg-white rounded-xl border p-4 mb-6 flex flex-wrap items-end gap-3" method="get">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-slate-500 mb-1">Пошук за @username або id</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="username або telegram id"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs text-slate-500 mb-1">Канал</label>
          <select name="channelId" defaultValue={channelId ?? ''} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Усі канали</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.title}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-slate-500 mb-1">Статус</label>
          <select name="status" defaultValue={status ?? ''} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Усі</option>
            <option value="active">У каналі</option>
            <option value="left">Відписався</option>
          </select>
        </div>
        <button type="submit" className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-700">
          Застосувати
        </button>
        {hasFilters && (
          <Link href="/subscribers" className="text-sm text-slate-500 underline hover:text-slate-700">
            Скинути
          </Link>
        )}
      </form>

      {members.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
          {hasFilters ? (
            <p>Нічого не знайдено за цим фільтром.</p>
          ) : (
            <>
              <p>Поки нікого немає.</p>
              <p className="text-sm mt-2">Додайте тестового користувача в канал tets — він зʼявиться тут.</p>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-4">Дата</th>
                <th className="p-4">Канал</th>
                <th className="p-4">Користувач</th>
                <th className="p-4">Джерело</th>
                <th className="p-4">Статус</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="p-4 whitespace-nowrap">{formatDateUk(m.subscribedAt)}</td>
                  <td className="p-4">{m.channelTitle}</td>
                  <td className="p-4">
                    <Link href={`/subscribers/${m.id}`} className="text-brand-600 hover:underline">
                      {m.telegramUsername ? (
                        <span>@{m.telegramUsername}</span>
                      ) : (
                        <span className="text-slate-500 font-mono text-xs">id:{m.telegramUserId}</span>
                      )}
                    </Link>
                  </td>
                  <td className="p-4">{m.joinSource}</td>
                  <td className="p-4">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        m.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {m.isActive ? 'У каналі' : 'Відписався'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
