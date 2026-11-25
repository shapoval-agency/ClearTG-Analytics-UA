import Link from 'next/link';
import { api, AuthError } from '@/lib/api';
import type { ConversionSettings } from '@/app/v2/actions';
import { PageHeader, ErrorState } from '@/components/v2/ui';
import { IntegrationCard } from '@/components/v2/ads/IntegrationCard';
import { GoogleSignIn } from '@/components/v2/ads/GoogleSignIn';
import { ConversionSettingsPanel } from '@/components/v2/ads/ConversionSettingsPanel';
import { DeliverySummary } from '@/components/v2/ads/DeliverySummary';

export const dynamic = 'force-dynamic';

interface MetaIntegrationApi { pixelId: string; testEventCode: string | null; isActive: boolean }
interface Ga4IntegrationApi { measurementId: string; streamId: string | null; isActive: boolean }
interface GoogleAdsIntegrationApi {
  customerId: string;
  conversionActionId: string;
  reachConversionActionId?: string | null;
  giftConversionActionId?: string | null;
  managerAccountId: string | null;
  isActive: boolean;
  oauthConnected: boolean;
  developerTokenConfigured?: boolean;
  dryRun?: boolean;
}

const GOOGLE_NOTICE: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  connected: { tone: 'ok', text: 'Вхід через Google виконано. Тепер натисніть «Перевірити» в блоці Google Ads.' },
  oauth_denied: { tone: 'error', text: 'Google не надав доступ. Спробуйте ще раз і дозвольте доступ до Google Ads.' },
  oauth_failed: { tone: 'error', text: 'Не вдалося завершити вхід через Google. Спробуйте ще раз.' },
};

/**
 * Реклама — етап 03. Підключення Google (GA4, Ads) і Meta з перевіркою до
 * запуску, вибір цілей і чесне зведення доставки.
 */
