'use client';

import { useRef, useState } from 'react';
import { LinkList } from './LinkList';
import { LinkBuilder, type BuilderBot, type BuilderCampaign, type BuilderChannel } from './LinkBuilder';
import type { EditableLink, LinkRowData } from './link-kind';

/**
 * Список посилань + конструктор. Окремий клієнтський компонент, щоб
 * «Дублювати» (S2-06) відкривав конструктор, уже заповнений даними посилання.
 */
export function LinksWorkspace({
  rows,
  totalRows,
  channels,
  campaigns,
  bots,
  appUrl,
}: {
  rows: LinkRowData[];
  totalRows: number;
  channels: BuilderChannel[];
  campaigns: BuilderCampaign[];
  bots: BuilderBot[];
  appUrl: string;
}) {
  const [prefill, setPrefill] = useState<EditableLink | null>(null);
  const [builderKey, setBuilderKey] = useState(0);
  const [open, setOpen] = useState(false);
  const builderRef = useRef<HTMLDetailsElement>(null);

  function duplicate(value: EditableLink) {
    setPrefill(value);
    setBuilderKey((k) => k + 1);
    setOpen(true);
    requestAnimationFrame(() => builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return (
    <>
      {rows.length === 0 ? (
        <p className="mb-6 rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
          За цим фільтром посилань немає{totalRows > 0 ? ' — змініть фільтр, щоб побачити інші.' : '.'}
        </p>
      ) : (
        <LinkList rows={rows} campaigns={campaigns} bots={bots} onDuplicate={duplicate} />
      )}
      <details
        ref={builderRef}
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
        className="rounded-[18px] border border-[#dbe4f0] bg-white p-4 shadow-[0_10px_34px_rgba(20,52,110,0.055)] sm:p-5"
      >
        <summary className="cursor-pointer text-sm font-bold text-[#102044] hover:text-brand-700">
          {prefill ? '+ Створити копію посилання' : '+ Створити посилання'}
        </summary>
        <div className="mt-4">
          <LinkBuilder
            key={builderKey}
            channels={channels}
            campaigns={campaigns}
            bots={bots}
            appUrl={appUrl}
            initial={prefill}
          />
        </div>
      </details>
    </>
  );
}
