import { cookies } from 'next/headers';

export const TOKEN_COOKIE = 'cleartg_token';
export const WORKSPACE_COOKIE = 'cleartg_workspace';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
};

export async function getSession() {
  const jar = await cookies();
  return {
    token: jar.get(TOKEN_COOKIE)?.value ?? null,
    workspaceId: jar.get(WORKSPACE_COOKIE)?.value ?? null,
  };
}

export async function setSession(token: string, workspaceId?: string) {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, token, SESSION_COOKIE_OPTIONS);
  if (workspaceId) {
    jar.set(WORKSPACE_COOKIE, workspaceId, SESSION_COOKIE_OPTIONS);
  }
}

export async function setWorkspace(workspaceId: string) {
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, workspaceId, SESSION_COOKIE_OPTIONS);
}

export async function clearWorkspace() {
  const jar = await cookies();
  jar.delete(WORKSPACE_COOKIE);
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(WORKSPACE_COOKIE);
}
