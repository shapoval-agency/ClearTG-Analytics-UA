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

  async getById(id: string) {
    return this.prisma.channel.findUnique({
      where: { id },
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
    if (permissions.isAdmin !== channel.botIsAdmin) {
      await this.prisma.channel.update({
        where: { id: channel.id },
        data: { botIsAdmin: permissions.isAdmin },
      });
    }
    return { channelId: channel.id, title: channel.title, ...permissions };
  }
}
