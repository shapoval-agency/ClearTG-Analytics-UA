import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import { formatDateUk } from '@/lib/labels';
import Link from 'next/link';

interface BotStartRow {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  botUsername: string;
  status: 'ACTIVE' | 'BLOCKED';
  occurredAt: string;
  trackingLinkSlug: string | null;
  trackingLinkName: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  creativeTag: string | null;
}

interface BotStartSummary {
  totalClicks: number;
  totalStarts: number;
  blockedStarts: number;
  startRate: number | null;
}

interface BotStartFeed {
  summary: BotStartSummary;
  rows: BotStartRow[];
}

interface BotConnection {
  id: string;
  botUsername: string;
}

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export default async function BotStartsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; botConnectionId?: string; status?: string }>;
}) {
  const { q, botConnectionId, status } = await searchParams;
  let rows: BotStartRow[] = [];
  let summary: BotStartSummary | null = null;
  let bots: BotConnection[] = [];
  let loadError = false;
  try {
    const [feed, botConnections] = await Promise.all([
      api<BotStartFeed>(`/api/dashboard/bot-starts${qs({ search: q, botConnectionId, status })}`),
      api<BotConnection[]>('/api/client-bots'),
    ]);
    rows = feed.rows;
    summary = feed.summary;
    bots = botConnections;
  } catch {
    loadError = true;
  }

  const hasFilters = Boolean(q || botConnectionId || status);

  return (
    <div>
      <PageHeader
        title="Переходи в бота"
        description="/start у своєму боті клієнта з міткою — точна атрибуція, Telegram сам передає ідентифікатор (блок 1.2)"
      />

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Кліків по посиланню</p>
            <p className="text-xl font-semibold">{summary.totalClicks}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Натиснули «Старт»</p>
            <p className="text-xl font-semibold">{summary.totalStarts}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Заблокували бота</p>
            <p className="text-xl font-semibold">{summary.blockedStarts}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500">Дійшли → натиснули</p>
            <p className="text-xl font-semibold">
              {summary.startRate === null ? '—' : `${Math.round(summary.startRate * 100)}%`}
            </p>
          </div>
        </div>
      )}

      {loadError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          Не вдалося завантажити дані. Увійдіть на{' '}
          <a href="/login?next=/reports/bot-starts" className="underline font-medium">/login</a>.
        </div>
      )}

      {!loadError && bots.length > 0 && (
        <form className="bg-white rounded-xl border p-4 mb-6 flex flex-wrap items-end gap-3" method="get">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-500 mb-1">Пошук за @username, id, кампанією або посиланням</label>
            <input
              type="text"
              name="q"
              defaultValue={q ?? ''}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs text-slate-500 mb-1">Бот</label>
            <select name="botConnectionId" defaultValue={botConnectionId ?? ''} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Усі боти</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>@{b.botUsername}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs text-slate-500 mb-1">Статус</label>
            <select name="status" defaultValue={status ?? ''} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Усі</option>
              <option value="ACTIVE">активний</option>
              <option value="BLOCKED">заблокував бота</option>
            </select>
          </div>
          <button type="submit" className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-700">
            Застосувати
          </button>
          {hasFilters && (
            <Link href="/reports/bot-starts" className="text-sm text-slate-500 underline hover:text-slate-700">
              Скинути
            </Link>
          )}
        </form>
      )}

      {!loadError && rows.length === 0 ? (
        hasFilters ? (
          <p className="text-slate-500 text-sm">Нічого не знайдено за цим фільтром.</p>
        ) : (
          <p className="text-slate-500 text-sm">
            Ще немає переходів. Підключіть бота на сторінці{' '}
            <a href="/integrations/own-bot" className="underline">«Свій бот»</a>, створіть посилання
            з призначенням «Свій бот» і натисніть «Старт» у боті за цим посиланням.
          </p>
        )
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-4">Дата</th>
                <th className="p-4">Бот</th>
                <th className="p-4">Користувач</th>
                <th className="p-4">Статус</th>
                <th className="p-4">Посилання</th>
                <th className="p-4">UTM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-4 whitespace-nowrap">{formatDateUk(r.occurredAt)}</td>
                  <td className="p-4">@{r.botUsername}</td>
                  <td className="p-4 text-slate-600">
                    {r.telegramUsername ? `@${r.telegramUsername}` : `id ${r.telegramUserId}`}
                  </td>
                  <td className="p-4">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        r.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.status === 'ACTIVE' ? 'активний' : 'заблокував бота'}
                    </span>
                  </td>
                  <td className="p-4">
                    {r.trackingLinkSlug ? `/${r.trackingLinkSlug}` : r.trackingLinkName ?? '—'}
                  </td>
                  <td className="p-4 text-slate-600">
                    {[r.utmSource, r.utmCampaign, r.creativeTag].filter(Boolean).join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
