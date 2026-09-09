'use client';

import { useState } from 'react';
import { createCampaignAction } from '@/lib/actions';

// Той самий список, що й на сторінці «Посилання» — платформа кампанії далі
// визначає, які типи посилань до неї можна прив'язати (paid-платформи не
// підходять для запрошувальних посилань, див. CreateSeedInviteLinkForm).
const AD_PLATFORMS = [
  { value: 'META', label: 'Meta (Facebook/Instagram Ads)', source: 'meta', medium: 'cpc' },
  { value: 'GOOGLE', label: 'Google Ads', source: 'google', medium: 'cpc' },
  { value: 'TIKTOK', label: 'TikTok Ads', source: 'tiktok', medium: 'cpc' },
  { value: 'TELEGRAM_ADS', label: 'Telegram Ads', source: 'telegram_ads', medium: 'cpc' },
  { value: 'INFLUENCER', label: 'Інфлюенсер / посів', source: 'influencer', medium: 'referral' },
  { value: 'ORGANIC', label: 'Органіка / пряме посилання', source: 'organic', medium: 'referral' },
  { value: 'DIRECT', label: 'Прямий трафік', source: 'direct', medium: 'referral' },
  { value: 'OTHER', label: 'Інше', source: 'other', medium: '' },
] as const;

export function CreateCampaignForm({
  channels,
}: {
  channels: Array<{ id: string; title: string }>;
}) {
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [adPlatform, setAdPlatform] = useState<(typeof AD_PLATFORMS)[number]['value']>('META');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (channels.length === 0) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const platform = AD_PLATFORMS.find((p) => p.value === adPlatform)!;
    const result = await createCampaignAction({
      channelId,
      name,
      adPlatform: platform.value,
      source: platform.source,
      medium: platform.medium || undefined,
    });
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 mb-6 space-y-4">
      <h2 className="font-semibold">Нова кампанія</h2>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Назва</label>
        <input
          required
          className="w-full border rounded-lg px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Meta Ads — Весна 2026"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Платформа / джерело</label>
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={adPlatform}
          onChange={(e) => setAdPlatform(e.target.value as (typeof AD_PLATFORMS)[number]['value'])}
        >
          {AD_PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Платні платформи (Meta/Google/TikTok) — лише для tracking-посилань. Для запрошувальних
          посилань (посівів) обирайте «Інфлюенсер», «Органіка», «Telegram Ads» чи «Прямий трафік».
        </p>
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Канал</label>
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
        >
          {channels.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm disabled:opacity-50"
      >
        {loading ? 'Створюємо…' : 'Створити кампанію'}
      </button>
    </form>
  );
}
