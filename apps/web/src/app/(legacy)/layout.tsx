import { AppShell } from '@/components/legacy/AppShell';
import { LocalLayoutShell } from '@/components/legacy/LocalLayoutShell';
import { getSession } from '@/lib/session';
import { api, AuthMe } from '@/lib/api';
import { getLocalCredentials, isLocalMode } from '@/lib/local-mode';

/**
 * СТАРИЙ КАБІНЕТ (архів). Не розвиваємо, лише читаємо й беремо потрібне в `/v2`.
 *
 * Route group `(legacy)` не впливає на URL: `/dashboard`, `/links`, `/reports/...`
 * працюють як раніше. Видалення старого кабінету —
 * див. `docs/new-dashboard/LEGACY_REMOVAL.md`.
 */
export default async function LegacyLayout({ children }: { children: React.ReactNode }) {
  if (isLocalMode()) {
    const { email } = getLocalCredentials();
    return <LocalLayoutShell userEmail={email}>{children}</LocalLayoutShell>;
  }

  const session = await getSession();
  let me: AuthMe | null = null;

  if (session.token) {
    try {
      me = await api<AuthMe>('/api/auth/me');
    } catch {
      me = null;
    }
  }

  return (
    <AppShell me={me} activeWorkspaceId={session.workspaceId}>
      {children}
    </AppShell>
  );
}
