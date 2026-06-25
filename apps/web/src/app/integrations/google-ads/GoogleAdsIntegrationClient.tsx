'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import {
  saveGoogleAdsIntegrationAction,
  getGoogleAdsAuthUrlAction,
  testGoogleAdsEventAction,
} from '@/lib/actions';

export default function GoogleAdsIntegrationClient() {
  const searchParams = useSearchParams();
  const [customerId, setCustomerId] = useState('');
  const [conversionActionId, setConversionActionId] = useState('');
  const [managerAccountId, setManagerAccountId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) setMessage('Google акаунт підключено');
    if (error === 'oauth_denied') setMessage('OAuth скасовано');
    if (error === 'oauth_failed') setMessage('Помилка OAuth — спробуйте знову');
  }, [searchParams]);

  async function save() {
    const result = await saveGoogleAdsIntegrationAction({
      customerId,
      conversionActionId,
      managerAccountId: managerAccountId || undefined,
    });
    setMessage(result.error ?? 'Налаштування збережено');
  }

  async function connectOAuth() {
    const result = await getGoogleAdsAuthUrlAction();
    if (result.error || !result.url) {
      setMessage(result.error ?? 'Не вдалося отримати OAuth URL');
      return;
    }
    window.location.href = result.url;
  }

  async function sendTest() {
    const result = await testGoogleAdsEventAction();
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(
      result.ok
        ? `Тест: ${result.body?.success ? 'надіслано' : result.body?.error ?? 'перевірте логи'}`
        : 'Помилка тесту',
    );
  }

  return (
    <div>
      <PageHeader
        title="Google Ads"
        description="Offline Conversions / Enhanced Conversions for Leads через UploadClickConversions API"
      />

      <div className="bg-white rounded-xl border p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Customer ID</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="123-456-7890"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Conversion Action ID</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={conversionActionId}
            onChange={(e) => setConversionActionId(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Manager Account ID (опційно)</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={managerAccountId}
            onChange={(e) => setManagerAccountId(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={save} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm">
            Зберегти
          </button>
          <button type="button" onClick={connectOAuth} className="px-4 py-2 border rounded-lg text-sm">
            Підключити Google OAuth
          </button>
          <button type="button" onClick={sendTest} className="px-4 py-2 border rounded-lg text-sm">
            Тестова конверсія
          </button>
        </div>

        {message && <p className="text-sm text-slate-600">{message}</p>}

        <div className="text-xs text-slate-400 space-y-1 border-t pt-4">
          <p>1. Збережіть Customer ID та Conversion Action ID</p>
          <p>2. Підключіть Google OAuth</p>
          <p>3. Надішліть тестову конверсію</p>
          <p>gclid/gbraid/wbraid з кліку або hashed external_id за згодою ad_user_data.</p>
        </div>
      </div>
    </div>
  );
}
