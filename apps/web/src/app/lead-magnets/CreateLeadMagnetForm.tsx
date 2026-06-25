'use client';

import { useState } from 'react';
import { createLeadMagnetAction } from '@/lib/actions';

export function CreateLeadMagnetForm({ channels }: { channels: Array<{ id: string; title: string }> }) {
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [contentUrl, setContentUrl] = useState('');
  const [consentText, setConsentText] = useState(
    'Я погоджуюсь на обробку даних для отримання матеріалу. Дані використовуються лише для аналітики та доставки контенту.',
  );
  const [message, setMessage] = useState('');
  const [botLink, setBotLink] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const result = await createLeadMagnetAction({
      channelId,
      name,
      contentUrl: contentUrl || undefined,
      consentText,
    });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage('Створено');
    if (result.botLink) setBotLink(result.botLink);
  }

  if (channels.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
        Спочатку додайте канал у розділі «Канали».
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 space-y-4">
      <h2 className="font-semibold">Новий lead magnet</h2>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Назва</label>
        <input required className="w-full border rounded-lg px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Канал</label>
        <select className="w-full border rounded-lg px-3 py-2" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">URL матеріалу</label>
        <input type="url" className="w-full border rounded-lg px-3 py-2" value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Текст згоди</label>
        <textarea required rows={4} className="w-full border rounded-lg px-3 py-2 text-sm" value={consentText} onChange={(e) => setConsentText(e.target.value)} />
      </div>
      <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm">Створити</button>
      {message && <p className="text-sm text-slate-600">{message}</p>}
      {botLink && (
        <p className="text-sm font-mono text-brand-600 break-all">Bot link: {botLink}</p>
      )}
    </form>
  );
}
