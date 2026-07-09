import { getSession } from '@/lib/session';
import { getApiOrigin } from '@/lib/api-origin';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session.token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${getApiOrigin()}/api/auth/telegram-bind-link`, {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed' }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
