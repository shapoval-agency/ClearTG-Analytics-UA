import { Controller, Get } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';

@Controller('api/audit-log')
export class AuditController {
  constructor(private audit: AuditService) {}

  @RequiresWorkspace()
  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.audit.list(workspaceId);
  }
}
