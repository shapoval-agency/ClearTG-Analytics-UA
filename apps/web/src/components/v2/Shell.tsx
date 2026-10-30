'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  ChartBar,
  LinkSimple,
  SignOut,
  SquaresFour,
  TelegramLogo,
  UsersThree,
} from '@phosphor-icons/react';
import { logoutAction } from '@/lib/actions';
import { WorkspacePicker } from '@/components/v2/WorkspacePicker';
import type { AuthMe } from '@/lib/api';

const NAV = [
  { href: '/v2', label: 'Огляд', icon: SquaresFour },
  { href: '/v2/channels', label: 'Канали', icon: TelegramLogo },
  { href: '/v2/links', label: 'Посилання', icon: LinkSimple },
  { href: '/v2/reports', label: 'Звіти', icon: ChartBar },
  { href: '/v2/subscribers', label: 'Учасники', icon: UsersThree },
];

function isActive(pathname: string, href: string) {
  if (href === '/v2') return pathname === '/v2';
  return pathname === href || pathname.startsWith(`${href}/`);
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
    <div className="v2-shell min-h-screen bg-[#f4f7fb] text-[#102044]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#073aa8] text-white shadow-[0_8px_30px_rgba(4,34,99,0.18)]">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-5 px-4 sm:px-6 lg:h-[72px] lg:px-8">
          <Link href="/v2" className="shrink-0 text-xl font-extrabold tracking-[-0.04em] sm:text-2xl">
            Clear<span className="text-[#63a3ff]">TG</span>
          </Link>

          {me && (
            <div className="hidden min-w-0 lg:block lg:w-[230px]">
              <WorkspacePicker me={me} activeWorkspaceId={activeWorkspaceId} onDark />
            </div>
          )}

          <nav className="hidden h-full flex-1 items-center justify-center gap-1 lg:flex" aria-label="Основна навігація">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'relative flex h-full items-center gap-2 px-4 text-sm font-semibold transition-colors',
                    active ? 'text-white' : 'text-blue-100/80 hover:text-white',
                  )}
                >
                  <Icon size={18} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
                  {item.label}
                  {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#63a3ff]" />}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            {me?.user.email && (
              <div className="hidden items-center gap-2 xl:flex">
                <span className="grid size-9 place-items-center rounded-full bg-white/15 text-sm font-bold ring-1 ring-white/20">
                  {me.user.email.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-48 truncate text-sm text-blue-50">{me.user.email}</span>
              </div>
            )}
            <form action={logoutAction} className="hidden lg:block">
              <button
                type="submit"
                aria-label="Вийти"
                title="Вийти"
                className="grid size-9 place-items-center rounded-lg text-blue-100/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <SignOut size={20} aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="v2-main min-w-0 overflow-x-hidden px-4 pb-28 sm:px-6 lg:px-8 lg:pb-10">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200/80 bg-white/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-10px_30px_rgba(15,35,75,0.10)] backdrop-blur lg:hidden"
        aria-label="Мобільна навігація"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition',
                active ? 'bg-brand-50 text-brand-700' : 'text-slate-500 active:bg-slate-100',
              )}
            >
              <Icon size={21} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
