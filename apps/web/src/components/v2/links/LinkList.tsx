import { LinkRow } from './LinkRow';
import type { EditableLink, LinkRowData } from './link-kind';
import type { BuilderBot, BuilderCampaign } from './LinkBuilder';

/** Обидва типи посилань в одному списку: активні зверху, архівні окремо. */
export function LinkList({
  rows,
  campaigns,
  bots,
  onDuplicate,
}: {
  rows: LinkRowData[];
  campaigns?: BuilderCampaign[];
  bots?: BuilderBot[];
  onDuplicate?: (value: EditableLink) => void;
}) {
  const active = rows.filter((r) => r.isActive);
  const inactive = rows.filter((r) => !r.isActive);

  return (
    <>
      {active.length > 0 && (
        <div className="mb-6 grid gap-4 xl:grid-cols-2">
          {active.map((row) => (
            <LinkRow key={`${row.kind}-${row.id}`} row={row} campaigns={campaigns} bots={bots} onDuplicate={onDuplicate} />
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-slate-500 mb-3">
            Архівні та відкликані ({inactive.length})
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {inactive.map((row) => (
              <LinkRow key={`${row.kind}-${row.id}`} row={row} campaigns={campaigns} bots={bots} onDuplicate={onDuplicate} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
