import { Card, EmptyState } from '@/components/v2/ui';
import { formatPercentUk } from '@/lib/labels';
import type { BreakdownNode } from './report-breakdowns';
import { ReachCell } from './ReachCell';

const LEVEL_NAMES = ['Джерело', 'Кампанія', 'Креатив'] as const;

function Metrics({ node }: { node: BreakdownNode }) {
  return (
    <dl className="grid grid-cols-4 gap-2 text-right text-sm tabular-nums sm:min-w-[360px]">
      <div><dt className="text-[11px] text-slate-400">Кліки</dt><dd className="font-semibold">{node.clicks}</dd></div>
      <div>
        <dt className="text-[11px] text-slate-400">Дійшли</dt>
        <dd className="font-semibold">
          <ReachCell row={node} compact />
        </dd>
      </div>
      <div><dt className="text-[11px] text-slate-400">Підписки</dt><dd className="font-semibold">{node.subscribers}</dd></div>
      <div>
        <dt className="text-[11px] text-slate-400">Конверсія</dt>
        <dd className="font-semibold">{node.clicks > 0 ? formatPercentUk(node.subscribers / node.clicks) : '—'}</dd>
      </div>
    </dl>
  );
}

function Row({ node, depth }: { node: BreakdownNode; depth: number }) {
  const label = (
    <span className="min-w-0">
      <span className="block text-[11px] uppercase tracking-wide text-slate-400">{LEVEL_NAMES[depth]}</span>
      <span className="block break-words font-semibold text-[#102044]">{node.label}</span>
    </span>
  );
  const rowCls = 'flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6';

  if (node.children.length === 0) {
    return <div className={`${rowCls} border-t border-slate-100`}>{label}<Metrics node={node} /></div>;
  }

  return (
    <details className="group border-t border-slate-100 first:border-t-0" open={depth === 0}>
      <summary className={`${rowCls} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <span className="flex min-w-0 items-start gap-2">
          <span aria-hidden="true" className="mt-4 text-xs text-slate-400 transition group-open:rotate-90">▶</span>
          {label}
        </span>
        <Metrics node={node} />
      </summary>
      <div className="ml-3 border-l border-slate-100 pl-3 sm:ml-5 sm:pl-5">
        {node.children.map((child) => (
          <Row key={child.key} node={child} depth={depth + 1} />
        ))}
      </div>
    </details>
  );
}

/**
 * S2-19: розріз від джерела до кампанії й конкретного креативу.
 * Метрики кожного рівня — сума вкладених, тож цифри завжди сходяться.
 */
export function CreativeTree({ nodes }: { nodes: BreakdownNode[] }) {
  const hasCreatives = nodes.some((source) =>
    source.children.some((campaign) =>
      campaign.children.some((creative) => creative.label !== 'Без мітки креативу'),
    ),
  );

  return (
    <Card title="Креативи" hint="Розкрийте джерело → кампанію → конкретне оголошення">
      {nodes.length === 0 ? (
        <EmptyState
          title="Ще немає кліків по посиланнях"
          description="Щойно по посиланнях з мітками підуть кліки, тут з’явиться розбивка до кожного креативу."
        />
      ) : (
        <>
          {!hasCreatives && (
            <p className="mb-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Креативи ще не розмічені. Додайте «Креатив» або utm_content у посилання — і тут буде видно, яке оголошення працює краще.
            </p>
          )}
          <div>
            {nodes.map((node) => (
              <Row key={node.key} node={node} depth={0} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
