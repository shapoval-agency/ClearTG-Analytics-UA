import { PageHeader } from '@/components/ui';
import { InviteMemberForm } from '@/components/InviteMemberForm';
import { api, WorkspaceMember } from '@/lib/api';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function TeamSettingsPage() {
  const session = await getSession();
  if (!session.token || !session.workspaceId) redirect('/onboarding');

  let members: WorkspaceMember[] = [];
  try {
    members = await api<WorkspaceMember[]>('/api/workspaces/current/members');
  } catch {
    members = [];
  }

  return (
    <div>
      <PageHeader
        title="Команда"
        description="Учасники поточного кабінету та їхні ролі"
      />

      <InviteMemberForm />

      <div className="mt-6 bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-medium text-slate-900">Учасники ({members.length})</h2>
        </div>
        {members.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Поки немає учасників.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Імʼя</th>
                <th className="px-6 py-3 font-medium">Роль</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-6 py-3 text-slate-900">{m.email}</td>
                  <td className="px-6 py-3 text-slate-600">{m.name ?? '—'}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                      {m.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        OWNER — власник кабінету (клієнт). ADMIN — агентство або довірена особа. MEMBER — редактор. VIEWER — лише перегляд.
      </p>
    </div>
  );
}
