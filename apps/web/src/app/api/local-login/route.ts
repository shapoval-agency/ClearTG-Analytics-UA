import { NextRequest, NextResponse } from 'next/server';
import {
  getLocalCredentials,
  isLocalMode,
  isLocalPasswordConfigured,
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
  const password = (body.password ?? '').trim();
  const expectedEmail = expected.trim().toLowerCase();

  const emailOk = email === expectedEmail;
  const passwordOk = password === expectedPassword;

  if (!emailOk || !passwordOk) {
    return NextResponse.json(
      {
        error: 'Невірний email або пароль',
        hint: !emailOk
          ? `Email має бути: ${expected}`
          : !isLocalPasswordConfigured()
            ? 'LOCAL_LOGIN_PASSWORD не задано у Vercel — спробуйте пароль: cleartg123'
            : 'Пароль не збігається з LOCAL_LOGIN_PASSWORD у Vercel (перевірте пробіли)',
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true, redirect: '/dashboard', email: expected });
  response.cookies.set(TOKEN_COOKIE, LOCAL_SESSION_TOKEN, SESSION_COOKIE_OPTIONS);
  response.cookies.set(WORKSPACE_COOKIE, LOCAL_WORKSPACE_ID, SESSION_COOKIE_OPTIONS);
  return response;
}
