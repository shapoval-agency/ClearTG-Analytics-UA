'use client';

import { useState, useTransition } from 'react';
import { deleteTrackingLinkAction } from '@/lib/actions';

export function DeleteTrackingLinkButton({ id, clickCount }: { id: string; clickCount: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleDelete() {
    const ok = window.confirm(
      clickCount > 0
        ? `У цього посилання вже ${clickCount} клік(ів) — сервер, найімовірніше, відмовить видаляти, щоб не втратити статистику. Спробувати все одно?`
        : 'Видалити посилання назавжди? Скасувати неможливо.',
    );
    if (!ok) return;

    setError('');
    startTransition(async () => {
      const result = await deleteTrackingLinkAction(id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="text-xs text-red-600 underline hover:text-red-700 disabled:opacity-50"
      >
        {pending ? 'Видаляємо…' : 'Видалити'}
      </button>
      {error && <p className="text-[11px] text-red-600 mt-1 max-w-[14rem]">{error}</p>}
    </div>
  );
}
