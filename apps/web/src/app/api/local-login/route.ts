import { NextRequest, NextResponse } from 'next/server';
import {
  getLocalCredentials,
  isLocalMode,
  LOCAL_SESSION_TOKEN,
  LOCAL_WORKSPACE_ID,
} from '@/lib/local-mode';
import {
  SESSION_COOKIE_OPTIONS,
  TOKEN_COOKIE,
  WORKSPACE_COOKIE,
} from '@/lib/session';

export async function POST(req: NextRequest) {
  if (!isLocalMode()) {
    return NextResponse.json({ error: 'Local mode disabled' }, { status: 404 });
  }

  const body = (await req.json()) as { email?: string; password?: string };
  const { email: expected, password: expectedPassword } = getLocalCredentials();

  const email = (body.email ?? '').trim().toLowerCase();
  if (email !== expected.trim().toLowerCase() || body.password !== expectedPassword) {
    return NextResponse.json({ error: 'Невірний email або пароль' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, redirect: '/dashboard', email: expected });
  response.cookies.set(TOKEN_COOKIE, LOCAL_SESSION_TOKEN, SESSION_COOKIE_OPTIONS);
  response.cookies.set(WORKSPACE_COOKIE, LOCAL_WORKSPACE_ID, SESSION_COOKIE_OPTIONS);
  return response;
}
