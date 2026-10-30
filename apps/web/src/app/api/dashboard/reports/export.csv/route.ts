import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getApiOrigin } from '@/lib/api-origin';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.token || !session.workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const upstream = await fetch(
    `${getApiOrigin()}/api/dashboard/reports/export.csv${req.nextUrl.search}`,
    {
      headers: {
        Authorization: `Bearer ${session.token}`,
        'x-workspace-id': session.workspaceId,
      },
      cache: 'no-store',
    },
  );
  if (!upstream.ok) {
    return NextResponse.json({ error: 'Export failed' }, { status: upstream.status });
  }

  return new NextResponse(await upstream.text(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="cleartg-report.csv"',
    },
  });
}
