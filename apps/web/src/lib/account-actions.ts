'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { setWorkspace, clearSession } from '@/lib/session';
import { getApiOrigin } from '@/lib/api-origin';

/**
 * Дії облікового запису, спільні для всього застосунку: вихід і створення
 * першого workspace на `/onboarding`.
 *
 * Навмисно не лежать у `lib/legacy/actions.ts`: ними користуються `/v2` та
 * онбординг, тож старий кабінет можна видалити, не зачепивши їх.
 */

export async function logoutAction() {
  await clearSession();
  redirect('/login');
}

export async function createWorkspaceAction(name: string) {
  const token = (await cookies()).get('cleartg_token')?.value;
  if (!token) redirect('/login');

  const res = await fetch(`${getApiOrigin()}/api/workspaces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    return { error: 'Не вдалося створити workspace' };
  }

  const workspace = await res.json();
  await setWorkspace(workspace.id);
  redirect('/v2');
}
