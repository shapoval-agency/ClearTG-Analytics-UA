'use client';

import { useState, useTransition } from 'react';
import { deleteClientWorkspaceAction } from '@/lib/actions';

export function DeleteClientButton({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleDelete() {
    const ok = window.confirm(
      `Видалити кабінет «${workspaceName}»?\n\nБудуть видалені канали, кліки, підписники та інтеграції цього кабінету. Скасувати неможливо.`,
    );
    if (!ok) return;

    setError('');
    startTransition(async () => {
      const result = await deleteClientWorkspaceAction(workspaceId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {pending ? 'Видаляємо…' : 'Видалити'}
      </button>
      {error && <p className="text-[11px] text-red-600 mt-1 max-w-[10rem]">{error}</p>}
    </div>
  );
}
