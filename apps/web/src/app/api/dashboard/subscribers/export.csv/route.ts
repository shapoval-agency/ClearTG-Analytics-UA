import { getSession } from '@/lib/session';
import { getApiOrigin } from '@/lib/api-origin';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session.token || !session.workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${getApiOrigin()}/api/dashboard/subscribers/export.csv`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
      'x-workspace-id': session.workspaceId,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Export failed' }, { status: res.status });
  }

  const csv = await res.text();
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="subscribers.csv"',
    },
  });
}
