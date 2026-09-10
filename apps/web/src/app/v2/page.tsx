import Link from 'next/link';
import { api, AuthError, type DashboardOverview } from '@/lib/api';
import {
  PageHeader,
  Card,
  StatCard,
  Badge,
  ErrorState,
  EmptyState,
  ModulePlaceholder,
} from '@/components/v2/ui';

export const dynamic = 'force-dynamic';

/**
 * Огляд — каркас.
 *
 * Повноцінний головний екран (S1-21) робиться пізніше: він потребує
 * періоду та порівняння, яких `getOverview()` поки не приймає — метод
 * рахує за весь час без фільтрів (див. MVP_TECHNICAL_PLAN.md, розділ 4.1).
 *
 * Зараз тут навмисно мінімум: перевірка з'єднання. Вона доводить, що
 * авторизація, cookie workspace і проксі до API справді працюють у новому
 * кабінеті — без цього каркас неможливо перевірити.
 */
export default async function V2OverviewPage() {
  let data: DashboardOverview | null = null;
  let failure: string | null = null;

  try {
    data = await api<DashboardOverview>('/api/dashboard/overview');
  } catch (err) {
    if (err instanceof AuthError) throw err;
    failure = err instanceof Error ? err.message : 'Невідома помилка';
  }

  return (
    <>
      <PageHeader
        title="Огляд"
        description="Тут буде відповідь на питання «що сталося і чи є проблема» за 10 секунд."
      />

      <Card
        title="Перевірка з'єднання"
        hint="Тимчасовий блок: підтверджує, що новий кабінет бачить дані через існуючий API"
        className="mb-6"
      >
        {failure ? (
          <ErrorState
            title="API не відповідає"
            description="Новий кабінет не отримав дані. Перевірте, чи запущено apps/api та чи заданий API_INTERNAL_URL."
            detail={failure}
          />
        ) : !data ? (
          <EmptyState title="Даних поки немає" />
        ) : (
          <>
            <div className="mb-4">
              <Badge tone="ok">API відповідає</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Кліки" value={data.clicks} />
              <StatCard label="Підписки" value={data.subscribers} />
              <StatCard label="Активні" value={data.activeSubscribers} />
              <StatCard label="Відписки" value={data.unsubscribes} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600">Баланс подій:</span>
              {data.dataIntegrity.ok ? (
                <Badge tone="ok">сходиться</Badge>
              ) : (
                <Badge tone="error">
                  {data.dataIntegrity.missing} підписок без атрибуції
                </Badge>
              )}
              <span className="text-xs text-slate-400">
                атрибутовано {data.dataIntegrity.attributed} із{' '}
                {data.dataIntegrity.subscribers}
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-4">
              Цифри — за весь час, без фільтра періоду. Порівняння періодів
              з&apos;явиться разом із параметрами <code>from</code>/<code>to</code>{' '}
              в <code>getOverview()</code>.
            </p>
          </>
        )}
      </Card>

      <ModulePlaceholder
        summary="Що буде на цьому екрані згідно з MVP_SCOPE."
        planned={[
          {
            id: 'S1-21',
            title: 'Ключові показники з порівнянням періоду',
            api: 'GET /api/dashboard/overview',
            ready: false,
          },
          {
            id: 'S1-22',
            title: 'Топ джерел із часткою',
            api: 'GET /api/dashboard/campaigns',
            ready: true,
          },
          {
            id: 'S1-23',
            title: 'Якість даних: точне / розрахункове / невідоме',
            api: 'overview → attributions[]',
            ready: true,
          },
          {
            id: 'S1-25',
            title: 'Баланс подій із поясненням, що робити',
            api: 'overview → dataIntegrity',
            ready: true,
          },
          {
            id: 'S1-05',
            title: 'Стан збору: канал відключено або бот втратив права',
            api: 'GET /api/channels',
            ready: true,
          },
        ]}
      />

      <p className="text-sm text-slate-500 mt-6">
        Потрібні інтеграції, лід-магніти, команда чи приватність?{' '}
        <Link href="/dashboard" className="text-brand-600 hover:underline">
          Вони залишаються в старому кабінеті
        </Link>
        .
      </p>
    </>
  );
}
