import { PageHeader, LoadingState } from '@/components/v2/ui';

export default function V2SubscribersLoading() {
  return (
    <>
      <PageHeader
        title="Учасники"
        description="Перевірка цифр на конкретній людині: звідки прийшла і що з нею було далі."
      />
      <LoadingState label="Завантажуємо учасників…" />
    </>
  );
}
