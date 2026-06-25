'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { saveGA4IntegrationAction, testGA4EventAction } from '@/lib/actions';

export default function GA4IntegrationPage() {
  const [measurementId, setMeasurementId] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [message, setMessage] = useState('');

  async function save() {
    const result = await saveGA4IntegrationAction({ measurementId, apiSecret });
    setMessage(result.error ? result.error : 'Збережено');
  }

  async function sendTest() {
    const result = await testGA4EventAction();
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(result.ok ? `Тест: ${result.body?.success ? 'успішно' : result.body?.error}` : 'Помилка');
  }

  return (
    <div>
      <PageHeader title="GA4 Measurement Protocol" description="Доповнює базовий GA4 tagging, не замінює його" />
      <div className="bg-white rounded-xl border p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Measurement ID</label>
          <input className="w-full border rounded-lg px-3 py-2" value={measurementId} onChange={(e) => setMeasurementId(e.target.value)} placeholder="G-XXXXXXXX" />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">API Secret</label>
          <input type="password" className="w-full border rounded-lg px-3 py-2" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={save} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm">Зберегти</button>
          <button type="button" onClick={sendTest} className="px-4 py-2 border rounded-lg text-sm">Тестова подія</button>
        </div>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>
    </div>
  );
}
