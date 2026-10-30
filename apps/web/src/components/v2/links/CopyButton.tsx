'use client';

import { useState } from 'react';

/** Копіювання адреси посилання. Без цього створеним посиланням не скористатися. */
export function CopyButton({
  value,
  label = 'Копіювати',
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер недоступний (http без localhost, заборона браузера) —
      // не ламаємо сценарій: адреса й так видима на екрані.
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="min-h-10 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50"
    >
      {copied ? 'Скопійовано' : label}
    </button>
  );
}
