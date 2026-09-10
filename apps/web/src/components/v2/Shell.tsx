'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { logoutAction } from '@/lib/actions';
import { WorkspacePicker } from '@/components/v2/WorkspacePicker';
import type { AuthMe } from '@/lib/api';

/**
 * Оболонка нового кабінету.
 *
 * П'ять розділів замість дев'ятнадцяти пунктів старого меню. Правило з ТЗ:
 * функція живе поруч зі зрозумілою користувачу сутністю, а не отримує
 * власний пункт меню. Кампанії — властивість посилання і розріз у звітах,
 * тому окремого розділу не мають.
 */
const NAV = [
  { href: '/v2', label: 'Огляд', hint: 'Що сталося і чи є проблема' },
  { href: '/v2/channels', label: 'Канали', hint: 'Підключення і стан' },
  { href: '/v2/links', label: 'Посилання', hint: 'Створення і мітки' },
  { href: '/v2/reports', label: 'Звіти', hint: 'Джерела і якість даних' },
  { href: '/v2/subscribers', label: 'Учасники', hint: 'Люди і їх джерело' },
];

function isActive(pathname: string, href: string) {
  // '/v2' активний лише на самому огляді, інакше він підсвічувався б завжди.
  if (href === '/v2') return pathname === '/v2';
  return pathname === href || pathname.startsWith(href + '/');
}

export function V2Shell({
  children,
  me,
  activeWorkspaceId,
}: {
  children: React.ReactNode;
  me: AuthMe | null;
  activeWorkspaceId: string | null;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-200">
          <Link href="/v2" className="font-semibold text-lg text-brand-700">
            ClearTG
          </Link>
          <p className="text-xs text-slate-400 mt-0.5">Новий кабінет</p>
          {me && (
            <WorkspacePicker me={me} activeWorkspaceId={activeWorkspaceId} />
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'block px-3 py-2 rounded-lg transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <span
                  className={clsx('block text-sm', active && 'font-medium')}
                >
                  {item.label}
                </span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  {item.hint}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <Link
            href="/dashboard"
            className="block text-xs text-slate-500 hover:text-brand-600"
          >
            ← Повернутися в старий кабінет
          </Link>
          {me?.user.email && (
            <p className="text-xs text-slate-500 truncate" title={me.user.email}>
              {me.user.email}
            </p>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs text-slate-600 hover:text-red-600"
            >
              Вийти
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-6 lg:p-8 overflow-auto">{children}</main>
    </div>
  );
}
