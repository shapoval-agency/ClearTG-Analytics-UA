import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';

@Controller('api/audit-log')
export class AuditController {
  constructor(private audit: AuditService) {}

  @RequiresWorkspace()
  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list(workspaceId, {
      action,
      entityType,
      dateFrom,
      dateTo,
      limit: limit ? Math.min(Number(limit) || 50, 1000) : undefined,
    });
  }
}
