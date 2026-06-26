import { Suspense } from 'react';
import LoginForm from './LoginForm';
import { getLocalCredentials, isLocalMode } from '@/lib/local-mode';

export default function LoginPage() {
  const localMode = isLocalMode();
  const creds = getLocalCredentials();
  const defaultEmail = localMode ? creds.email : '';
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження…</div>}>
      <LoginForm
        localMode={localMode}
        defaultEmail={defaultEmail}
        loginEmailHint={localMode ? creds.email : undefined}
      />
    </Suspense>
  );
}
