import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/auth/callback', '/privacy', '/terms', '/cookies'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes (login, proxy) — без cookie; сторінки захищаємо нижче
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // onboarding requires auth but not workspace
  if (pathname === '/onboarding') {
    const token = request.cookies.get('cleartg_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  const token = request.cookies.get('cleartg_token')?.value;
  if (!token) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  const workspaceId = request.cookies.get('cleartg_workspace')?.value;
  if (!workspaceId && pathname !== '/onboarding') {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
