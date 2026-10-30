import { Badge } from '@/components/v2/ui';
import { TelegramLogo } from '@phosphor-icons/react/dist/ssr';
import { ChannelActions } from './ChannelActions';
import { deriveChannelStatus } from './channel-status';

export interface ChannelListItem {
  id: string;
  title: string;
  username: string | null;
  isActive: boolean;
  botIsAdmin: boolean;
  /** Старий production API не повертав це поле — відрізняємо unknown від false. */
  botCanInviteUsers?: boolean;
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
    <article className="rounded-[18px] border border-[#dbe4f0] bg-white p-4 shadow-[0_10px_34px_rgba(20,52,110,0.055)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <TelegramLogo size={23} weight="fill" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-[#102044]">{channel.title}</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {channel.username ? `@${channel.username}` : 'Приватний канал'}
            </p>
          </div>
        </div>
        <Badge tone={view.tone}>{view.label}</Badge>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{view.meaning}</p>

      {channel.isActive && (!channel.botIsAdmin || channel.botCanInviteUsers === false) && (
        <ol className="mt-3 space-y-1 text-sm text-amber-700">
          <li>1. Відкрийте канал у Telegram → Адміністратори</li>
          <li>2. Додайте нашого бота адміністратором</li>
          <li>3. Увімкніть право «Додавання учасників»</li>
        </ol>
      )}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-500">
        <span><strong className="text-[#102044]">{channel._count.clickEvents}</strong> кліків</span>
        <span><strong className="text-[#102044]">{channel._count.membershipEvents}</strong> подій підписки</span>
      </div>

      <ChannelActions
        id={channel.id}
        title={channel.title}
        isActive={channel.isActive}
      />
    </article>
  );
}
