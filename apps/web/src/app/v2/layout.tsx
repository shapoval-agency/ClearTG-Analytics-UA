import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { api, type AdminViewWorkspace, type AuthMe } from '@/lib/api';
import { V2Shell } from '@/components/v2/Shell';

export const metadata: Metadata = {
  title: 'ClearTG · Новий кабінет',
};

/**
 * Layout нового кабінету.
 *
 * Авторизація та скоуп по workspace не змінюються: `middleware.ts` уже
 * перекидає на `/login` без токена і на `/onboarding` без workspace, а
 * `lib/api.ts` сам додає `Authorization` та `x-workspace-id` із cookie.
 * Тут ми лише отримуємо профіль для шапки.
 *
 * Старе меню (`AppShell`) живе лише в `app/(legacy)/layout.tsx` і сюди
 * не потрапляє — кореневий layout нічого не обгортає.
 */
export default async function V2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.token) redirect('/login');

  let me: AuthMe | null = null;
  try {
    me = await api<AuthMe>('/api/auth/me');
  } catch {
    // Профіль не критичний для каркаса: шапка просто буде без email,
    // а сторінки самі покажуть свій стан помилки.
    me = null;
  }

  // Адміністратор у кабінеті, де він не учасник, — режим перегляду (банер у шапці).
  let adminView: AdminViewWorkspace | null = null;
  if (
    me?.isAgencyAdmin &&
    session.workspaceId &&
    !me.workspaces.some((w) => w.id === session.workspaceId)
  ) {
    adminView = await api<AdminViewWorkspace>(`/api/agency/workspaces/${session.workspaceId}`).catch(() => null);
  }

  return (
    <V2Shell me={me} activeWorkspaceId={session.workspaceId} adminView={adminView}>
      {children}
    </V2Shell>
  );
}
