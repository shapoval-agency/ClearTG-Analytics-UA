'use client';

import { useState, useTransition } from 'react';
import { openWorkspaceAsAdminV2Action } from '@/app/v2/actions';

export function OpenWorkspaceButton({ workspaceId, isMember }: { workspaceId: string; isMember: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const res = await openWorkspaceAsAdminV2Action(workspaceId);
          if (res?.error) setError(res.error);
        })}
        className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
      >
        {pending ? 'Відкриваємо…' : isMember ? 'Відкрити' : 'Переглянути'}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
