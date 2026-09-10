'use client';

import { useState, useTransition } from 'react';
import { deleteChannelAction } from '@/lib/actions';

export function DeleteChannelButton({ id, title, hasData }: { id: string; title: string; hasData: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleDelete() {
    const ok = window.confirm(
      hasData
        ? `По каналу «${title}» вже є кампанії або статистика — сервер, найімовірніше, відмовить видаляти, щоб не втратити дані. Спробувати все одно?`
        : `Видалити канал «${title}» назавжди? Скасувати неможливо.`,
    );
    if (!ok) return;

    setError('');
    startTransition(async () => {
      const result = await deleteChannelAction(id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    // stopPropagation keeps the surrounding <Link> (whole card is clickable) from navigating.
    <div className="text-right" onClick={(e) => e.stopPropagation()}>
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
