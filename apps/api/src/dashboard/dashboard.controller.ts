import { Controller, Get, Header, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';

type Reply = { header(name: string, value: string): unknown; send(body: string): unknown };

@Controller('api/dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @RequiresWorkspace()
  @Get('overview')
  overview(@WorkspaceId() workspaceId: string) {
    return this.dashboard.getOverview(workspaceId);
  }

  @RequiresWorkspace()
  @Get('pixel-delivery')
  pixelDelivery(@WorkspaceId() workspaceId: string) {
    return this.dashboard.getPixelDelivery(workspaceId);
  }

  @RequiresWorkspace()
  @Get('campaigns')
  campaignReports(@WorkspaceId() workspaceId: string) {
    return this.dashboard.getCampaignReports(workspaceId);
  }

  @RequiresWorkspace()
  @Get('tracking-links')
  trackingLinkReports(@WorkspaceId() workspaceId: string) {
    return this.dashboard.getTrackingLinkReports(workspaceId);
  }

  @RequiresWorkspace()
  @Get('subscribers')
  subscriberFeed(@WorkspaceId() workspaceId: string) {
    return this.dashboard.getSubscriberFeed(workspaceId);
  }

  @RequiresWorkspace()
  @Get('subscribers/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportSubscribers(
    @WorkspaceId() workspaceId: string,
    @Res({ passthrough: true }) reply: Reply,
  ) {
    const csv = await this.dashboard.exportSubscribersCsv(workspaceId);
    reply.header('Content-Disposition', 'attachment; filename="subscribers.csv"');
    return csv;
  }

  @RequiresWorkspace()
  @Get('subscribers/:id')
  async subscriberDossier(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    const dossier = await this.dashboard.getSubscriberDossier(workspaceId, id);
    if (!dossier) throw new NotFoundException('Subscriber not found');
    return dossier;
  }

  @RequiresWorkspace()
  @Get('unsubscribes')
  unsubscribeFeed(@WorkspaceId() workspaceId: string) {
    return this.dashboard.getUnsubscribeFeed(workspaceId);
  }

  @RequiresWorkspace()
  @Get('bot-starts')
  botStartFeed(@WorkspaceId() workspaceId: string) {
    return this.dashboard.getBotStartFeed(workspaceId);
  }

  @RequiresWorkspace()
  @Get('daily-digest')
  dailyDigest(
    @WorkspaceId() workspaceId: string,
    @Query('date') date?: string,
  ) {
    return this.dashboard.getDailyDigest(workspaceId, date);
  }
}
