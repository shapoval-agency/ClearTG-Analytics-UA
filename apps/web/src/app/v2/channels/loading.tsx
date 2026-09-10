import { PageHeader, LoadingState } from '@/components/v2/ui';

export default function V2ChannelsLoading() {
  return (
    <>
      <PageHeader
        title="Канали"
        description="Стан кожного каналу: чи фіксуються підписки і що зробити, якщо ні."
      />
      <LoadingState label="Завантажуємо канали…" />
    </>
  );
}
