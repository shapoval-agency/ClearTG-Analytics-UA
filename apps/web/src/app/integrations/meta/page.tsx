'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { saveMetaIntegrationAction, testMetaEventAction } from '@/lib/actions';

export default function MetaIntegrationPage() {
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [testEventCode, setTestEventCode] = useState('');
  const [message, setMessage] = useState('');

  async function save() {
    const result = await saveMetaIntegrationAction({
      pixelId,
      accessToken,
      testEventCode: testEventCode || undefined,
    });
    setMessage(result.error ? result.error : 'Збережено');
  }

  async function sendTest() {
    const result = await testMetaEventAction();
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(result.ok ? `Тестова подія: ${result.body?.success ? 'успішно' : result.body?.error}` : 'Помилка');
  }

  return (
    <div>
      <PageHeader title="Meta Pixel + CAPI" description="Conversions API з дедуплікацією та consent-aware доставкою" />
      <div className="bg-white rounded-xl border p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Pixel ID</label>
          <input className="w-full border rounded-lg px-3 py-2" value={pixelId} onChange={(e) => setPixelId(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Access Token (encrypted at rest)</label>
          <input type="password" className="w-full border rounded-lg px-3 py-2" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Test Event Code</label>
          <input className="w-full border rounded-lg px-3 py-2" value={testEventCode} onChange={(e) => setTestEventCode(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={save} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm">Зберегти</button>
          <button type="button" onClick={sendTest} className="px-4 py-2 border rounded-lg text-sm">Надіслати тестову подію</button>
        </div>
        {message && <p className="text-sm text-slate-600">{message}</p>}
        <p className="text-xs text-slate-400">Raw Telegram ID не передається. external_id — salted hash per workspace.</p>
      </div>
    </div>
  );
}
