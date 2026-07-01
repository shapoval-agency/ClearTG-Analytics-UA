'use client';

import { useTransition } from 'react';
import { switchWorkspaceAction } from '@/lib/actions';
import type { AuthMe } from '@/lib/api';

export function WorkspaceSwitcher({
  me,
  activeWorkspaceId,
}: {
  me: AuthMe;
  activeWorkspaceId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  if (me.workspaces.length <= 1) {
    const ws = me.workspaces[0];
    if (!ws) return null;
    return (
      <p className="text-xs text-slate-500 mt-1 truncate" title={ws.name}>
        {ws.name}
        <span className="text-slate-400"> · {ws.role}</span>
      </p>
    );
  }

  return (
    <div className="mt-2">
      <label className="sr-only" htmlFor="workspace-switcher">
        Кабінет клієнта
      </label>
      <select
        id="workspace-switcher"
        disabled={pending}
        value={activeWorkspaceId ?? me.workspaces[0]?.id ?? ''}
        onChange={(e) => {
          const id = e.target.value;
          if (id && id !== activeWorkspaceId) {
            startTransition(() => switchWorkspaceAction(id));
          }
        }}
        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700"
      >
        {me.workspaces.map((ws) => (
          <option key={ws.id} value={ws.id}>
            {ws.name} ({ws.role})
          </option>
        ))}
      </select>
    </div>
  );
}
