'use client';

import { useState } from 'react';
import { createTrackingLinkAction } from '@/lib/actions';

const AD_SOURCES = [
  { value: 'meta', label: 'Meta (Facebook/Instagram Ads)', medium: 'cpc' },
  { value: 'google', label: 'Google Ads', medium: 'cpc' },
  { value: 'tiktok', label: 'TikTok Ads', medium: 'cpc' },
  { value: 'telegram_ads', label: 'Telegram Ads', medium: 'cpc' },
  { value: 'instagram', label: 'Instagram (органічно)', medium: 'social' },
  { value: 'influencer', label: 'Інфлюенсер', medium: 'referral' },
  { value: 'organic', label: 'Органіка / пряме посилання', medium: 'referral' },
  { value: 'other', label: 'Інше…', medium: '' },
] as const;

type AdSourceValue = (typeof AD_SOURCES)[number]['value'];

export function CreateTrackingLinkForm({
  channels,
  campaigns,
}: {
  channels: Array<{ id: string; title: string }>;
  campaigns: Array<{ id: string; name: string }>;
}) {
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [linkMode, setLinkMode] = useState<'LANDING_PAGE' | 'SHORTLINK'>('LANDING_PAGE');
  const [adSource, setAdSource] = useState<AdSourceValue>('meta');
  const [customSource, setCustomSource] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (channels.length === 0) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const sourceMeta = AD_SOURCES.find((s) => s.value === adSource)!;
    const utmSource = adSource === 'other' ? customSource.trim() : sourceMeta.value;

    const result = await createTrackingLinkAction({
      channelId,
      campaignId: linkMode === 'LANDING_PAGE' ? campaignId || undefined : undefined,
      name,
      linkMode,
      utmSource: utmSource || undefined,
      utmMedium: sourceMeta.medium || undefined,
    });
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 mb-6 space-y-4">
      <h2 className="font-semibold">Нове tracking-посилання</h2>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Назва</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Meta landing / organic shortlink"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Тип</label>
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={linkMode}
          onChange={(e) => setLinkMode(e.target.value as 'LANDING_PAGE' | 'SHORTLINK')}
        >
          <option value="LANDING_PAGE">Landing /l/ (Meta, Google, TikTok)</option>
          <option value="SHORTLINK">Shortlink /r/ (organic, influencer)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Джерело реклами</label>
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={adSource}
          onChange={(e) => setAdSource(e.target.value as AdSourceValue)}
        >
          {AD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Визначає utm_source/utm_medium цього посилання — щоб у звітах бачити кожне джерело окремо
          (TikTok окремо від Meta, окремо від органіки тощо).
        </p>
        {adSource === 'other' && (
          <input
            className="w-full border rounded-lg px-3 py-2 mt-2"
            value={customSource}
            onChange={(e) => setCustomSource(e.target.value)}
            placeholder="Своя назва джерела (utm_source)"
          />
        )}
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
      {linkMode === 'LANDING_PAGE' && campaigns.length > 0 && (
        <div>
          <label className="block text-sm text-slate-600 mb-1">Кампанія</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm disabled:opacity-50"
      >
        {loading ? 'Створюємо…' : 'Створити посилання'}
      </button>
    </form>
  );
}
