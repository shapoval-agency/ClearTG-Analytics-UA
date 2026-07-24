'use client';

import { useState } from 'react';
import { createTrackingLinkAction } from '@/lib/actions';

const AD_SOURCES = [
  { value: 'meta', label: 'Meta (Facebook/Instagram Ads)', medium: 'cpc' },
  { value: 'google', label: 'Google Ads', medium: 'cpc' },
  { value: 'tiktok', label: 'TikTok Ads', medium: 'cpc' },
  { value: 'telegram_ads', label: 'Telegram Ads', medium: 'cpc' },
  { value: 'telegram', label: 'Telegram (публікація в іншому каналі/пості)', medium: 'social' },
  { value: 'instagram', label: 'Instagram (органічно)', medium: 'social' },
  { value: 'influencer', label: 'Інфлюенсер', medium: 'referral' },
  { value: 'organic', label: 'Органіка / пряме посилання', medium: 'referral' },
  { value: 'other', label: 'Інше…', medium: '' },
] as const;

type AdSourceValue = (typeof AD_SOURCES)[number]['value'];

export function CreateTrackingLinkForm({
  channels,
  campaigns,
  botConnections = [],
}: {
  channels: Array<{ id: string; title: string }>;
  campaigns: Array<{ id: string; name: string }>;
  botConnections?: Array<{ id: string; botUsername: string; isActive: boolean }>;
}) {
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [linkMode, setLinkMode] = useState<'LANDING_PAGE' | 'SHORTLINK'>('LANDING_PAGE');
  const [adSource, setAdSource] = useState<AdSourceValue>('meta');
  const [customSource, setCustomSource] = useState('');
  const [destination, setDestination] = useState<'channel' | 'personal' | 'bot'>('channel');
  const [personalUsername, setPersonalUsername] = useState('');
  const [botConnectionId, setBotConnectionId] = useState(botConnections[0]?.id ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (channels.length === 0) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const sourceMeta = AD_SOURCES.find((s) => s.value === adSource)!;
    const utmSource = adSource === 'other' ? customSource.trim() : sourceMeta.value;

    const isPersonal = destination === 'personal';
    const isBot = destination === 'bot';
    if (isPersonal && !personalUsername.trim()) {
      setError('Вкажіть username особистого акаунта');
      setLoading(false);
      return;
    }
    if (isBot && !botConnectionId) {
      setError('Спочатку підключіть бота на сторінці «Свій бот»');
      setLoading(false);
      return;
    }

    const result = await createTrackingLinkAction({
      channelId,
      campaignId: linkMode === 'LANDING_PAGE' ? campaignId || undefined : undefined,
      name,
      linkMode,
      utmSource: utmSource || undefined,
      utmMedium: sourceMeta.medium || undefined,
      ...(isPersonal
        ? {
            destinationMode: 'PERSONAL_CHAT',
            destinationUrl: `https://t.me/${personalUsername.trim().replace(/^@/, '')}`,
            usePerClickInvite: false,
          }
        : {}),
      ...(isBot
        ? {
            destinationMode: 'CLIENT_BOT_START',
            botConnectionId,
            usePerClickInvite: false,
          }
        : {}),
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
        <label className="block text-sm text-slate-600 mb-1">Куди веде посилання</label>
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={destination}
          onChange={(e) => setDestination(e.target.value as 'channel' | 'personal' | 'bot')}
        >
          <option value="channel">Канал (за замовчуванням)</option>
          <option value="personal">Особистий акаунт (особисті повідомлення)</option>
          <option value="bot">Свій бот (переходи в бота, /start з міткою)</option>
        </select>
        {destination === 'personal' ? (
          <>
            <input
              className="w-full border rounded-lg px-3 py-2 mt-2"
              value={personalUsername}
              onChange={(e) => setPersonalUsername(e.target.value)}
              placeholder="@username особистого акаунта"
            />
            <p className="text-xs text-slate-500 mt-1">
              Ми бачимо тільки сам факт переходу за посиланням. Що людина написала, чи відповіли їй
              і чим усе скінчилось — ми не бачимо: особистий акаунт не бот, доступу до листування
              немає і не буде.
            </p>
          </>
        ) : null}
        {destination === 'bot' ? (
          botConnections.length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mt-2">
              Немає підключених ботів. Спочатку підключіть бота на сторінці{' '}
              <a href="/integrations/own-bot" className="underline">«Свій бот»</a>.
            </p>
          ) : (
            <>
              <select
                className="w-full border rounded-lg px-3 py-2 mt-2"
                value={botConnectionId}
                onChange={(e) => setBotConnectionId(e.target.value)}
              >
                {botConnections.map((b) => (
                  <option key={b.id} value={b.id}>@{b.botUsername}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Точна атрибуція: коли людина натисне «Старт», Telegram сам передасть нам мітку
                разом з її ідентифікатором — без розрахунку і без похибки.
              </p>
            </>
          )
        ) : null}
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
