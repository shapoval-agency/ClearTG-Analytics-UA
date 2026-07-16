import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { CreateClientForm } from '@/components/CreateClientForm';
import { OpenWorkspaceButton } from '@/components/OpenWorkspaceButton';
import { DeleteClientButton } from '@/components/DeleteClientButton';
import { api, AgencyClient, AuthMe } from '@/lib/api';
import { getSession } from '@/lib/session';

export default async function AgencyClientsPage() {
  const session = await getSession();
  if (!session.token) redirect('/login');

  let me: AuthMe;
  try {
    me = await api<AuthMe>('/api/auth/me');
  } catch {
    redirect('/login');
  }

  if (!me.isAgencyAdmin) {
    redirect('/dashboard');
  }

  let clients: AgencyClient[] = [];
  try {
    clients = await api<AgencyClient[]>('/api/agency/clients');
  } catch {
    clients = [];
  }

  return (
    <div>
      <PageHeader
        title="Клієнти агентства"
        description="Окремі кабінети для кожного клієнта. Ви маєте доступ ADMIN до всіх."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <CreateClientForm />

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-medium text-slate-900">Список кабінетів ({clients.length})</h2>
          </div>
          {clients.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Ще немає клієнтів. Створіть перший кабінет.</p>
          ) : (
            <ul className="divide-y">
              {clients.map((c) => (
                <li key={c.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      OWNER: {c.ownerEmail ?? '—'} · {c.channels} каналів · {c.subscribers} учасників
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <OpenWorkspaceButton workspaceId={c.id} />
                    <DeleteClientButton workspaceId={c.id} workspaceName={c.name} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
