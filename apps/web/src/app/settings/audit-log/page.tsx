import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import { formatDateUk } from '@/lib/labels';


interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export default async function AuditLogPage() {
  let logs: AuditEntry[] = [];
  try {
    logs = await api<AuditEntry[]>('/api/audit-log');
  } catch { /* empty */ }

  return (
    <div>
      <PageHeader title="Журнал аудиту" />
      {logs.length === 0 ? (
        <p className="text-slate-500">Немає записів</p>
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
