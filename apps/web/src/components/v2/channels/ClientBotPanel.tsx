'use client';

import { useState, useTransition } from 'react';
import { connectClientBotV2Action, disconnectClientBotV2Action } from '@/app/v2/actions';
import { Badge, Card } from '@/components/v2/ui';
import { formatDateUk } from '@/lib/labels';
import type { ClientBotConnection } from '@/lib/api';

/** Пояснення причини відключення людськими словами (код помилки Telegram — у логах). */
function botErrorHint(lastError: string): string {
  const e = lastError.toLowerCase();
  if (e.includes('token_unreadable') || e.includes('unable to authenticate data')) {
    return 'Токен цього бота збережено старим ключем шифрування (після переїзду сервера) — його треба ввести ще раз. Можна той самий.';
  }
  if (e.includes('401') || e.includes('404') || e.includes('unauthorized')) {
    return 'Telegram більше не приймає токен — його відкликали або бота видалено в @BotFather. Згенеруйте новий токен.';
  }
  if (e.includes('webhook')) {
    return 'У бота налаштований інший webhook (інший сервіс уже приймає його повідомлення). Вимкніть той webhook або підключіть окремого бота.';
  }
  if (e.includes('409')) {
    return 'Того самого бота одночасно запускав інший сервер. Зазвичай це минає саме — ми повторюємо спроби автоматично.';
  }
  return 'Бот перестав відповідати.';
}

/**
 * S2-02: власний бот клієнта. Для воронок, де продаж чи заявка відбуваються
 * в боті, а не в каналі. Після підключення посилання можна вести прямо в бота
 * і бачити окремо клік і запуск діалогу (S2-03, S2-04).
 */
export function ClientBotPanel({ bots }: { bots: ClientBotConnection[] }) {
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function connect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await connectClientBotV2Action(token);
      if (res.error) setError(res.error);
      else setToken('');
    });
  }

  function disconnect(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await disconnectClientBotV2Action(id);
      if (res.error) setError(res.error);
      setConfirmId(null);
    });
  }

  return (
    <div id="own-bot" className="mb-6 scroll-mt-24">
      <Card title="Ваш бот" hint="Якщо підписник іде не в канал, а в бота — для продажу, запису чи заявки">
        {bots.length > 0 && (
          <ul className="mb-4 divide-y divide-slate-100">
            {bots.map((bot) => (
              <li key={bot.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#102044]">@{bot.botUsername}</p>
                    <p className="text-xs text-slate-500">Підключено {formatDateUk(bot.connectedAt)}</p>
                  </div>
                  <Badge tone={bot.isActive ? 'ok' : 'neutral'}>{bot.isActive ? 'Працює' : 'Відключено'}</Badge>
                </div>
                {!bot.isActive && bot.lastError && (
                  <p className="mt-2 text-sm text-amber-700">
                    {botErrorHint(bot.lastError)} Щоб перепідключити, вставте токен цього бота у форму нижче —
                    історія переходів збережеться.
                  </p>
                )}
                {bot.isActive && (confirmId === bot.id ? (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">Відключити @{bot.botUsername}?</p>
                    <p className="mt-1">
                      Ми перестанемо фіксувати нові запуски бота. Посилання на нього й далі відкриватимуть бота,
                      але без обліку стартів. Уже зібрані переходи залишаться у звітах. Підключити знову можна тим самим токеном.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={pending} onClick={() => disconnect(bot.id)}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700 disabled:opacity-50">
                        {pending ? 'Відключаємо…' : 'Так, відключити'}
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-amber-300 px-3 py-1.5">
                        Скасувати
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmId(bot.id)}
                    className="mt-2 text-sm text-slate-500 hover:text-slate-700">
                    Відключити
                  </button>
                ))}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={connect} className="space-y-2">
          <label htmlFor="v2-bot-token" className="block text-sm font-bold text-[#102044]">
            {bots.length > 0 ? 'Підключити ще одного бота' : 'Підключити бота'}
          </label>
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-slate-600">
            <li>Відкрийте @BotFather у Telegram → оберіть свого бота → «API Token».</li>
            <li>Скопіюйте токен і вставте нижче.</li>
          </ol>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="v2-bot-token" type="password" autoComplete="off" value={token}
              onChange={(e) => setToken(e.target.value)} placeholder="123456789:AA…"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
            <button type="submit" disabled={pending || token.trim().length < 20}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">
              {pending ? 'Підключаємо…' : 'Підключити'}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Токен зберігається зашифрованим. Ми фіксуємо лише запуск бота (/start) і з якого кліку прийшла людина.
          </p>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </form>
      </Card>
    </div>
  );
}
