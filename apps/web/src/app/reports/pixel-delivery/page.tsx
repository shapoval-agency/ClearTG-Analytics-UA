import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import { formatDateUk } from '@/lib/labels';
import Link from 'next/link';

interface DeliveryLog {
  id: string;
  platform: string;
  status: string;
  responseStatus: number | null;
  errorMessage: string | null;
  deliveredAt: string;
  conversionEvent: { eventName: string; eventTime: string };
}

const PLATFORMS = ['META', 'GOOGLE_ADS', 'GA4', 'TIKTOK'];
const STATUSES = ['PENDING', 'SENT', 'FAILED', 'SKIPPED_NO_CONSENT', 'SKIPPED_NO_IDENTIFIER', 'SKIPPED_POLICY_RESTRICTION'];

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export default async function PixelDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string; status?: string }>;
}) {
  const { platform, status } = await searchParams;
  let logs: DeliveryLog[] = [];
  try {
    logs = await api<DeliveryLog[]>(`/api/dashboard/pixel-delivery${qs({ platform, status, limit: '200' })}`);
  } catch { /* empty */ }

  const hasFilters = Boolean(platform || status);

  return (
    <div>
      <PageHeader title="Доставка подій" description="Лог передачі подій у рекламні системи" />

      <form className="bg-white rounded-xl border p-4 mb-6 flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[160px]">
          <label className="block text-xs text-slate-500 mb-1">Платформа</label>
          <select name="platform" defaultValue={platform ?? ''} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Усі платформи</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs text-slate-500 mb-1">Статус</label>
          <select name="status" defaultValue={status ?? ''} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Усі статуси</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-700">
          Застосувати
        </button>
        {hasFilters && (
          <Link href="/reports/pixel-delivery" className="text-sm text-slate-500 underline hover:text-slate-700">
            Скинути
          </Link>
        )}
      </form>

      {logs.length === 0 ? (
        <p className="text-slate-500">{hasFilters ? 'Нічого не знайдено за цим фільтром.' : 'Немає логів доставки'}</p>
      ) : (
        <table className="w-full bg-white rounded-xl border text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="p-3">Подія</th>
              <th className="p-3">Платформа</th>
              <th className="p-3">Статус</th>
              <th className="p-3">HTTP</th>
              <th className="p-3">Час</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="p-3">{l.conversionEvent.eventName}</td>
                <td className="p-3">{l.platform}</td>
                <td className="p-3">{l.status}</td>
                <td className="p-3">{l.responseStatus ?? '—'}</td>
                <td className="p-3">{formatDateUk(l.deliveredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
