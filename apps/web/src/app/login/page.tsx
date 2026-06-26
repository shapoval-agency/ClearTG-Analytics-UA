import { Suspense } from 'react';
import LoginForm from './LoginForm';
import { getLocalCredentials, isLocalMode } from '@/lib/local-mode';

export default function LoginPage() {
  const localMode = isLocalMode();
  const defaultEmail = localMode ? getLocalCredentials().email : '';
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження…</div>}>
      <LoginForm localMode={localMode} defaultEmail={defaultEmail} />
    </Suspense>
  );
}
