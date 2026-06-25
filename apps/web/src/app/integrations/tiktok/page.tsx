'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { saveTikTokIntegrationAction, testTikTokEventAction } from '@/lib/actions';

export default function TikTokIntegrationPage() {
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [testEventCode, setTestEventCode] = useState('');
  const [message, setMessage] = useState('');

  async function save() {
    const result = await saveTikTokIntegrationAction({
      pixelId,
      accessToken,
      testEventCode: testEventCode || undefined,
    });
    setMessage(result.error ?? 'Збережено');
  }

  async function sendTest() {
    const result = await testTikTokEventAction();
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(
      result.ok
        ? `Тест: ${result.body?.success ? 'успішно' : result.body?.error ?? 'перевірте логи'}`
        : 'Помилка',
    );
  }

  return (
    <div>
      <PageHeader
        title="TikTok Events API"
        description="Server-side events з deduplication через event_id та consent-aware доставкою"
      />
      <div className="bg-white rounded-xl border p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Pixel ID (event_source_id)</label>
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
          <button type="button" onClick={sendTest} className="px-4 py-2 border rounded-lg text-sm">Тестова подія</button>
        </div>
        {message && <p className="text-sm text-slate-600">{message}</p>}
        <p className="text-xs text-slate-400">
          Використовуємо ttclid/ttp з кліку або hashed external_id за згодою. Raw Telegram ID не передається.
        </p>
      </div>
    </div>
  );
}
