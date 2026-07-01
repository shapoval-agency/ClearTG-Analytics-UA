import { Injectable, BadRequestException } from '@nestjs/common';
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
    if (process.env.STAGING_MODE !== 'true') {
      throw new BadRequestException('Sync only available in staging mode');
    }
    try {
      return await this.telegram.syncChannelByIdentifier(workspaceId, username);
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
}
