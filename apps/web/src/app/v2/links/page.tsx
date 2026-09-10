import { PageHeader, ModulePlaceholder } from '@/components/v2/ui';

export const dynamic = 'force-dynamic';

/**
 * Посилання — каркас.
 *
 * У старому кабінеті створення розкидане по двох формах
 * (CreateTrackingLinkForm і CreateSeedInviteLinkForm). У новому — один
 * конструктор із вибором типу посилання.
 *
 * Кнопки видалення тут свідомо не буде: на TrackingLink стоїть
 * onDelete: Cascade — видалення знищує кліки, інвайти та атрибуції.
 * Основна дія — архівація.
 */
export default function V2LinksPage() {
  return (
    <>
      <PageHeader
        title="Посилання"
        description="Створення посилання під конкретне джерело — так, щоб історія не губилася при змінах."
      />

      <ModulePlaceholder
        summary="Усі потрібні ендпоінти вже існують. Заново робиться лише конструктор: одна форма замість двох."
        planned={[
          {
            id: 'S1-19',
            title: 'Єдиний конструктор: канал → тип → мітки',
            api: 'POST /api/tracking-links',
            ready: true,
          },
          {
            id: 'S1-06',
            title: 'Звичайне t.me-посилання — чесний unknown',
            api: '—',
            ready: true,
          },
          {
            id: 'S1-07',
            title: 'Invite-посилання під джерело (посів)',
            api: 'POST /api/invite-links',
            ready: true,
          },
          {
            id: 'S1-08',
            title: 'Трекінгове посилання сервісу',
            api: 'GET /l/:slug · /r/:slug',
            ready: true,
          },
          {
            id: 'S1-13',
            title: 'UTM і мітка креативу',
            api: 'POST /api/tracking-links',
            ready: true,
          },
          {
            id: 'S1-20',
            title: 'Список із фільтрами і пошуком',
            api: 'GET /api/tracking-links',
            ready: true,
          },
          {
            id: 'S2-08',
            title: 'Архівація (без кнопки видалення)',
            api: 'PATCH /api/tracking-links/:id/archive',
            ready: true,
          },
        ]}
      />
    </>
  );
}
