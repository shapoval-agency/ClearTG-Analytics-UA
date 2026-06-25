import { NextRequest, NextResponse } from 'next/server';
import { getApiOrigin } from '@/lib/api-origin';
import {
  TOKEN_COOKIE,
  WORKSPACE_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/session';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', request.url));
  }

  const res = await fetch(
    `${getApiOrigin()}/api/auth/verify?token=${encodeURIComponent(token)}`,
    { cache: 'no-store' },
  );

  if (!res.ok) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
  }

  const data = (await res.json()) as {
    accessToken: string;
    workspaces: Array<{ id: string }>;
  };

  const destination =
    data.workspaces.length === 0 ? '/onboarding' : '/dashboard';

  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(TOKEN_COOKIE, data.accessToken, SESSION_COOKIE_OPTIONS);

  const workspaceId = data.workspaces[0]?.id;
  if (workspaceId) {
    response.cookies.set(WORKSPACE_COOKIE, workspaceId, SESSION_COOKIE_OPTIONS);
  }

  return response;
}
