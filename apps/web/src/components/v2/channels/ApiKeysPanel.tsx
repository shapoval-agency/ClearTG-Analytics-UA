'use client';

import { useState, useTransition } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { createApiKeyV2Action, revokeApiKeyV2Action, type ApiKeyItem } from '@/app/v2/actions';
import { Card } from '@/components/v2/ui';
import { formatDateUk } from '@/lib/labels';

const RESPONSE_EXAMPLE = `{
  "found": true,
  "telegram_user_id": "123456789",
  "subscriptions": [{
    "channel": { "id": "…", "title": "Мій канал", "username": "my_channel" },
    "subscribed_at": "2026-11-20T10:00:00.000Z",
    "still_subscribed": true,
    "source": {
      "type": "tracking_link",
      "confidence": "exact",
      "tracking_link": { "id": "…", "name": "Instagram сторіс" },
      "campaign": { "id": "…", "name": "Чорна пʼятниця" },
      "utm": { "source": "instagram" }
    }
  }]
}`;

/**
 * S4-12, S4-13: ключі, за якими CRM клієнта дізнається джерело покупця.
 * Ключ показуємо один раз — у базі лежить лише його хеш.
 */
export function ApiKeysPanel({ keys, apiBaseUrl }: { keys: ApiKeyItem[]; apiBaseUrl: string }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await createApiKeyV2Action(name.trim());
      if (res.error || !res.key) {
        setError(res.error ?? 'Не вдалося створити ключ');
        return;
      }
      setNewKey(res.key);
      setName('');
    });
  }

  function revoke(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await revokeApiKeyV2Action(id);
      if (res.error) setError(res.error);
      setConfirmId(null);
    });
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
    } catch {
      setError('Не вдалося скопіювати — виділіть ключ і скопіюйте вручну.');
    }
  }

  const curl = `curl "${apiBaseUrl}/api/v1/source?telegram_user_id=123456789" \\\n  -H "Authorization: Bearer ctg_…"`;

  return (
    <div id="api" className="mb-6 scroll-mt-24">
      <Card title="API для CRM" hint="CRM чи ваш розробник за Telegram ID покупця дізнається, звідки він прийшов у канал">
        {newKey && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-bold">Ключ створено. Скопіюйте його зараз — більше ми його не покажемо.</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800 ring-1 ring-emerald-200">
                {newKey}
              </code>
              <button type="button" onClick={copyKey}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                {copied ? 'Скопійовано' : 'Копіювати'}
              </button>
            </div>
            <button type="button" onClick={() => setNewKey(null)} className="mt-2 text-xs font-semibold underline">
              Я зберіг ключ, сховати
            </button>
          </div>
        )}

        {keys.length > 0 ? (
          <ul className="mb-4 divide-y divide-slate-100">
            {keys.map((key) => (
              <li key={key.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-[#102044]">{key.name}</p>
                    <p className="text-xs text-slate-500">
                      Створено {formatDateUk(key.createdAt)} ·{' '}
                      {key.lastUsedAt ? `останній запит ${formatDateUk(key.lastUsedAt)}` : 'ще не використовувався'}
                    </p>
                  </div>
                  {confirmId !== key.id && (
                    <button type="button" onClick={() => setConfirmId(key.id)}
                      className="text-sm text-slate-500 hover:text-slate-700">
                      Відкликати
                    </button>
                  )}
                </div>
                {confirmId === key.id && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">Відкликати «{key.name}»?</p>
                    <p className="mt-1">Запити з цим ключем одразу перестануть працювати. Повернути його не можна — лише створити новий.</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={pending} onClick={() => revoke(key.id)}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700 disabled:opacity-50">
                        {pending ? 'Відкликаємо…' : 'Так, відкликати'}
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)} className="rounded-lg border border-amber-300 px-3 py-1.5">
                        Скасувати
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-slate-600">Ключів ще немає. Створіть окремий ключ для кожної системи — так його легко відкликати.</p>
        )}

        <form onSubmit={create} className="space-y-2">
          <label htmlFor="v2-api-key-name" className="block text-sm font-bold text-[#102044]">Новий ключ</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="v2-api-key-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад: KeyCRM" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
            <button type="submit" disabled={pending || name.trim().length < 2}
              className="whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">
              {pending ? 'Створюємо…' : 'Створити ключ'}
            </button>
          </div>
          <p className="text-xs text-slate-500">Ключ дає доступ до даних про підписки цього кабінету. Не публікуйте його і не вставляйте в код сайту.</p>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </form>

        <details className="mt-4 rounded-xl border border-slate-200 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-[#102044]">Як підключити — для розробника</summary>
          <div className="mt-3 space-y-3 text-slate-600">
            <p>Запит за Telegram ID людини (надійно) або за <code>username</code> (запасний варіант — людина може його змінити):</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{curl}</pre>
            <p>Відповідь:</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-800 ring-1 ring-slate-200">{RESPONSE_EXAMPLE}</pre>
            <ul className="list-disc space-y-1 pl-5">
              <li><code>source.type</code>: <code>tracking_link</code>, <code>campaign</code>, <code>organic</code> або <code>unknown</code> — якщо джерело не визначене, так і кажемо.</li>
              <li><code>confidence</code>: <code>exact</code> — точний збіг за кліком, <code>probable</code> — імовірний.</li>
              <li>Людини немає в базі — <code>{'"found": false'}</code>. Необовʼязковий <code>channel_id</code> звужує пошук до одного каналу.</li>
              <li>Ліміт — 60 запитів на хвилину на ключ, далі відповідь 429.</li>
            </ul>
          </div>
        </details>
      </Card>
    </div>
  );
}
