import { PageHeader, LoadingState } from '@/components/v2/ui';

export default function V2SubscriberDossierLoading() {
  return (
    <>
      <PageHeader title="Учасник" />
      <LoadingState label="Завантажуємо картку…" />
    </>
  );
}
