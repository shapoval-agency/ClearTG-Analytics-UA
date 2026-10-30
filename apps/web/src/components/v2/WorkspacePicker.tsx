'use client';

import { useTransition } from 'react';
import { switchWorkspaceV2Action } from '@/app/v2/actions';
import { CustomSelect } from '@/components/v2/CustomSelect';
import type { AuthMe } from '@/lib/api';

/**
 * Перемикач кабінету клієнта для нового кабінету.
 *
 * Окремий від старого `WorkspaceSwitcher` навмисно: той викликає
 * `switchWorkspaceAction`, який жорстко редіректить на `/dashboard` —
 * тобто викидав би користувача назад у старий кабінет. Логіка та сама,
 * відрізняється лише ціль редіректу.
 */
export function WorkspacePicker({
  me,
  activeWorkspaceId,
  onDark = false,
}: {
  me: AuthMe;
  activeWorkspaceId: string | null;
  onDark?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (me.workspaces.length <= 1) {
    const ws = me.workspaces[0];
    if (!ws) return null;
    return (
      <p className={onDark ? 'truncate text-sm font-medium text-white' : 'truncate text-xs text-slate-500'} title={ws.name}>
        {ws.name}
        <span className={onDark ? 'ml-2 text-[10px] font-bold uppercase tracking-wide text-blue-200' : 'text-slate-400'}> · {ws.role}</span>
      </p>
    );
  }

  return (
    <div>
      <label className="sr-only" htmlFor="v2-workspace-picker">
        Кабінет клієнта
      </label>
      <CustomSelect
        id="v2-workspace-picker"
        disabled={pending}
        value={activeWorkspaceId ?? me.workspaces[0]?.id ?? ''}
        onChange={(id) => {
          if (id && id !== activeWorkspaceId) {
            startTransition(() => switchWorkspaceV2Action(id));
          }
        }}
        variant={onDark ? 'dark' : 'light'}
        buttonClassName="min-h-10 py-2 text-xs"
        options={me.workspaces.map((workspace) => ({
          value: workspace.id,
          label: `${workspace.name} · ${workspace.role}`,
        }))}
      />
    </div>
  );
}
