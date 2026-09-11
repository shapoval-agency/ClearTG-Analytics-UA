import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { attributeSubscription, confidenceLabel, kyivDateRange } from '@cleartg/shared';
import { AttributionType, Prisma } from '@cleartg/database';

@Injectable()
export class AttributionService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async attributeMembership(membershipEventId: string, inviteLinkId?: string | null) {
    const event = await this.prisma.membershipEvent.findUnique({
      where: { id: membershipEventId },
      include: { channel: true },
    });
    if (!event || event.eventType !== 'SUBSCRIBE') return null;

    const inviteRecord = inviteLinkId
      ? await this.prisma.inviteLink.findUnique({ where: { id: inviteLinkId } })
      : null;

    const campaign = inviteRecord?.campaignId
      ? await this.prisma.campaign.findUnique({ where: { id: inviteRecord.campaignId } })
      : await this.prisma.campaign.findFirst({
          where: { channelId: event.channelId, isActive: true },
          orderBy: { createdAt: 'desc' },
        });

    const windowMinutes = campaign?.attributionWindowMinutes ?? 10080;
    const windowStart = new Date(event.occurredAt.getTime() - windowMinutes * 60 * 1000);

    const recentClicks = await this.prisma.clickEvent.findMany({
      where: {
        channelId: event.channelId,
        clickedAt: { gte: windowStart, lte: event.occurredAt },
      },
      orderBy: { clickedAt: 'desc' },
      take: 50,
    });

    const inviteLinkUsed = inviteRecord
      ? {
          id: inviteRecord.id,
          clickEventId: inviteRecord.clickEventId,
          campaignId: inviteRecord.campaignId,
          trackingLinkId: inviteRecord.trackingLinkId,
          createdAt: inviteRecord.createdAt,
        }
      : null;

    const result = attributeSubscription({
      membershipEventId: event.id,
      channelId: event.channelId,
      subscribedAt: event.occurredAt,
      attributionWindowMinutes: windowMinutes,
      inviteLinkUsed,
      recentClicks: recentClicks.map((c) => ({
        id: c.id,
        campaignId: c.campaignId,
        trackingLinkId: c.trackingLinkId,
        clickedAt: c.clickedAt,
      })),
    });

    const attribution = await this.prisma.attribution.create({
      data: {
        workspaceId: event.workspaceId,
        channelId: event.channelId,
        membershipEventId: event.id,
        attributionType: result.attributionType as AttributionType,
        confidenceScore: result.confidenceScore,
        reason: result.reason,
        clickEventId: result.clickEventId,
        campaignId: result.campaignId,
        trackingLinkId: result.trackingLinkId,
        attributionWindowMinutes: result.attributionWindowMinutes,
      },
    });

    await this.audit.log({
      workspaceId: event.workspaceId,
      action: 'attribution_created',
      entityType: 'attribution',
      entityId: attribution.id,
      metadata: {
        type: result.attributionType,
        confidence: result.confidenceScore,
        confidenceLabel: confidenceLabel(result.confidenceScore),
      },
    });

    return attribution;
  }

  /**
   * `channelId`/`from`/`to` — той самий необов'язковий фільтр, що й у
   * DashboardService.getOverview(), який є єдиним викликачем цього методу.
   * Період фільтрується по `membershipEvent.occurredAt` (моменту самої
   * підписки), а не по `Attribution.createdAt` — узгоджено з тим, як
   * getOverview рахує `subscribers` за той самий проміжок. Без опцій
   * поведінка не змінюється.
   */
  async getAttributionStats(
    workspaceId: string,
    opts: { channelId?: string; from?: string; to?: string } = {},
  ) {
    const range = kyivDateRange(opts.from, opts.to);
    const where: Prisma.AttributionWhereInput = { workspaceId };
    if (opts.channelId) where.channelId = opts.channelId;
    if (range) where.membershipEvent = { occurredAt: range };

    const attributions = await this.prisma.attribution.groupBy({
      by: ['attributionType'],
      where,
      _count: true,
      _avg: { confidenceScore: true },
    });

    const total = attributions.reduce((sum, a) => sum + a._count, 0);

    return attributions.map((a) => ({
      type: a.attributionType,
      count: a._count,
      share: total > 0 ? a._count / total : 0,
      avgConfidence: a._avg.confidenceScore ?? 0,
      confidenceLabel: confidenceLabel(a._avg.confidenceScore ?? 0),
    }));
  }
}
