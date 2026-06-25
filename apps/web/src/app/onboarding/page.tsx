'use client';

import { useState } from 'react';
import { createWorkspaceAction } from '@/lib/actions';

export default function OnboardingPage() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await createWorkspaceAction(name);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border p-8">
        <h1 className="text-xl font-semibold">Створіть workspace</h1>
        <p className="text-slate-500 text-sm mt-2">
          Workspace — це простір для каналів, кампаній та аналітики вашого клієнта або агентства.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Назва</label>
            <input
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Моє агентство"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? 'Створюємо…' : 'Створити workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
