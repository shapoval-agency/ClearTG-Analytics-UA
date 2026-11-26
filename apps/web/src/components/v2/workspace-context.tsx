'use client';

import { createContext, useContext } from 'react';

/**
 * Чий кабінет зараз відкритий. Потрібно, щоб на кожній сторінці було видно:
 * зміни, які ви робите, підуть у кабінет клієнта, а не у ваш власний.
 */
export interface CurrentWorkspace {
  name: string;
  /** Не ваш власний кабінет (ви адміністратор клієнта або переглядаєте його). */
  isClient: boolean;
  /** Режим перегляду адміністратора — змінювати нічого не можна. */
  readOnly: boolean;
}

const WorkspaceContext = createContext<CurrentWorkspace | null>(null);

export const WorkspaceProvider = WorkspaceContext.Provider;

/** «(клієнт: Назва)» поруч із заголовком сторінки — лише в кабінеті клієнта. */
export function WorkspaceTitleTag() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace?.isClient) return null;
  return (
    <span className="ml-3 inline-block align-middle text-base font-semibold tracking-normal text-amber-200 sm:text-lg lg:text-xl">
      (клієнт: {workspace.name}{workspace.readOnly ? ' · тільки перегляд' : ''})
    </span>
  );
}
