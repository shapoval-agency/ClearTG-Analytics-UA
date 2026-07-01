'use client';

import { useState } from 'react';
import { createClientWorkspaceAction } from '@/lib/actions';

export function CreateClientForm() {
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await createClientWorkspaceAction({ name, ownerEmail });
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
      <h2 className="font-medium text-slate-900">Новий клієнт</h2>
      <p className="text-sm text-slate-500">
        Створює окремий кабінет. Клієнт отримає роль OWNER, ви — ADMIN.
      </p>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Назва кабінету</label>
        <input
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="ТОВ Приклад"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Email клієнта (OWNER)</label>
        <input
          type="email"
          required
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="client@company.ua"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Створюємо…' : 'Створити кабінет'}
      </button>
    </form>
  );
}
