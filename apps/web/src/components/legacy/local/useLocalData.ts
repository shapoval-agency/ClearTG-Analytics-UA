'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadState, saveState, type LocalState } from '@/lib/local-store';

export function useLocalData() {
  const [state, setState] = useState<LocalState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(loadState());
    setReady(true);
  }, []);

  const update = useCallback((next: LocalState) => {
    saveState(next);
    setState(next);
  }, []);

  return { state, update, ready };
}
