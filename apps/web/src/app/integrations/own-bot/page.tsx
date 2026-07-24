import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import { deleteClientBotAction } from '@/lib/actions';
import { ConnectClientBotForm } from './ConnectClientBotForm';

interface ClientBotConnection {
  id: string;
  botUsername: string;
  isActive: boolean;
  lastError: string | null;
  lastErrorAt: string | null;
  connectedAt: string;
}

export default async function OwnBotPage() {
  let connections: ClientBotConnection[] = [];
  let loadError = false;
  try {
    connections = await api<ClientBotConnection[]>('/api/client-bots');
  } catch {
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Свій бот (переходи в бота)"
        description="Відстежуємо перехід і /start у бота клієнта — точна атрибуція, Telegram сам передає мітку (блок 1.2)"
      />

      {loadError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900">
          Не вдалося завантажити список ботів. Увійдіть на{' '}
          <a href="/login?next=/integrations/own-bot" className="underline font-medium">/login</a>.
        </div>
      )}

      <ConnectClientBotForm />

      {connections.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
          <p>Ще немає підключених ботів.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border p-5 flex justify-between items-start">
              <div>
                <p className="font-medium">@{c.botUsername}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Підключено: {new Date(c.connectedAt).toLocaleString('uk-UA')}
                </p>
                {!c.isActive && c.lastError && (
                  <p className="text-xs text-red-600 mt-1">Помилка: {c.lastError}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {c.isActive ? 'Активний' : 'Помилка'}
                </span>
                <form action={deleteClientBotAction.bind(null, c.id)}>
                  <button type="submit" className="text-xs text-slate-500 underline hover:text-slate-700">
                    Відключити
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-6">
        Ми бачимо лише сам факт /start із нашою міткою. Що бот відповідає далі, вся інша
        переписка — не бачимо і не зберігаємо: токен дає доступ до отримання команди старту,
        а не до вмісту діалогів.
      </p>
    </div>
  );
}
