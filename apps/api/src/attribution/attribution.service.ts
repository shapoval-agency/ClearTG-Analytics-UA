import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { attributeSubscription, confidenceLabel } from '@cleartg/shared';
import { AttributionType } from '@cleartg/database';

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

  async getAttributionStats(workspaceId: string) {
    const attributions = await this.prisma.attribution.groupBy({
      by: ['attributionType'],
      where: { workspaceId },
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
