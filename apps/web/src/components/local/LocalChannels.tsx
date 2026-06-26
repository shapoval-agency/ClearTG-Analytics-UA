'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { useLocalData } from '@/hooks/useLocalData';
import { addChannel } from '@/lib/local-store';

export function LocalChannels() {
  const { state, update, ready } = useLocalData();
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');

  if (!ready || !state) return <p className="text-slate-500">Завантаження…</p>;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!state) return;
    update(addChannel(state, { title, username: username || undefined }));
    setTitle('');
    setUsername('');
  }

  return (
    <div>
      <PageHeader title="Канали" description="Telegram-канали вашого workspace" />

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6 text-sm text-blue-900">
        <p className="font-medium mb-2">Поки без бекенду</p>
        <p className="text-blue-800">
          Додайте канал вручну — збережеться у браузері. Після підключення API бот підхопить
          канал автоматично, коли стане адміном.
        </p>
      </div>

      <form onSubmit={handleAdd} className="bg-white rounded-xl border p-5 mb-6 space-y-3">
        <h2 className="font-semibold text-sm">Додати канал</h2>
        <input
          required
          placeholder="Назва каналу"
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          placeholder="@username (необовʼязково)"
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm">
          Зберегти
        </button>
      </form>

      {state.channels.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500 text-sm">
          Ще немає каналів
        </div>
      ) : (
        <div className="grid gap-4">
          {state.channels.map((ch) => (
            <Link
              key={ch.id}
              href={`/channels/${ch.id}`}
              className="bg-white rounded-xl border p-5 hover:border-brand-300 block"
            >
              <h3 className="font-medium">{ch.title}</h3>
              {ch.username && <p className="text-sm text-slate-500">@{ch.username}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
