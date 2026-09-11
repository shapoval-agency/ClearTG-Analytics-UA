'use client';

import { useEffect, useState } from 'react';
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
  { href: '/v2/reports', label: 'Звіти', hint: 'Джерела і наскільки їм довіряти' },
  { href: '/v2/subscribers', label: 'Учасники', hint: 'Люди і їх джерело' },
];

function isActive(pathname: string, href: string) {
  // '/v2' активний лише на самому огляді, інакше він підсвічувався б завжди.
  if (href === '/v2') return pathname === '/v2';
  return pathname === href || pathname.startsWith(href + '/');
}

function MenuIcon({ open }: { open: boolean }) {
  // Один SVG замість бібліотеки іконок — у проєкті її й так ніде не було.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
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
  const [mobileOpen, setMobileOpen] = useState(false);

  // Перехід на інший розділ — закрити шухляду, інакше вона лишиться
  // відкритою поверх нової сторінки (Link не перезавантажує сторінку,
  // локальний стан V2Shell переживає навігацію).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Поки шухляда відкрита на телефоні — не давати сторінці під нею скролитись.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Esc закриває шухляду — дешево додати, стандартна поведінка для оверлею.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen">
      {/* Верхня панель — тільки нижче lg (1024px), заміняє собою бічне меню,
          яке на вузькому екрані займало б увесь простір під контент. */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 bg-white border-b border-slate-200 px-4 py-3">
        <Link href="/v2" className="font-semibold text-lg text-brand-700">
          ClearTG
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Відкрити меню"
          aria-expanded={mobileOpen}
          aria-controls="v2-mobile-nav"
          className="p-2 -m-2 text-slate-600"
        >
          <MenuIcon open={false} />
        </button>
      </div>

      {/* Затемнення позаду шухляди — клік закриває, як і Esc. */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="v2-mobile-nav"
        className={clsx(
          'w-64 bg-white border-r border-slate-200 flex flex-col shrink-0',
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out',
          'lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href="/v2" className="font-semibold text-lg text-brand-700">
              ClearTG
            </Link>
            {/* Раніше тут було «Новий кабінет» — технічна назва про сам продукт
                (порівняння зі старим кабінетом), а не про користь для клієнта.
                CORE_MVP_UX_AUDIT.md, розділ 1, знахідка 1. */}
            <p className="text-xs text-slate-400 mt-0.5">Звідки приходять підписники</p>
            {me && (
              <WorkspacePicker me={me} activeWorkspaceId={activeWorkspaceId} />
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Закрити меню"
            className="lg:hidden p-2 -m-2 text-slate-400 shrink-0"
          >
            <MenuIcon open={true} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
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

      <main className="flex-1 min-w-0 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
