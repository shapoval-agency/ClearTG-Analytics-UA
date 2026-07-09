import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdPlatform, SpendModel, TargetEvent } from '@cleartg/database';

@Injectable()
export class CampaignService {
  constructor(private prisma: PrismaService) {}

  async create(
    workspaceId: string,
    data: {
      channelId: string;
      name: string;
      source?: string;
      medium?: string;
      creative?: string;
      adPlatform?: AdPlatform;
      spendModel?: SpendModel;
      spendAmount?: number;
      attributionWindowMinutes?: number;
      conversionDelayMinutes?: number;
      targetEvent?: TargetEvent;
    },
  ) {
    return this.prisma.campaign.create({
      data: { workspaceId, ...data },
    });
  }

  async list(workspaceId: string) {
    return this.prisma.campaign.findMany({
      where: { workspaceId },
      include: {
        channel: { select: { id: true, title: true } },
        _count: { select: { clickEvents: true, trackingLinks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    return this.prisma.campaign.findUnique({
      where: { id },
      include: {
        channel: true,
        trackingLinks: true,
        _count: { select: { clickEvents: true, attributions: true } },
      },
    });
  }
}
