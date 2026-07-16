'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LocalInit } from '@/components/LocalInit';

export default function LoginForm({
  localMode,
  defaultEmail,
  loginEmailHint,
}: {
  localMode: boolean;
  defaultEmail: string;
  loginEmailHint?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callbackError = searchParams.get('error');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = localMode ? '/api/local-login' : '/api/auth/staging-login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        redirect?: string;
        email?: string;
      };

      if (!res.ok) {
        setError(
          [data.error, (data as { hint?: string }).hint].filter(Boolean).join(' — ') ||
            'Невірний email або пароль',
        );
        return;
      }

      const next = searchParams.get('next');
      const redirectTo = data.redirect ?? (next && next.startsWith('/') ? next : '/dashboard');

      if (localMode && data.email) {
        const { ensureState } = await import('@/lib/local-store');
        ensureState(data.email);
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError(
        localMode
          ? 'Помилка входу'
          : 'Немає зв\'язку з API. Перевірте API_INTERNAL_URL у Vercel або увімкніть LOCAL_MODE.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      {localMode && <LocalInit email={defaultEmail} />}
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">ClearTG Analytics</h1>
        <p className="text-slate-500 mt-2 text-sm">
          {localMode ? 'Вхід (дані зберігаються у браузері)' : 'Вхід для тестування'}
        </p>

        {localMode && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-sm rounded-lg space-y-1">
            <p>Локальний режим — дані у браузері (без бекенду).</p>
            {loginEmailHint && (
              <p>
                Email у Vercel: <strong>{loginEmailHint}</strong>
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        {callbackError && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
            {callbackError === 'invalid_token' && 'Посилання недійсне або прострочене'}
            {callbackError === 'missing_token' && 'Відсутній токен авторизації'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Входимо…' : 'Увійти'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-400 space-x-3">
          <Link href="/privacy" className="hover:text-brand-600">Конфіденційність</Link>
          <Link href="/terms" className="hover:text-brand-600">Умови</Link>
        </div>
      </div>
    </div>
  );
}
