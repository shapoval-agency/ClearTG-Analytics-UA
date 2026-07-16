import { NextRequest, NextResponse } from 'next/server';
import { getApiOrigin } from '@/lib/api-origin';

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  const target = `${getApiOrigin()}/api/${path.join('/')}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const upstream = await fetch(target, init);
    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    });
  } catch {
    return NextResponse.json(
      {
        error: 'API unavailable',
        hint: `No response from ${getApiOrigin()}. Set API_INTERNAL_URL on Vercel or enable LOCAL_MODE=true`,
      },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
