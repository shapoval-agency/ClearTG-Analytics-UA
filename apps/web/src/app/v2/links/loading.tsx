import { PageHeader, LoadingState } from '@/components/v2/ui';

export default function V2LinksLoading() {
  return (
    <>
      <PageHeader
        title="Посилання"
        description="Створіть посилання під конкретне джерело — і у звітах буде видно, звідки прийшов кожен підписник."
      />
      <LoadingState label="Завантажуємо посилання…" />
    </>
  );
}
