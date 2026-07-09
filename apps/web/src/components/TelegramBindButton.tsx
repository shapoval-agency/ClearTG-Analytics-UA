'use client';

import { useState } from 'react';

export function TelegramBindButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleBind() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/telegram-bind-link', { credentials: 'include' });
      if (!res.ok) {
        setError('Увійдіть у кабінет і спробуйте знову');
        return;
      }
      const data = (await res.json()) as { url: string };
      setUrl(data.url);
      window.open(data.url, '_blank');
    } catch {
      setError('Помилка. Перевірте API.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleBind}
        disabled={loading}
        className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {loading ? '…' : 'Привʼязати Telegram'}
      </button>
      {url && (
        <p className="text-xs text-slate-500 mt-2 break-all">
          Або відкрийте: <a href={url} className="text-brand-600 underline">{url}</a>
        </p>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
