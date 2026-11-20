'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SyncChannelForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/channels/sync-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Не вдалося підключити канал');
        return;
      }
      setUsername('');
      router.refresh();
    } catch {
      setError('Помилка мережі');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-amber-50 border border-amber-100 rounded-xl p-5 mb-6 text-sm">
      <p className="font-medium text-amber-900 mb-2">Бот уже адмін, але канал не з&apos;явився?</p>
      <p className="text-amber-800 mb-3">
        Для <strong>приватного</strong> каналу (без публічного @username) введіть{' '}
        <strong>chat id</strong>: <code className="bg-amber-100 px-1 rounded">-1003751054664</code>.
        Назва каналу (<code className="bg-amber-100 px-1 rounded">tets</code>) — не @username.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="-1003751054664"
          className="flex-1 min-w-[200px] rounded-lg border border-amber-200 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="rounded-lg bg-amber-600 text-white px-4 py-2 disabled:opacity-50"
        >
          {loading ? 'Перевіряємо…' : 'Підключити'}
        </button>
      </div>
      {error && <p className="text-red-600 mt-2">{error}</p>}
    </form>
  );
}
