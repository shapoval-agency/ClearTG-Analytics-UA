import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';

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
}
