import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChannelService {
  constructor(private prisma: PrismaService) {}

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
}
