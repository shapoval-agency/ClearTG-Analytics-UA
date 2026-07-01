import Link from 'next/link';

const tabs = [
  { href: '/reports/overview', label: 'Огляд' },
  { href: '/reports/sources', label: 'Джерела та CR' },
  { href: '/reports/subscriptions', label: 'Підписки / Відписки' },
  { href: '/reports/retention', label: 'Retention' },
  { href: '/reports/attribution-confidence', label: 'Атрибуція' },
  { href: '/reports/pixel-delivery', label: 'Pixel delivery' },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="text-sm px-3 py-1.5 rounded-lg border bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
