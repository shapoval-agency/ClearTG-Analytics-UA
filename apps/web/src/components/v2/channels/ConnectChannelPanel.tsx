'use client';

import { useState, useTransition } from 'react';
import { connectChannelV2Action } from '@/app/v2/actions';

/**
 * Підключення каналу.
 *
 * Основний шлях — додати бота адміністратором, після чого канал з'являється
 * сам. Ручне введення — запасний варіант для приватних каналів без
 * публічного @username, тому воно згорнуте за замовчуванням
 * (progressive disclosure з ТЗ).
 */
export function ConnectChannelPanel({
  botUsername,
  variant,
}: {
  botUsername: string;
  variant: 'empty' | 'compact';
}) {
  const [pending, startTransition] = useTransition();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(variant === 'empty');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await connectChannelV2Action(identifier);
      if (res.error) {
        setError(res.error);
        return;
      }
      setIdentifier('');
    });
  }

  const steps = (
    <ol className="space-y-1.5 text-sm text-slate-600">
      <li>1. Відкрийте свій Telegram-канал → Адміністратори → Додати</li>
      <li>
        2. Знайдіть бота <strong className="text-slate-900">@{botUsername}</strong> і
        додайте його
      </li>
      <li>3. Увімкніть право «Додавання учасників»</li>
      <li>4. Канал з&apos;явиться тут автоматично за кілька секунд</li>
    </ol>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {variant === 'empty' ? (
        <>
          <h2 className="font-semibold text-slate-900">Підключіть перший канал</h2>
          <p className="text-sm text-slate-600 mt-1 mb-4 max-w-xl">
            Поки бот не адміністратор каналу, Telegram не повідомляє нам про
            підписки й відписки — обійти це неможливо. Після підключення ви
            побачите, звідки приходить кожен підписник.
          </p>
          {steps}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-sm font-medium text-slate-700 hover:text-brand-700"
            aria-expanded={open}
          >
            {open ? '− ' : '+ '}Підключити ще один канал
          </button>
          {open && <div className="mt-4">{steps}</div>}
        </>
      )}

      {open && (
        <form onSubmit={submit} className="mt-5 border-t border-slate-100 pt-4">
          <label
            htmlFor="v2-channel-identifier"
            className="block text-sm text-slate-700"
          >
            Канал не з&apos;явився сам?
          </label>
          <p className="text-sm text-slate-500 mt-1 mb-2">
            Введіть @username каналу. Для приватного каналу — його chat id
            (виглядає як <code className="bg-slate-100 px-1 rounded">-1003751054664</code>).
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              id="v2-channel-identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="@mychannel або -100…"
              className="flex-1 min-w-[220px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pending || !identifier.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? 'Перевіряємо…' : 'Підключити'}
            </button>
          </div>
          {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
        </form>
      )}
    </div>
  );
}
