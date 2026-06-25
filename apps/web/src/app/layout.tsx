import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { getSession } from '@/lib/session';
import { api, AuthMe } from '@/lib/api';

export const metadata: Metadata = {
  title: 'ClearTG Analytics UA',
  description: 'Чесна аналітика Telegram-реклами для України',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  let me: AuthMe | null = null;

  if (session.token) {
    try {
      me = await api<AuthMe>('/api/auth/me');
    } catch {
      me = null;
    }
  }

  return (
    <html lang="uk">
      <body>
        <AppShell me={me}>{children}</AppShell>
      </body>
    </html>
  );
}
