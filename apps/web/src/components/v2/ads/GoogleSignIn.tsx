'use client';

import { useState, useTransition } from 'react';
import { googleAdsAuthUrlV2Action } from '@/app/v2/actions';

/** S3-01: доступ до Google Ads через OAuth — без ручного копіювання токенів. */
export function GoogleSignIn({ connected, saved }: { connected: boolean; saved: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await googleAdsAuthUrlV2Action();
      if (res.error || !res.url) return setError(res.error ?? 'Не вдалося почати вхід через Google');
      window.location.href = res.url;
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm">
      <span className={connected ? 'text-emerald-700' : 'text-slate-600'}>
        {connected ? '✓ Вхід через Google виконано' : 'Потрібен вхід через Google з доступом до рекламного акаунта'}
      </span>
      <button type="button" disabled={pending || !saved} onClick={start}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
        {pending ? 'Відкриваємо Google…' : connected ? 'Увійти ще раз' : 'Увійти через Google'}
      </button>
      {!saved && <span className="text-xs text-slate-500">Спершу збережіть Customer ID і дію-конверсію нижче.</span>}
      {error && <span className="text-red-700">{error}</span>}
    </div>
  );
}
