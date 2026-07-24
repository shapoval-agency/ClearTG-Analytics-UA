'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { logoutAction } from '@/lib/actions';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import type { AuthMe } from '@/lib/api';

const nav = [
  { href: '/dashboard', label: 'Огляд' },
  { href: '/channels', label: 'Канали' },
  { href: '/subscribers', label: 'Учасники' },
  { href: '/campaigns', label: 'Кампанії' },
  { href: '/links', label: 'Посилання' },
  { href: '/lead-magnets', label: 'Lead Magnets' },
  { href: '/reports/overview', label: 'Звіти' },
  { href: '/reports/sources', label: 'Джерела (CR)' },
  { href: '/reports/subscriptions', label: 'Підписки' },
  { href: '/reports/bot-starts', label: 'Переходи в бота' },
  { href: '/integrations/meta', label: 'Meta' },
  { href: '/integrations/google-ads', label: 'Google Ads' },
  { href: '/integrations/ga4', label: 'GA4' },
  { href: '/integrations/tiktok', label: 'TikTok' },
  { href: '/integrations/own-bot', label: 'Свій бот' },
  { href: '/settings/team', label: 'Команда' },
  { href: '/settings/telegram', label: 'Telegram-бот' },
  { href: '/settings/privacy', label: 'Приватність' },
  { href: '/settings/audit-log', label: 'Аудит' },
];

const NO_SHELL = ['/login', '/onboarding', '/auth/callback', '/privacy', '/terms', '/cookies'];

export function AppShell({
  children,
  me,
  activeWorkspaceId,
}: {
  children: React.ReactNode;
  me: AuthMe | null;
  activeWorkspaceId?: string | null;
}) {
  const pathname = usePathname();
  const hideShell = NO_SHELL.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (hideShell) {
    return <>{children}</>;
  }

  const agencyNav = me?.isAgencyAdmin
    ? [{ href: '/agency/clients', label: 'Клієнти агентства' }]
    : [];

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-200">
          <Link href="/dashboard" className="font-semibold text-lg text-brand-700">
            ClearTG Analytics
          </Link>
          {me && (
            <WorkspaceSwitcher me={me} activeWorkspaceId={activeWorkspaceId ?? null} />
          )}
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {agencyNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'block px-3 py-2 rounded-lg text-sm transition-colors',
                pathname === item.href
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {item.label}
            </Link>
          ))}
          {agencyNav.length > 0 && <div className="my-2 border-t border-slate-100" />}
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'block px-3 py-2 rounded-lg text-sm transition-colors',
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200 space-y-3">
          {me?.user.email && (
            <p className="text-xs text-slate-500 truncate">{me.user.email}</p>
          )}
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-slate-600 hover:text-red-600">
              Вийти
            </button>
          </form>
          <div className="text-xs text-slate-400 space-y-1">
            <Link href="/privacy" className="block hover:text-brand-600">Конфіденційність</Link>
            <Link href="/terms" className="block hover:text-brand-600">Умови</Link>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-6 lg:p-8 overflow-auto">{children}</main>
    </div>
  );
}