export default async function V2AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { google } = await searchParams;
  const header = (
    <PageHeader
      title="Реклама"
      description="Передаємо в рекламні кабінети справжніх підписників, щоб реклама вчилась на них, а не на кліках."
    />
  );

  let meta: MetaIntegrationApi | null = null;
  let ga4: Ga4IntegrationApi | null = null;
  let googleAds: GoogleAdsIntegrationApi | null = null;
  let settings: ConversionSettings | null = null;
  let sessionExpired = false;
  let failed = false;

  try {
    [meta, ga4, googleAds, settings] = await Promise.all([
      api<MetaIntegrationApi | null>('/api/integrations/meta'),
      api<Ga4IntegrationApi | null>('/api/integrations/ga4'),
      api<GoogleAdsIntegrationApi | null>('/api/integrations/google-ads'),
      // Старий API без цього endpoint — розділ працює без налаштувань цілей.
      api<ConversionSettings>('/api/conversion-settings').catch(() => null),
    ]);
  } catch (err) {
    if (err instanceof AuthError) sessionExpired = true;
    else failed = true;
  }

  if (sessionExpired) {
    return (
      <>
        {header}
        <ErrorState title="Сесія завершилася" description="Увійдіть знову, щоб побачити рекламні підключення." />
        <Link href="/login?next=/v2/ads" className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Увійти
        </Link>
      </>
    );
  }
  if (failed) {
    return (
      <>
        {header}
        <ErrorState
          title="Не вдалося завантажити рекламні підключення"
          description="Сервіс аналітики зараз не відповідає. Оновіть сторінку — якщо не допомогло, зверніться до підтримки."
        />
      </>
    );
  }

  const notice = google ? GOOGLE_NOTICE[google] : null;
  const dryRun = Boolean(settings?.dryRun || googleAds?.dryRun);
  // У сухому прогоні вхід через Google і developer token не потрібні — нічого не відправляється.
  const googleDisabledReason = dryRun
    ? null
    : googleAds && googleAds.developerTokenConfigured === false
    ? 'На сервері ClearTG ще не налаштовано доступ до Google Ads API — зверніться до підтримки.'
    : googleAds && !googleAds.oauthConnected
      ? 'Спершу виконайте вхід через Google.'
      : null;

  return (
    <>
      {header}
      {dryRun && (
        <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
          <p className="font-bold">Тестовий режим («сухий прогін»)</p>
          <p className="mt-1">
            Події проходять увесь шлях — підписка, затримка, відсів, — але в Meta, GA4 і Google Ads нічого не
            відправляється. Можна вводити будь-які тестові дані підключення. Що саме пішло б у рекламу, видно внизу
            сторінки. На робочому сервері цей режим вимикають (CONVERSIONS_DRY_RUN).
          </p>
        </div>
      )}
      {notice && (
        <p className={`mb-5 rounded-xl border p-3 text-sm ${notice.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {notice.text}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <IntegrationCard
          platform="meta"
          title="Meta (Facebook, Instagram)"
          description="Підписка з реклами Meta повертається в піксель через Conversions API — реклама шукає схожих підписників."
          configured={Boolean(meta)}
          isActive={Boolean(meta?.isActive)}
          initialValues={{ pixelId: meta?.pixelId ?? '', accessToken: '', testEventCode: meta?.testEventCode ?? '' }}
          fields={[
            { name: 'pixelId', label: 'Pixel ID', placeholder: '1234567890123456', hint: 'Events Manager → ваш піксель → Налаштування.' },
            { name: 'accessToken', label: 'Токен Conversions API', secret: true, hint: 'Events Manager → Налаштування → Conversions API → «Згенерувати токен доступу».' },
            { name: 'testEventCode', label: 'Test Event Code', optional: true, hint: 'Лише для перевірки у «Тестових подіях». Приберіть перед запуском.' },
          ]}
        />

        <div className="grid gap-6">
          <IntegrationCard
            platform="ga4"
            title="Google Analytics 4"
            description="Підписка як подія tg_subscribe у GA4 — для звітів і імпорту цілей у Google Ads."
            configured={Boolean(ga4)}
            isActive={Boolean(ga4?.isActive)}
            initialValues={{ measurementId: ga4?.measurementId ?? '', apiSecret: '' }}
            fields={[
              { name: 'measurementId', label: 'Measurement ID', placeholder: 'G-XXXXXXX', hint: 'Адміністрування → Потоки даних → ваш потік.' },
              { name: 'apiSecret', label: 'API secret Measurement Protocol', secret: true, hint: 'Там само → «Секретні ключі API Measurement Protocol».' },
            ]}
          />
          <IntegrationCard
            platform="google-ads"
            title="Google Ads"
            description="Підписка завантажується як офлайн-конверсія за gclid — Google оптимізує ставки на підписників."
            configured={Boolean(googleAds)}
            isActive={Boolean(googleAds?.isActive)}
            disabledReason={googleDisabledReason}
            extra={dryRun ? null : <GoogleSignIn connected={Boolean(googleAds?.oauthConnected)} saved={Boolean(googleAds)} />}
            initialValues={{
              customerId: googleAds?.customerId ?? '',
              conversionActionId: googleAds?.conversionActionId ?? '',
              reachConversionActionId: googleAds?.reachConversionActionId ?? '',
              giftConversionActionId: googleAds?.giftConversionActionId ?? '',
              managerAccountId: googleAds?.managerAccountId ?? '',
            }}
            fields={[
              { name: 'customerId', label: 'Customer ID', placeholder: '123-456-7890', hint: 'Номер акаунта у верхньому правому куті Google Ads.' },
              { name: 'conversionActionId', label: 'Дія-конверсія «Підписка» (ID)', placeholder: '123456789', hint: 'Цілі → Конверсії → дія типу «Імпорт → кліки». ID — число в адресі сторінки дії.' },
              { name: 'reachConversionActionId', label: 'Дія-конверсія «Дійшов до Telegram» (ID)', optional: true },
              { name: 'giftConversionActionId', label: 'Дія-конверсія «Забрав подарок» (ID)', optional: true },
              { name: 'managerAccountId', label: 'ID менеджерського акаунта (MCC)', optional: true, hint: 'Лише якщо доступ до акаунта йде через MCC.' },
            ]}
          />
        </div>
      </div>

      {settings && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <ConversionSettingsPanel initial={settings} />
          <DeliverySummary settings={settings} />
        </div>
      )}
    </>
  );
}
