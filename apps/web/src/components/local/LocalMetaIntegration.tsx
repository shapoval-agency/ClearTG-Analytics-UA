'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui';
import { useLocalData } from '@/hooks/useLocalData';
import { saveMeta } from '@/lib/local-store';

export function LocalMetaIntegration() {
  const { state, update, ready } = useLocalData();
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [testEventCode, setTestEventCode] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (state?.meta) {
      setPixelId(state.meta.pixelId);
      setAccessToken(state.meta.accessToken);
      setTestEventCode(state.meta.testEventCode ?? '');
    }
  }, [state?.meta]);

  if (!ready || !state) return <p className="text-slate-500">Завантаження…</p>;

  function handleSave() {
    if (!state) return;
    update(saveMeta(state, { pixelId, accessToken, testEventCode: testEventCode || undefined }));
    setMessage('Збережено у браузері. CAPI запрацює після підключення бекенду.');
  }

  return (
    <div>
      <PageHeader title="Meta Pixel + CAPI" description="Налаштування зберігаються локально" />
      <div className="bg-white rounded-xl border p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Pixel ID</label>
          <input className="w-full border rounded-lg px-3 py-2" value={pixelId} onChange={(e) => setPixelId(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Access Token</label>
          <input type="password" className="w-full border rounded-lg px-3 py-2" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Test Event Code</label>
          <input className="w-full border rounded-lg px-3 py-2" value={testEventCode} onChange={(e) => setTestEventCode(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={handleSave} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm">
            Зберегти
          </button>
          <button
            type="button"
            onClick={() => setMessage('Тестова подія — після підключення API')}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            Тестова подія
          </button>
        </div>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>
    </div>
  );
}
