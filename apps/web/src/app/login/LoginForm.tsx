'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const error = searchParams.get('error');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setDevLink(null);
    setFetchError(null);

    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFetchError(
          (body as { hint?: string }).hint ??
            'Сервер недоступний. Перевірте Railway API та API_INTERNAL_URL у Vercel.',
        );
        return;
      }

      const data = (await res.json()) as { devLink?: string };
      setSent(true);
      if (data.devLink) setDevLink(data.devLink);
    } catch {
      setFetchError('Немає зв\'язку з API. Railway ще не піднятий або невірний API_INTERNAL_URL.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">ClearTG Analytics</h1>
        <p className="text-slate-500 mt-2 text-sm">Увійдіть через magic link на email</p>

        {fetchError && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{fetchError}</div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
            {error === 'invalid_token' && 'Посилання недійсне або прострочене'}
            {error === 'missing_token' && 'Відсутній токен авторизації'}
          </div>
        )}

        {sent ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
              {devLink
                ? 'Посилання для входу нижче (staging).'
                : 'Якщо email зареєстровано, ми надіслали посилання для входу.'}
            </p>
            {devLink && (
              <div className="text-sm">
                <p className="text-slate-500 mb-2">Dev mode — посилання для входу:</p>
                <a href={devLink} className="text-brand-600 break-all hover:underline">
                  {devLink}
                </a>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="you@agency.ua"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Надсилаємо…' : 'Надіслати magic link'}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-400 space-x-3">
          <Link href="/privacy" className="hover:text-brand-600">Конфіденційність</Link>
          <Link href="/terms" className="hover:text-brand-600">Умови</Link>
        </div>
      </div>
    </div>
  );
}
