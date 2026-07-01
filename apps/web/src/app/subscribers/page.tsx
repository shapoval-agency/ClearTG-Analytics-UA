import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import { formatDateUk } from '@/lib/labels';

interface Member {
  id: string;
  subscribedAt: string;
  channelTitle: string;
  telegramUserId: string;
  telegramUsername: string | null;
  isActive: boolean;
  joinSource: string;
}

export default async function SubscribersPage() {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'cleartg_bot';
  let members: Member[] = [];
  let loadError = false;

  try {
    members = await api<Member[]>('/api/dashboard/subscribers');
  } catch {
    loadError = true;
  }

  const active = members.filter((m) => m.isActive);
  const left = members.filter((m) => !m.isActive);

  return (
    <div>
      <PageHeader
        title="Учасники каналу"
        description="Хто підписався або кого ви додали в Telegram. Без tracking-посилань — бот фіксує події сам."
      />

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
          <p className="text-sm text-slate-500">Всього записів</p>
          <p className="text-2xl font-semibold">{members.length}</p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
          <p>Поки нікого немає.</p>
          <p className="text-sm mt-2">Додайте тестового користувача в канал tets — він зʼявиться тут.</p>
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
                    {m.telegramUsername ? (
                      <span>@{m.telegramUsername}</span>
                    ) : (
                      <span className="text-slate-500 font-mono text-xs">id:{m.telegramUserId}</span>
                    )}
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
