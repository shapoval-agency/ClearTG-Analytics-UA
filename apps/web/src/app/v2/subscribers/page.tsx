import { PageHeader, ModulePlaceholder } from '@/components/v2/ui';

export const dynamic = 'force-dynamic';

/**
 * Учасники — каркас.
 *
 * Бекенд готовий: фільтри по каналу, статусу, джерелу і пошук уже
 * реалізовані в getSubscriberFeed(), досьє — в getSubscriberDossier().
 *
 * Важливо для інтерфейсу: в однієї людини може бути кілька профілів на
 * один канал — по одному на цикл підписка → відписка → повторна підписка.
 * Активний профіль той, у якого немає пов'язаної UnsubscribeEvent.
 * Картка має показувати історію циклів, а не один профіль.
 */
export default function V2SubscribersPage() {
  return (
    <>
      <PageHeader
        title="Учасники"
        description="Перевірка цифр на конкретній людині: звідки прийшла і що з нею було далі."
      />

      <ModulePlaceholder
        summary="Розділ переноситься майже без змін — фільтри і досьє вже є в API."
        planned={[
          {
            id: 'S1-03',
            title: 'Список із фільтрами по каналу, статусу, джерелу',
            api: 'GET /api/dashboard/subscribers',
            ready: true,
          },
          {
            id: 'S2-22',
            title: 'Картка: джерело, якість атрибуції, історія циклів',
            api: 'GET /api/dashboard/subscribers/:id',
            ready: true,
          },
          {
            id: 'S1-24',
            title: 'Експорт списку',
            api: 'GET /api/dashboard/subscribers/export.csv',
            ready: true,
          },
        ]}
      />
    </>
  );
}
