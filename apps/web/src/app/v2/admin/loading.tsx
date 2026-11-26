import { PageHeader, LoadingState } from '@/components/v2/ui';

export default function V2AdminLoading() {
  return (
    <>
      <PageHeader title="Усі кабінети" description="Кабінети всіх клієнтів платформи." />
      <LoadingState label="Завантажуємо кабінети…" />
    </>
  );
}
