import { PageHeader, LoadingState } from '@/components/v2/ui';

export default function V2AdsLoading() {
  return (
    <>
      <PageHeader title="Реклама" description="Передаємо в рекламні кабінети справжніх підписників, щоб реклама вчилась на них." />
      <LoadingState label="Завантажуємо рекламні підключення…" />
    </>
  );
}
