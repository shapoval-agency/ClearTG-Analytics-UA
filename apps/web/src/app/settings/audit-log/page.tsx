import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import { formatDateUk } from '@/lib/labels';
import Link from 'next/link';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const { action, entityType, dateFrom, dateTo } = await searchParams;
  let logs: AuditEntry[] = [];
  try {
    logs = await api<AuditEntry[]>(`/api/audit-log${qs({ action, entityType, dateFrom, dateTo, limit: '200' })}`);
  } catch { /* empty */ }

  const hasFilters = Boolean(action || entityType || dateFrom || dateTo);

  return (
    <div>
      <PageHeader title="Журнал аудиту" />

      <form className="bg-white rounded-xl border p-4 mb-6 flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[160px]">
          <label className="block text-xs text-slate-500 mb-1">Дія</label>
          <input
            type="text"
            name="action"
            defaultValue={action ?? ''}
            placeholder="напр. archive"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs text-slate-500 mb-1">Сутність</label>
          <input
            type="text"
            name="entityType"
            defaultValue={entityType ?? ''}
            placeholder="напр. channel"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">З дати</label>
          <input type="date" name="dateFrom" defaultValue={dateFrom ?? ''} className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">По дату</label>
          <input type="date" name="dateTo" defaultValue={dateTo ?? ''} className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-700">
          Застосувати
        </button>
        {hasFilters && (
          <Link href="/settings/audit-log" className="text-sm text-slate-500 underline hover:text-slate-700">
            Скинути
          </Link>
        )}
      </form>

      {logs.length === 0 ? (
        <p className="text-slate-500">{hasFilters ? 'Нічого не знайдено за цим фільтром.' : 'Немає записів'}</p>
      ) : (
        <table className="w-full bg-white rounded-xl border text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="p-3">Дія</th>
              <th className="p-3">Сутність</th>
              <th className="p-3">Час</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="p-3">{l.action}</td>
                <td className="p-3">{l.entityType ?? '—'} {l.entityId ? `(${l.entityId.slice(0, 8)}…)` : ''}</td>
                <td className="p-3">{formatDateUk(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
