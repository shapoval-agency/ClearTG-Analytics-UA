'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { useLocalData } from '@/hooks/useLocalData';
import { addCampaign } from '@/lib/local-store';

export function LocalCampaigns() {
  const { state, update, ready } = useLocalData();
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');

  if (!ready || !state) return <p className="text-slate-500">Завантаження…</p>;

  const channels = state.channels;
  const selectedChannel = channelId || channels[0]?.id || '';

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!state || !selectedChannel) return;
    update(
      addCampaign(state, {
        channelId: selectedChannel,
        name,
        adPlatform: 'META',
        source: 'meta',
        medium: 'cpc',
      }),
    );
    setName('');
  }

  return (
    <div>
      <PageHeader title="Кампанії" description="Рекламні кампанії та джерела трафіку" />

      {channels.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800 mb-6">
          Спочатку додайте канал у розділі «Канали».
        </div>
      ) : (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border p-5 mb-6 space-y-3">
          <h2 className="font-semibold text-sm">Нова кампанія (Meta)</h2>
          <input
            required
            placeholder="Meta Ads — Весна 2026"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={selectedChannel}
            onChange={(e) => setChannelId(e.target.value)}
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm">
            Створити
          </button>
        </form>
      )}

      {state.campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500 text-sm">
          Немає кампаній
        </div>
      ) : (
        <div className="space-y-3">
          {state.campaigns.map((c) => {
            const ch = channels.find((x) => x.id === c.channelId);
            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="block bg-white rounded-xl border p-5 hover:border-brand-300"
              >
                <div className="flex justify-between">
                  <h3 className="font-medium">{c.name}</h3>
                  <span className="text-xs bg-slate-100 px-2 py-1 rounded">{c.adPlatform}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{ch?.title ?? '—'}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
