import Link from 'next/link';
import { api, AuthError, type AdminWorkspaceRow, type AuthMe } from '@/lib/api';
import { PageHeader, ErrorState, EmptyState, Badge, Card } from '@/components/v2/ui';
import { formatDateUk } from '@/lib/labels';
import { OpenWorkspaceButton } from '@/components/v2/admin/OpenWorkspaceButton';

export const dynamic = 'force-dynamic';

/**
 * Усі кабінети платформи — лише для адміністратора (AGENCY_ADMIN_EMAIL).
 * Кабінети, де адміністратор не учасник, відкриваються тільки на перегляд,
 * кожен такий вхід пишеться в журнал аудиту кабінету.
 */
export default async function V2AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const header = <PageHeader title="Усі кабінети" description="Кабінети всіх клієнтів платформи — і створені вами, і ті, де клієнт зареєструвався сам." />;

  let me: AuthMe | null = null;
  let rows: AdminWorkspaceRow[] = [];
  let failed = false;
  let sessionExpired = false;

  try {
    me = await api<AuthMe>('/api/auth/me');
    if (me.isAgencyAdmin) {
      const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      rows = await api<AdminWorkspaceRow[]>(`/api/agency/workspaces${qs}`);
    }
  } catch (err) {
    if (err instanceof AuthError) sessionExpired = true;
    else failed = true;
  }

  if (sessionExpired) {
    return (
      <>
        {header}
        <ErrorState title="Сесія завершилася" description="Увійдіть знову." />
        <Link href="/login?next=/v2/admin" className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Увійти</Link>
      </>
    );
  }
  if (failed) {
    return (
      <>
        {header}
        <ErrorState title="Не вдалося завантажити кабінети" description="Сервіс аналітики зараз не відповідає. Оновіть сторінку." />
      </>
    );
  }
  if (!me?.isAgencyAdmin) {
    return (
      <>
        {header}
        <ErrorState title="Розділ лише для адміністратора платформи" description="У вашого облікового запису немає доступу до списку всіх кабінетів." />
      </>
    );
  }

  return (
    <>
      {header}
      <form method="get" className="mb-5 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="admin-search" className="sr-only">Пошук кабінету</label>
        <input id="admin-search" name="search" defaultValue={search ?? ''} placeholder="Назва кабінету або email власника"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm sm:max-w-md" />
        <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">Знайти</button>
        {search && <Link href="/v2/admin" className="self-center text-sm text-slate-500 underline">Скинути</Link>}
      </form>

      {rows.length === 0 ? (
        <EmptyState title={search ? 'Нічого не знайдено' : 'Кабінетів ще немає'} description={search ? 'Спробуйте іншу назву або email.' : 'Щойно хтось зареєструється, кабінет з’явиться тут.'} />
      ) : (
        <Card title={`Кабінетів: ${rows.length}${rows.length === 500 ? '+' : ''}`} hint="«Переглянути» — лише перегляд, вхід записується в журнал аудиту кабінету">
          <ul className="divide-y divide-slate-100">
            {rows.map((w) => (
              <li key={w.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-[#102044]">
                    {w.name}{' '}
                    <Badge tone={w.isMember ? 'ok' : 'neutral'}>{w.isMember ? 'Ви учасник' : 'Лише перегляд'}</Badge>
                  </p>
                  <p className="text-xs text-slate-500">
                    {w.ownerEmail ?? 'власник не вказаний'} · каналів {w.channels} · підписників {w.subscribers} · створено {formatDateUk(w.createdAt)}
                  </p>
                </div>
                <OpenWorkspaceButton workspaceId={w.id} isMember={w.isMember} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
