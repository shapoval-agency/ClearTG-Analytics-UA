import { Badge } from '@/components/v2/ui';
import { ChannelActions } from './ChannelActions';
import { deriveChannelStatus } from './channel-status';

export interface ChannelListItem {
  id: string;
  title: string;
  username: string | null;
  isActive: boolean;
  botIsAdmin: boolean;
  _count: { membershipEvents: number; clickEvents: number };
}

/**
 * Картка каналу.
 *
 * Показує назву, стан, що це означає, основну дію і трохи контексту.
 * Свідомо не показує: внутрішній id, telegramChatId, сирі поля isActive /
 * botIsAdmin, дати створення. Це технічні деталі, які нічого не додають
 * до відповіді на питання «працює чи ні і що робити».
 */
export function ChannelCard({ channel }: { channel: ChannelListItem }) {
  const view = deriveChannelStatus(channel);

  return (
    <article className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-slate-900 truncate">{channel.title}</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {channel.username ? `@${channel.username}` : 'приватний канал'}
          </p>
        </div>
        <Badge tone={view.tone}>{view.label}</Badge>
      </div>

      <p className="text-sm text-slate-600 mt-3">{view.meaning}</p>

      {channel.isActive && !channel.botIsAdmin && (
        <ol className="mt-3 space-y-1 text-sm text-amber-700">
          <li>1. Відкрийте канал у Telegram → Адміністратори</li>
          <li>2. Додайте нашого бота адміністратором</li>
          <li>3. Увімкніть право «Додавання учасників»</li>
        </ol>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-slate-400">
        <span>{channel._count.clickEvents} кліків</span>
        <span>{channel._count.membershipEvents} подій підписки</span>
      </div>

      <ChannelActions
        id={channel.id}
        title={channel.title}
        isActive={channel.isActive}
      />
    </article>
  );
}
