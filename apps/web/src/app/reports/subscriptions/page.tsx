import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import {
  attributionTypeLabel,
  confidenceLabelUk,
  formatDateUk,
  sourceSummary,
} from '@/lib/labels';
import Link from 'next/link';

interface SubscriberRow {
  id: string;
  subscribedAt: string;
  channelTitle: string;
  telegramUsername: string | null;
  attributionType: string;
  campaignName: string | null;
  trackingLinkSlug: string | null;
  trackingLinkName: string | null;
  confidenceScore: number;
  utmSource: string | null;
  utmCampaign: string | null;
}

interface UnsubscribeRow {
  id: string;
  occurredAt: string;
  channelTitle: string;
  telegramUserId?: string | null;
  telegramUsername: string | null;
  subscribedAt: string | null;
  hasSubscriberProfile?: boolean;
  attributionType: string | null;
  campaignName: string | null;
  trackingLinkSlug: string | null;
  trackingLinkName: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
}

interface Channel {
  id: string;
  title: string;
}

const ATTRIBUTION_TYPES = ['EXACT_CLICK_INVITE', 'CAMPAIGN_INVITE', 'PROBABILISTIC', 'ORGANIC', 'UNKNOWN'];

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export default async function ReportsSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; channelId?: string; attributionType?: string }>;
}) {
  const { q, channelId, attributionType } = await searchParams;
  let subscribers: SubscriberRow[] = [];
  let unsubscribes: UnsubscribeRow[] = [];
  let channels: Channel[] = [];
  let loadError = false;

  try {
    [subscribers, unsubscribes, channels] = await Promise.all([
      api<SubscriberRow[]>(`/api/dashboard/subscribers${qs({ search: q, channelId, attributionType })}`),
      api<UnsubscribeRow[]>(`/api/dashboard/unsubscribes${qs({ search: q, channelId })}`),
      api<Channel[]>('/api/channels'),
    ]);
  } catch {
    loadError = true;
  }

  const hasFilters = Boolean(q || channelId || attributionType);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Підписки та відписки"
        description="Кожна підписка з джерелом (кампанія, посилання, UTM). Відписки — з прив’язкою до початкового джерела."
      />

      {loadError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          Не вдалося завантажити дані. Увійдіть на{' '}
          <a href="/login?next=/reports/subscriptions" className="underline font-medium">
            /login
          </a>
          .
        </div>
      )}

      <form className="bg-white rounded-xl border p-4 flex flex-wrap items-end gap-3" method="get">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-slate-500 mb-1">Пошук за @username або id</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs text-slate-500 mb-1">Канал</label>
          <select name="channelId" defaultValue={channelId ?? ''} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Усі канали</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.title}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs text-slate-500 mb-1">Тип атрибуції (підписки)</label>
          <select name="attributionType" defaultValue={attributionType ?? ''} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Усі типи</option>
            {ATTRIBUTION_TYPES.map((t) => (
              <option key={t} value={t}>{attributionTypeLabel(t)}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-700">
          Застосувати
        </button>
        {hasFilters && (
          <Link href="/reports/subscriptions" className="text-sm text-slate-500 underline hover:text-slate-700">
            Скинути
          </Link>
        )}
      </form>

      <section>
        <h2 className="font-semibold mb-3">Підписки ({subscribers.length})</h2>
        {subscribers.length === 0 ? (
          <p className="text-slate-500 text-sm">
            {hasFilters
              ? 'Нічого не знайдено за цим фільтром.'
              : 'Ще немає підписок. Створіть tracking-посилання, клікніть і підпишіться на канал.'}
          </p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="p-4">Дата</th>
                  <th className="p-4">Канал</th>
                  <th className="p-4">Користувач</th>
                  <th className="p-4">Джерело</th>
                  <th className="p-4">Тип атрибуції</th>
                  <th className="p-4">Впевненість</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="p-4 whitespace-nowrap">{formatDateUk(s.subscribedAt)}</td>
                    <td className="p-4">{s.channelTitle}</td>
                    <td className="p-4 text-slate-600">
                      {s.telegramUsername ? `@${s.telegramUsername}` : '—'}
                    </td>
                    <td className="p-4">{sourceSummary(s)}</td>
                    <td className="p-4">{attributionTypeLabel(s.attributionType)}</td>
                    <td className="p-4">{confidenceLabelUk(s.confidenceScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Відписки ({unsubscribes.length})</h2>
        {unsubscribes.length === 0 ? (
          <p className="text-slate-500 text-sm">{hasFilters ? 'Нічого не знайдено за цим фільтром.' : 'Відписок поки немає.'}</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="p-4">Дата відписки</th>
                  <th className="p-4">Канал</th>
                  <th className="p-4">Користувач</th>
                  <th className="p-4">Дата підписки</th>
                  <th className="p-4">Джерело підписки</th>
                  <th className="p-4">Тип атрибуції</th>
                </tr>
              </thead>
              <tbody>
                {unsubscribes.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="p-4 whitespace-nowrap">{formatDateUk(u.occurredAt)}</td>
                    <td className="p-4">{u.channelTitle}</td>
                    <td className="p-4 text-slate-600">
                      {u.telegramUsername
                        ? `@${u.telegramUsername}`
                        : u.telegramUserId
                          ? `id ${u.telegramUserId}`
                          : '—'}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {u.subscribedAt ? formatDateUk(u.subscribedAt) : 'немає запису'}
                    </td>
                    <td className="p-4">
                      {u.attributionType
                        ? sourceSummary(u)
                        : u.hasSubscriberProfile === false || !u.subscribedAt
                          ? 'Підписка не була зафіксована ботом'
                          : 'Без атрибуції (органіка / невідомо)'}
                    </td>
                    <td className="p-4">
                      {u.attributionType
                        ? attributionTypeLabel(u.attributionType)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-3">
          Прочерки / «немає запису» означають: людина вийшла з каналу, але ClearTG не бачив її
          підписку (бот доданий пізніше, або підписка без tracking). Це не імена — колонка
          «Користувач» показує @username або Telegram ID.
        </p>
      </section>
    </div>
  );
}
