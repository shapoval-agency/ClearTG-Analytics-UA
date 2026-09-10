import { PageHeader, ModulePlaceholder } from '@/components/v2/ui';

export const dynamic = 'force-dynamic';

/**
 * Звіти — каркас.
 *
 * Один розділ зі спільними фільтрами замість шести окремих сторінок
 * старого кабінету (три з яких навіть не були в меню).
 *
 * Два розриви, які треба закрити в бекенді (адитивно):
 *   1. періоду немає — getOverview/getCampaignReports/getTrackingLinkReports
 *      рахують за весь час;
 *   2. частка тих, хто дійшов до Telegram: поле ClickEvent.telegramOpenedAt
 *      заповнюється, але ніде не агрегується.
 */
export default function V2ReportsPage() {
  return (
    <>
      <PageHeader
        title="Звіти"
        description="Яке джерело працює, а яке спалює бюджет. Один розділ зі спільними фільтрами."
      />

      <ModulePlaceholder
        summary="Агрегація здебільшого готова в dashboard.service.ts. Бракує фільтра періоду і частки тих, хто дійшов до Telegram."
        planned={[
          {
            id: 'S1-22',
            title: 'Джерела: кліки, підписки, відписки, CR',
            api: 'GET /api/dashboard/campaigns',
            ready: true,
          },
          {
            id: 'S1-22',
            title: 'Розріз по посиланнях',
            api: 'GET /api/dashboard/tracking-links',
            ready: true,
          },
          {
            id: 'S1-03',
            title: 'Стрічка підписок із джерелом',
            api: 'GET /api/dashboard/subscribers',
            ready: true,
          },
          {
            id: 'S1-04',
            title: 'Стрічка відписок',
            api: 'GET /api/dashboard/unsubscribes',
            ready: true,
          },
          {
            id: 'S1-23',
            title: 'Якість даних за типами атрибуції',
            api: 'overview → attributions[]',
            ready: true,
          },
          {
            id: 'S2-12',
            title: 'Частка тих, хто дійшов до Telegram',
            api: 'потрібна агрегація telegramOpenedAt',
            ready: false,
          },
          {
            id: 'S1-24',
            title: 'Експорт поточного звіту з UTF-8 BOM',
            api: 'зараз лише subscribers/export.csv',
            ready: false,
          },
          {
            id: 'S1-21',
            title: 'Фільтр періоду для всіх звітів',
            api: 'потрібні ?from=&to=&channelId=',
            ready: false,
          },
        ]}
      />
    </>
  );
}
