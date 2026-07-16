import { NextRequest, NextResponse } from 'next/server';
import { getApiOrigin } from '@/lib/api-origin';
import {
  SESSION_COOKIE_OPTIONS,
  TOKEN_COOKIE,
  WORKSPACE_COOKIE,
} from '@/lib/session';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string; password?: string };
  const apiOrigin = getApiOrigin();
  const isFallbackLocalhost =
    apiOrigin.includes('localhost') || apiOrigin.includes('127.0.0.1');

  let upstream: Response;
  try {
    upstream = await fetch(`${apiOrigin}/api/auth/staging-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: body.email ?? '',
        password: body.password ?? '',
      }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      {
        error: 'API недоступний',
        hint: isFallbackLocalhost
          ? `Vercel стукає в ${apiOrigin} (це не працює в хмарі). Додайте API_INTERNAL_URL=https://ваш-api… або увімкніть LOCAL_MODE=true`
          : `Немає відповіді від ${apiOrigin}. Перевірте, що API запущений і URL у Vercel (API_INTERNAL_URL) правильний`,
      },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: 'Невірний email або пароль' }, { status: 401 });
  }

  const data = (await upstream.json()) as {
    accessToken: string;
    isAgencyAdmin?: boolean;
    workspaces: Array<{ id: string }>;
  };

  const destination =
    data.workspaces.length === 0
      ? data.isAgencyAdmin
        ? '/agency/clients'
        : '/onboarding'
      : '/dashboard';

  const response = NextResponse.json({ ok: true, redirect: destination });
  response.cookies.set(TOKEN_COOKIE, data.accessToken, SESSION_COOKIE_OPTIONS);

  const workspaceId = data.workspaces[0]?.id;
  if (workspaceId) {
    response.cookies.set(WORKSPACE_COOKIE, workspaceId, SESSION_COOKIE_OPTIONS);
  }

  return response;
}
