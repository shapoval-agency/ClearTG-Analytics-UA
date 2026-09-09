'use client';

import { useState } from 'react';
import { createSeedInviteLinkAction } from '@/lib/actions';

const PAID_PLATFORMS = ['META', 'GOOGLE', 'TIKTOK'];

export function CreateSeedInviteLinkForm({
  channels,
  campaigns,
}: {
  channels: Array<{ id: string; title: string }>;
  campaigns: Array<{ id: string; name: string; adPlatform?: string }>;
}) {
  const eligibleCampaigns = campaigns.filter((c) => !PAID_PLATFORMS.includes(c.adPlatform ?? ''));

  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [campaignId, setCampaignId] = useState(eligibleCampaigns[0]?.id ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (channels.length === 0) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignId) {
      setError('Спочатку створіть кампанію (не paid) на сторінці «Кампанії»');
      return;
    }
    setLoading(true);
    setError('');

    const result = await createSeedInviteLinkAction({ channelId, campaignId, name: name.trim() });
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setName('');
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 mb-6 space-y-4">
      <h2 className="font-semibold">Нове запрошувальне посилання (посів)</h2>
      <p className="text-xs text-slate-500">
        Постійне посилання виду <code className="bg-slate-100 px-1 rounded">t.me/+код</code> — Telegram сам
        повідомляє нам, якою саме посиланням скористалась людина при вступі, тому джерело відоме на
        100%, без розрахунку. За це — два обмеження: посилання завжди відкриває канал цілком (не
        конкретний пост, обійти не можна) і не підтримує UTM-мітки. Для платної реклами (Meta, Google,
        TikTok) використовуйте tracking-посилання вище — там є і мітки, і конкретний пост.
      </p>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Назва джерела</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Наприклад: посів у каналі «Новини Х»"
          required
        />
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
      <div>
        <label className="block text-sm text-slate-600 mb-1">Кампанія</label>
        {eligibleCampaigns.length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
            Немає кампаній, придатних для посіву (Meta/Google/TikTok не підходять — там потрібні
            мітки). Створіть кампанію з іншим джерелом реклами на сторінці{' '}
            <a href="/campaigns" className="underline">«Кампанії»</a>.
          </p>
        ) : (
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            {eligibleCampaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || eligibleCampaigns.length === 0}
        className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm disabled:opacity-50"
      >
        {loading ? 'Створюємо…' : 'Створити запрошувальне посилання'}
      </button>
    </form>
  );
}
