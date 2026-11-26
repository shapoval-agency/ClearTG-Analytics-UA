'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/v2/links/CopyButton';
import { GiftForm, type GiftChannel } from './GiftForm';

/** Кнопка «+ Новий подарунок» з формою; після створення показує готове посилання. */
export function NewGiftPanel({ channels, startOpen = false }: { channels: GiftChannel[]; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [created, setCreated] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <section className="mb-6 min-w-0 rounded-[18px] border border-[#dbe4f0] bg-white p-4 shadow-[0_10px_34px_rgba(20,52,110,0.055)] sm:p-5">
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setCreated(null); }}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">
          + Новий подарунок
        </button>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#102044] sm:text-lg">Новий подарунок</h2>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-50">
              Закрити
            </button>
          </div>
          <GiftForm
            key={formKey}
            channels={channels}
            onDone={(botLink) => { setCreated(botLink); setOpen(false); setFormKey((k) => k + 1); }}
          />
        </>
      )}

      {created && !open && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">Подарунок створено. Посилання для кнопки:</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate">{created}</code>
            <CopyButton value={created} />
          </div>
          <p className="mt-2 text-xs">Або опублікуйте пост із кнопкою прямо з картки подарунка нижче.</p>
        </div>
      )}
    </section>
  );
}
