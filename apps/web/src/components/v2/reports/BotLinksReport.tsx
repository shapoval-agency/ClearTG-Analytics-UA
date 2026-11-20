import { Card, Badge } from '@/components/v2/ui';
import { formatPercentUk } from '@/lib/labels';
import type { BotLinkReportRow } from '@/lib/api';

/**
 * S2-04: клік і старт бота — різні події. Клік — людина натиснула посилання,
 * старт — справді запустила діалог з ботом. Різниця між ними — втрата,
 * яку не видно, якщо рахувати лише кліки.
 */
export function BotLinksReport({ rows }: { rows: BotLinkReportRow[] }) {
  if (rows.length === 0) return null;
  const totals = rows.reduce(
    (acc, row) => ({ clicks: acc.clicks + row.clicks, starts: acc.starts + row.starts }),
    { clicks: 0, starts: 0 },
  );

  return (
    <Card
      title="Переходи в бота"
      hint={`Клік → запуск бота: ${totals.starts} з ${totals.clicks}${totals.clicks > 0 ? ` (${formatPercentUk(totals.starts / totals.clicks)})` : ''}`}
    >
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-[#102044]">{row.name?.trim() || 'Без назви'}</p>
              <p className="text-xs text-slate-500">
                {row.botUsername ? `@${row.botUsername}` : 'бот відключений'}
                {row.campaignName && ` · ${row.campaignName}`}
                {!row.isActive && <span className="ml-2"><Badge tone="neutral">Архівне</Badge></span>}
              </p>
            </div>
            <dl className="grid grid-cols-4 gap-3 text-right text-sm tabular-nums sm:min-w-[380px]">
              <div><dt className="text-[11px] text-slate-400">Кліки</dt><dd className="font-semibold">{row.clicks}</dd></div>
              <div><dt className="text-[11px] text-slate-400">Запустили бота</dt><dd className="font-semibold">{row.starts}</dd></div>
              <div>
                <dt className="text-[11px] text-slate-400">Клік → старт</dt>
                <dd className="font-semibold">{row.clicks > 0 ? formatPercentUk(row.startRate) : '—'}</dd>
              </div>
              <div><dt className="text-[11px] text-slate-400">Заблокували</dt><dd className="font-semibold">{row.blocked}</dd></div>
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Старт рахується за кліком, з якого людина прийшла, тому обидва числа — за той самий період кліків.
      </p>
    </Card>
  );
}
