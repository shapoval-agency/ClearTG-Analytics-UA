'use client';

import { useState } from 'react';
import { inviteMemberAction } from '@/lib/actions';
import { useRouter } from 'next/navigation';

const ROLES = ['MEMBER', 'ADMIN', 'VIEWER'] as const;

export function InviteMemberForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('MEMBER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await inviteMemberAction({ email, role });
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setEmail('');
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
      <h2 className="font-medium text-slate-900">Запросити учасника</h2>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          placeholder="email@company.ua"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? '…' : 'Запросити'}
        </button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <p className="text-xs text-slate-400">
        Клієнт отримає magic link на email (у staging — той самий пароль, якщо email у STAGING_LOGIN_EMAIL).
      </p>
    </form>
  );
}
