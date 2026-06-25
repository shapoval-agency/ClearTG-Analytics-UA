import { Controller, Get, Post, Body } from '@nestjs/common';
import { GA4Service } from './ga4.service';
import { IsOptional, IsString } from 'class-validator';
import { RequiresWorkspace } from '../../common/decorators/auth.decorator';
import { WorkspaceId } from '../../common/decorators/user.decorator';

class UpsertGA4Dto {
  @IsString()
  measurementId!: string;

  @IsString()
  apiSecret!: string;

  @IsOptional()
  @IsString()
  streamId?: string;
}

@Controller('api/integrations/ga4')
export class GA4Controller {
  constructor(private ga4: GA4Service) {}

  @RequiresWorkspace()
  @Get()
  get(@WorkspaceId() workspaceId: string) {
    return this.ga4.getIntegration(workspaceId);
  }

  @RequiresWorkspace()
  @Post()
  upsert(@Body() dto: UpsertGA4Dto, @WorkspaceId() workspaceId: string) {
    return this.ga4.upsertIntegration(workspaceId, dto);
  }

  @RequiresWorkspace()
  @Post('test-event')
  testEvent(@WorkspaceId() workspaceId: string) {
    return this.ga4.sendTestEvent(workspaceId);
  }
}
