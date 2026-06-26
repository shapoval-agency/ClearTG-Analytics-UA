'use client';

import { useEffect } from 'react';
import { ensureState } from '@/lib/local-store';

/** Ініціалізує localStorage після логіну на сторінці login. */
export function LocalInit({ email }: { email: string }) {
  useEffect(() => {
    ensureState(email);
  }, [email]);
  return null;
}
