import { LinkRow } from './LinkRow';
import type { LinkRowData } from './link-kind';

/** Обидва типи посилань в одному списку: активні зверху, архівні окремо. */
export function LinkList({ rows }: { rows: LinkRowData[] }) {
  const active = rows.filter((r) => r.isActive);
  const inactive = rows.filter((r) => !r.isActive);

  return (
    <>
      {active.length > 0 && (
        <div className="grid gap-4 mb-6">
          {active.map((row) => (
            <LinkRow key={`${row.kind}-${row.id}`} row={row} />
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-slate-500 mb-3">
            Архівні та відкликані ({inactive.length})
          </h2>
          <div className="grid gap-4">
            {inactive.map((row) => (
              <LinkRow key={`${row.kind}-${row.id}`} row={row} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
