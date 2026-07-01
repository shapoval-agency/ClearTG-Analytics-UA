'use client';

import { useTransition } from 'react';
import { switchWorkspaceAction } from '@/lib/actions';

export function OpenWorkspaceButton({
  workspaceId,
  label = 'Відкрити',
}: {
  workspaceId: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => switchWorkspaceAction(workspaceId))}
      className="text-xs text-brand-600 hover:underline shrink-0 disabled:opacity-50"
    >
      {pending ? '…' : label}
    </button>
  );
}
