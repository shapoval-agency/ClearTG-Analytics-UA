'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientBotAction } from '@/lib/actions';

export function ConnectClientBotForm() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await createClientBotAction(token.trim());
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setToken('');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 mb-6 space-y-3">
      <h2 className="font-semibold">Підключити бота</h2>
      <p className="text-sm text-slate-600">
        Створіть бота через @BotFather (команда <code className="text-xs bg-slate-100 px-1 rounded">/newbot</code>)
        і вставте токен сюди. Ми перевіримо його одразу.
      </p>
      <input
        type="password"
        className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="123456:AAExampleTokenFromBotFather"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !token.trim()}
        className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm disabled:opacity-50"
      >
        {loading ? 'Перевіряємо…' : 'Підключити'}
      </button>
    </form>
  );
}
