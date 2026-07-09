import { getSession } from '@/lib/session';
import { getApiOrigin } from '@/lib/api-origin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getSession();
  if (!session.token || !session.workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(
    `${getApiOrigin()}/api/tracking-links/${slug}/embed`,
    {
      headers: {
        Authorization: `Bearer ${session.token}`,
        'x-workspace-id': session.workspaceId,
      },
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Not found' }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
