'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ensureState } from '@/lib/local-store';
import type { AuthMe } from '@/lib/api';

const NO_BANNER = ['/login', '/privacy', '/terms', '/cookies'];

export function LocalLayoutShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    ensureState(userEmail);
  }, [userEmail]);

  const me: AuthMe = {
    user: { id: 'local-user', email: userEmail, name: 'Admin' },
    workspaces: [{ id: 'local-ws', name: 'Мій workspace', slug: 'main', role: 'OWNER' }],
  };

  const showBanner = !NO_BANNER.some((p) => pathname === p || pathname.startsWith(p + '/'));

  return (
    <>
      {showBanner && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm px-4 py-2 text-center">
          Локальний режим: дані у браузері. Після підключення бека — вимкніть LOCAL_MODE.
        </div>
      )}
      <AppShell me={me}>{children}</AppShell>
    </>
  );
}
