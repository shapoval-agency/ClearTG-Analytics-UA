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
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
    >
      {copied ? 'Скопійовано' : label}
    </button>
  );
}
