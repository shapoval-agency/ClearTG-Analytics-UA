'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { useLocalData } from '@/hooks/useLocalData';
import { addLink } from '@/lib/local-store';

const APP_URL = (typeof window !== 'undefined' ? window.location.origin : '').replace(/\/$/, '');

export function LocalLinks() {
  const { state, update, ready } = useLocalData();
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [linkMode, setLinkMode] = useState<'LANDING_PAGE' | 'SHORTLINK'>('LANDING_PAGE');

  if (!ready || !state) return <p className="text-slate-500">Завантаження…</p>;

  const channels = state.channels;
  const campaigns = state.campaigns;
  const selectedChannel = channelId || channels[0]?.id || '';

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!state || !selectedChannel) return;
    update(
      addLink(state, {
        channelId: selectedChannel,
        campaignId: linkMode === 'LANDING_PAGE' ? campaignId || campaigns[0]?.id : undefined,
        name,
        linkMode,
      }),
    );
    setName('');
  }

  return (
    <div>
      <PageHeader
        title="Tracking Links"
        description="Landing /l/ для Meta або shortlink /r/ для organic"
      />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900">
        Посилання збережені локально. Кліки та редіректи запрацюють після підключення бекенду
        (той самий URL можна буде використати).
      </div>

      {channels.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500 text-sm">
          Спочатку додайте канал
        </div>
      ) : (
        <>
          <form onSubmit={handleAdd} className="bg-white rounded-xl border p-5 mb-6 space-y-3">
            <h2 className="font-semibold text-sm">Нове посилання</h2>
            <input
              required
              placeholder="Назва"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={linkMode}
              onChange={(e) => setLinkMode(e.target.value as 'LANDING_PAGE' | 'SHORTLINK')}
            >
              <option value="LANDING_PAGE">Landing /l/ (Meta)</option>
              <option value="SHORTLINK">Shortlink /r/</option>
            </select>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={selectedChannel}
              onChange={(e) => setChannelId(e.target.value)}
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            {linkMode === 'LANDING_PAGE' && campaigns.length > 0 && (
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={campaignId || campaigns[0]?.id}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm">
              Створити
            </button>
          </form>

          {state.links.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-slate-500 text-sm">
              Ще немає посилань
            </div>
          ) : (
            <div className="space-y-3">
              {state.links.map((l) => {
                const path = l.linkMode === 'SHORTLINK' ? `/r/${l.slug}` : `/l/${l.slug}`;
                return (
                  <div key={l.id} className="bg-white rounded-xl border p-5">
                    <p className="font-mono text-brand-600 text-sm break-all">
                      {APP_URL}
                      {path}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{l.name}</p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
