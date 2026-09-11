import Link from 'next/link';
import { Card, Badge } from '@/components/v2/ui';
import { deriveChannelStatus } from '@/components/v2/channels/channel-status';
import type { ChannelListItem } from '@/components/v2/channels/ChannelCard';

/** Компактний список — назва, статус, стан підключення. Дії (архів/відновлення) лишаються в «Канали». */
export function ActiveChannelsBlock({ channels }: { channels: ChannelListItem[] }) {
  return (
    <Card title="Канали" hint={`${channels.length} підключено`}>
      <ul className="space-y-2.5">
        {channels.map((channel) => {
          const view = deriveChannelStatus(channel);
          return (
            <li key={channel.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-800 truncate">{channel.title}</span>
              <Badge tone={view.tone}>{view.label}</Badge>
            </li>
          );
        })}
      </ul>
      <Link href="/v2/channels" className="block mt-3 text-sm text-brand-600 hover:underline">
        Усі канали →
      </Link>
    </Card>
  );
}
