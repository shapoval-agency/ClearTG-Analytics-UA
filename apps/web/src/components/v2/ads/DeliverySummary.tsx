import { Card } from '@/components/v2/ui';
import { formatDateUk } from '@/lib/labels';
import type { ConversionSettings } from '@/app/v2/actions';

const STATUS_ROWS: Array<{ key: string; label: string; tone: string; hint: string }> = [
  { key: 'SENT', label: 'Відправлено', tone: 'text-emerald-700', hint: 'Рекламна система прийняла подію' },
  { key: 'PENDING', label: 'Чекає відправки', tone: 'text-slate-700', hint: 'Ще йде затримка перед відправкою' },
  { key: 'SKIPPED_UNSUBSCRIBED', label: 'Відсіяно', tone: 'text-slate-700', hint: 'Людина відписалась до відправки' },
  { key: 'SKIPPED_NO_CONSENT', label: 'Без згоди', tone: 'text-amber-700', hint: 'Людина не дала згоду на передачу даних рекламі' },
  { key: 'SKIPPED_NO_IDENTIFIER', label: 'Не було чим зіставити', tone: 'text-slate-500', hint: 'У кліку немає fbclid / gclid / _ga для підключеної системи' },
  { key: 'FAILED', label: 'Помилка', tone: 'text-red-700', hint: 'Рекламна система відхилила подію' },
];

const PLATFORM_LABELS: Record<string, string> = { META: 'Meta', GA4: 'GA4', GOOGLE_ADS: 'Google Ads', TIKTOK: 'TikTok' };
const EVENT_LABELS: Record<string, string> = {
  TG_Subscribe: 'Підписка',
  TG_Reached_Telegram: 'Дійшов до Telegram',
  LeadMagnet_Claimed: 'Забрав подарок',
};

/** Чесне зведення: скільки подій пішло в рекламу, а скільки — ні і чому. */
export function DeliverySummary({ settings }: { settings: ConversionSettings }) {
  const total = Object.values(settings.last30Days).reduce((a, b) => a + b, 0);

  return (
    <Card title="Доставка за 30 днів" hint="Що реально дійшло до рекламних кабінетів">
      {total === 0 ? (
        <p className="text-sm text-slate-500">
          {settings.connected.length === 0
            ? 'Підключіть і увімкніть хоча б одну рекламну систему — тоді тут з’являться події.'
            : 'Подій ще не було. Вони з’являться після перших підписок з реклами.'}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STATUS_ROWS.filter((r) => settings.last30Days[r.key]).map((r) => (
              <div key={r.key} className="rounded-xl bg-slate-50 p-3" title={r.hint}>
                <dt className="text-xs text-slate-500">{r.label}</dt>
                <dd className={`text-xl font-bold tabular-nums ${r.tone}`}>{settings.last30Days[r.key]}</dd>
              </div>
            ))}
          </dl>
          {(settings.last30Days.SKIPPED_NO_CONSENT ?? 0) > 0 && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Частина підписок не передана, бо людина не дала згоду на рекламну аналітику. Згода передається з
              вашого сайту параметрами посилання (marketing_storage, ad_user_data). Без неї ми дані в рекламу не відправляємо.
            </p>
          )}
          {settings.byEvent.some((e) => e.eventName !== 'TG_Subscribe') && (
            <p className="mt-3 text-xs text-slate-500">
              {[...new Set(settings.byEvent.map((e) => e.eventName))].map((name) => {
                const sent = settings.byEvent.filter((e) => e.eventName === name && e.status === 'SENT')
                  .reduce((a, e) => a + e.count, 0);
                return `${EVENT_LABELS[name] ?? name}: відправлено ${sent}`;
              }).join(' · ')}
            </p>
          )}
        </>
      )}

      {settings.recentFailures.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-bold text-[#102044]">Останні помилки</h3>
          <ul className="space-y-2 text-sm">
            {settings.recentFailures.map((f, i) => (
              <li key={i} className="rounded-lg border border-red-100 bg-red-50/60 p-2.5">
                <span className="font-medium text-red-800">
                  {PLATFORM_LABELS[f.platform] ?? f.platform} · {EVENT_LABELS[f.eventName] ?? f.eventName}
                </span>
                <span className="ml-2 text-xs text-slate-500">{formatDateUk(f.at)}</span>
                {f.error && <p className="mt-1 break-words text-xs text-slate-600">{f.error}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
