import Link from 'next/link';
import { Card, Badge } from '@/components/v2/ui';
import { deriveChannelStatus } from '@/components/v2/channels/channel-status';
import type { ChannelListItem } from '@/components/v2/channels/ChannelCard';

/** Компактний список — назва, статус, стан підключення. Дії (архів/відновлення) лишаються в «Канали». */
export function ActiveChannelsBlock({ channels }: { channels: ChannelListItem[] }) {
  const previewChannels = channels.slice(0, 3);

  return (
    <Card title="Канали" hint={`${channels.length} підключено · стан збору даних у реальному часі`}>
      <ul className="divide-y divide-slate-100">
        {previewChannels.map((channel) => {
          const view = deriveChannelStatus(channel);
          return (
            <li key={channel.id} className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#102044]">{channel.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {channel._count.clickEvents} кліків · {channel._count.membershipEvents} подій
                </p>
              </div>
              <Badge tone={view.tone}>{view.label}</Badge>
            </li>
          );
        })}
      </ul>
      <Link href="/v2/channels" className="mt-4 inline-flex text-sm font-bold text-brand-600 hover:text-brand-700">
        Переглянути канали →
      </Link>
    </Card>
  );
}
