import Link from 'next/link';
import clsx from 'clsx';

const TABS = [
  { key: 'links', href: '/v2/links', label: 'Посилання' },
  { key: 'gifts', href: '/v2/links/gifts', label: 'Подарунки' },
] as const;

/**
 * Вкладки розділу «Посилання». Подарунки живуть тут, а не окремим пунктом
 * меню: шапка вже тісна, а подарунок — це теж посилання, що веде підписника.
 */
export function LinksTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <nav aria-label="Розділ посилань" className="mb-5 flex w-full gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-[#dbe4f0] sm:w-fit">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={clsx(
            'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            tab.key === active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
