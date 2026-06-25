import { NextRequest, NextResponse } from 'next/server';
import {
  TOKEN_COOKIE,
  WORKSPACE_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', request.url));
  }

  const res = await fetch(
    `${API_URL}/api/auth/verify?token=${encodeURIComponent(token)}`,
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
