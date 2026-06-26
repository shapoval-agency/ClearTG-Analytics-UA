'use client';

import { useState } from 'react';
import { createTrackingLinkAction } from '@/lib/actions';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (channels.length === 0) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await createTrackingLinkAction({
      channelId,
      campaignId: linkMode === 'LANDING_PAGE' ? campaignId || undefined : undefined,
      name,
      linkMode,
      utmSource: linkMode === 'LANDING_PAGE' ? 'meta' : 'organic',
      utmMedium: linkMode === 'LANDING_PAGE' ? 'cpc' : 'social',
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
