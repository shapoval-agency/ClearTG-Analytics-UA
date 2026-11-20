'use client';

import { useState } from 'react';

export function EmbedSnippet({ slug }: { slug: string }) {
  const [snippet, setSnippet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tracking-links/${slug}/embed`, { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as { scriptTag: string };
      setSnippet(data.scriptTag);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t">
      <button
        type="button"
        onClick={() => (snippet ? setSnippet(null) : load())}
        className="text-xs text-brand-600 hover:underline"
        disabled={loading}
      >
        {loading ? '…' : snippet ? 'Сховати скрипт для лендингу' : 'Скрипт для Tilda / Taplink'}
      </button>
      {snippet && (
        <pre className="mt-2 p-3 bg-slate-50 rounded text-xs overflow-x-auto whitespace-pre-wrap">
          {snippet}
        </pre>
      )}
    </div>
  );
}
