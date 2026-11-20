import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class ChannelService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  async create(workspaceId: string, data: { telegramChatId: string; title: string; username?: string }) {
    return this.prisma.channel.create({
      data: { workspaceId, ...data },
    });
  }

  async list(workspaceId: string) {
    return this.prisma.channel.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: {
            membershipEvents: true,
            clickEvents: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Лише в межах свого кабінету — раніше канал можна було прочитати за чужим id. */
  async getById(id: string, workspaceId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, workspaceId },
      include: {
        campaigns: true,
        _count: {
          select: {
            membershipEvents: true,
            clickEvents: true,
            unsubscribeEvents: true,
          },
        },
      },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  /**
   * S2-14 / S2-15: налаштування вступу через заявки. Автосхвалення має сенс
   * лише для каналу з заявками, тому вимкнення заявок вимикає і його.
   */
  async updateJoinRequestSettings(
    workspaceId: string,
    id: string,
    data: { joinRequestsEnabled?: boolean; autoApproveJoinRequests?: boolean },
  ) {
    const channel = await this.prisma.channel.findFirst({ where: { id, workspaceId } });
    if (!channel) throw new NotFoundException('Channel not found');

    const joinRequestsEnabled = data.joinRequestsEnabled ?? channel.joinRequestsEnabled;
    const autoApproveJoinRequests =
      joinRequestsEnabled && (data.autoApproveJoinRequests ?? channel.autoApproveJoinRequests);

    if (autoApproveJoinRequests && !channel.botCanInviteUsers) {
      throw new BadRequestException(
        'Щоб схвалювати заявки автоматично, дайте боту право «Додавання учасників» і натисніть «Перевірити».',
      );
    }

    return this.prisma.channel.update({
      where: { id },
      data: { joinRequestsEnabled, autoApproveJoinRequests },
    });
  }

  async syncFromTelegram(workspaceId: string, username: string) {
    try {
      const channel = await this.telegram.syncChannelByIdentifier(workspaceId, username);
      const status = await this.telegram.getBotPermissions(channel.telegramChatId);
      return { ...channel, botPermissions: status };
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Sync failed';
      if (/chat not found/i.test(raw)) {
        throw new BadRequestException(
          'Канал не знайдено. Якщо канал приватний (без @username) — введіть chat id, наприклад -1003751054664. Назва каналу (tets) не підходить.',
        );
      }
      if (/bot is not admin/i.test(raw)) {
        throw new BadRequestException('Бот не є адміном цього каналу');
      }
      throw new BadRequestException(raw);
    }
  }

  /**
   * Архівація каналу — isActive=false, дані нікуди не діваються. Аналог
   * setActive у tracking.service.ts: використовуйте це, а не deleteChannel,
   * якщо по каналу вже є кампанії/кліки/підписники.
   */
  async setActive(workspaceId: string, id: string, isActive: boolean) {
    const channel = await this.prisma.channel.findFirst({ where: { id, workspaceId } });
    if (!channel) throw new NotFoundException('Channel not found');

    return this.prisma.channel.update({ where: { id }, data: { isActive } });
  }

  /**
   * Фізичне видалення каналу. Майже всі пов'язані таблиці (campaigns,
   * trackingLinks, clickEvents, membershipEvents, inviteLinks, subscriberProfiles,
   * leadMagnets, ...) мають onDelete: Cascade на channelId — видалення каналу з
   * будь-якими накопиченими даними знищило б їх безповоротно. Дозволяємо DELETE
   * лише для порожнього каналу (щойно доданого помилково); інакше — архівувати.
   */
  async deleteChannel(workspaceId: string, id: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, workspaceId },
      include: {
        _count: {
          select: {
            campaigns: true,
            trackingLinks: true,
            clickEvents: true,
            membershipEvents: true,
            inviteLinks: true,
            subscriberProfiles: true,
            leadMagnets: true,
          },
        },
      },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    const total = Object.values(channel._count).reduce((sum, n) => sum + n, 0);
    if (total > 0) {
      throw new BadRequestException(
        'По цьому каналу вже є кампанії або статистика — видалення знищило б їх назавжди. Заархівуйте канал замість видалення.',
      );
    }

    await this.prisma.channel.delete({ where: { id } });
  }

  async getBotStatus(channelId: string, workspaceId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspaceId },
    });
    if (!channel) throw new BadRequestException('Channel not found');

    const permissions = await this.telegram.getBotPermissions(channel.telegramChatId);
    // Час перевірки має оновлюватись навіть коли права не змінилися — інакше
    // екран інтеграції показував би стару дату після успішної діагностики.
    await this.prisma.channel.update({
      where: { id: channel.id },
      data: {
        botIsAdmin: permissions.isAdmin,
        botCanInviteUsers: permissions.canInviteUsers,
        botStatusCheckedAt: new Date(),
      },
    });
    return { channelId: channel.id, title: channel.title, ...permissions };
  }

  /**
   * S2-16: швидкий зведений стан без зовнішніх викликів. Живу перевірку
   * Telegram робимо лише на явну дію користувача в runDiagnostics().
   */
  async getIntegrationStatus(workspaceId: string) {
    const [channels, activeLinks, revokedInviteLinks, lastClick, integrations] = await Promise.all([
      this.prisma.channel.findMany({
        where: { workspaceId },
        select: {
          id: true,
          isActive: true,
          botIsAdmin: true,
          botCanInviteUsers: true,
          botStatusCheckedAt: true,
        },
      }),
      this.prisma.trackingLink.count({
        where: { workspaceId, isActive: true, channel: { isActive: true } },
      }),
      this.prisma.inviteLink.count({
        where: { workspaceId, source: 'STANDALONE', isRevoked: true },
      }),
      this.prisma.clickEvent.findFirst({
        where: { workspaceId },
        select: { clickedAt: true },
        orderBy: { clickedAt: 'desc' },
      }),
      Promise.all([
        this.prisma.metaIntegration.count({ where: { workspaceId, isActive: true } }),
        this.prisma.gA4Integration.count({ where: { workspaceId, isActive: true } }),
        this.prisma.googleAdsIntegration.count({ where: { workspaceId, isActive: true } }),
        this.prisma.tikTokIntegration.count({ where: { workspaceId, isActive: true } }),
      ]),
    ]);

    const activeChannels = channels.filter((channel) => channel.isActive);
    const readyChannels = activeChannels.filter(
      (channel) => channel.botIsAdmin && channel.botCanInviteUsers,
    );
    const attentionChannels = activeChannels.length - readyChannels.length;
    const connectedAds = ['Meta', 'GA4', 'Google Ads', 'TikTok'].filter(
      (_, index) => integrations[index] > 0,
    );

    let overall: 'working' | 'attention' | 'not-configured' = 'working';
    if (activeChannels.length === 0 || activeLinks === 0) overall = 'not-configured';
    else if (attentionChannels > 0 || revokedInviteLinks > 0) overall = 'attention';

    return {
      overall,
      channels: {
        total: channels.length,
        active: activeChannels.length,
        ready: readyChannels.length,
        attention: attentionChannels,
        lastCheckedAt: channels
          .map((channel) => channel.botStatusCheckedAt)
          .filter((value): value is Date => Boolean(value))
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
      },
      tracking: {
        activeLinks,
        revokedInviteLinks,
        lastClickAt: lastClick?.clickedAt ?? null,
        mechanism: 'tracking-links' as const,
      },
      ads: { connected: connectedAds },
    };
  }

  /** S2-17: повна діагностика доступів і посилань за кнопкою. */
  async runDiagnostics(workspaceId: string) {
    const channels = await this.prisma.channel.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });

    const checks: Array<{
      id: string;
      label: string;
      status: 'ok' | 'warning' | 'error' | 'info';
      detail: string;
      actionHref?: string;
    }> = [];

    if (channels.length === 0) {
      checks.push({
        id: 'channels',
        label: 'Канали',
        status: 'error',
        detail: 'Немає активного каналу — збір підписок і відписок не працює.',
        actionHref: '/v2/channels',
      });
    } else {
      for (const channel of channels) {
        try {
          const result = await this.getBotStatus(channel.id, workspaceId);
          checks.push({
            id: `channel-${channel.id}`,
            label: channel.title,
            status: result.ready ? 'ok' : 'error',
            detail: result.ready
              ? 'Бот має потрібні права, підписки та точні джерела фіксуються.'
              : result.issues.join(' ') || 'Перевірте права бота в Telegram.',
            actionHref: result.ready ? undefined : '/v2/channels',
          });
        } catch {
          checks.push({
            id: `channel-${channel.id}`,
            label: channel.title,
            status: 'error',
            detail: 'Telegram не відповів на перевірку. Повторіть діагностику пізніше.',
            actionHref: '/v2/channels',
          });
        }
      }
    }

    const [activeLinks, brokenLinks, revokedInviteLinks, integrations] = await Promise.all([
      this.prisma.trackingLink.count({
        where: { workspaceId, isActive: true, channel: { isActive: true } },
      }),
      this.prisma.trackingLink.count({
        where: { workspaceId, isActive: true, channel: { isActive: false } },
      }),
      this.prisma.inviteLink.count({
        where: { workspaceId, source: 'STANDALONE', isRevoked: true },
      }),
      Promise.all([
        this.prisma.metaIntegration.count({ where: { workspaceId, isActive: true } }),
        this.prisma.gA4Integration.count({ where: { workspaceId, isActive: true } }),
        this.prisma.googleAdsIntegration.count({ where: { workspaceId, isActive: true } }),
        this.prisma.tikTokIntegration.count({ where: { workspaceId, isActive: true } }),
      ]),
    ]);

    checks.push({
      id: 'tracking-links',
      label: 'Збір через посилання',
      status: brokenLinks > 0 ? 'error' : activeLinks > 0 ? 'ok' : 'warning',
      detail: brokenLinks > 0
        ? `${brokenLinks} активних посилань ведуть у відключені канали.`
        : activeLinks > 0
          ? `${activeLinks} активних посилань готові фіксувати кліки. Окремий сайт-скрипт не потрібен.`
          : 'Немає активних tracking-посилань — створіть перше перед запуском трафіку.',
      actionHref: brokenLinks > 0 || activeLinks === 0 ? '/v2/links' : undefined,
    });

    if (revokedInviteLinks > 0) {
      checks.push({
        id: 'invite-links',
        label: 'Запрошувальні посилання',
        status: 'warning',
        detail: `${revokedInviteLinks} посилань відкликано в Telegram. Історія збережена, але новий трафік ними не пройде.`,
        actionHref: '/v2/links',
      });
    } else {
      checks.push({
        id: 'invite-links',
        label: 'Запрошувальні посилання',
        status: 'ok',
        detail: 'Відкликаних активних джерел не знайдено.',
      });
    }

    const adNames = ['Meta', 'GA4', 'Google Ads', 'TikTok'].filter(
      (_, index) => integrations[index] > 0,
    );
    checks.push({
      id: 'ads',
      label: 'Рекламні інтеграції',
      status: adNames.length > 0 ? 'ok' : 'info',
      detail: adNames.length > 0
        ? `Підключено: ${adNames.join(', ')}.`
        : 'Не підключені. Це не заважає аналітиці каналів, але події не передаються в рекламні кабінети.',
    });

    const overall = checks.some((check) => check.status === 'error')
      ? 'error'
      : checks.some((check) => check.status === 'warning')
        ? 'attention'
        : 'working';

    return { overall, checkedAt: new Date(), checks };
  }
}
