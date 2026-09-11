import { PageHeader, LoadingState } from '@/components/v2/ui';

export default function V2ReportsLoading() {
  return (
    <>
      <PageHeader
        title="Звіти"
        description="Яке джерело приводить підписників і наскільки добре воно працює."
      />
      <LoadingState label="Завантажуємо звіти…" />
    </>
  );
}
