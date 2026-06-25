import { Controller, Get, Post, Body } from '@nestjs/common';
import { MetaService } from './meta.service';
import { IsOptional, IsString } from 'class-validator';
import { RequiresWorkspace } from '../../common/decorators/auth.decorator';
import { WorkspaceId } from '../../common/decorators/user.decorator';

class UpsertMetaDto {
  @IsString()
  pixelId!: string;

  @IsString()
  accessToken!: string;

  @IsOptional()
  @IsString()
  testEventCode?: string;
}

@Controller('api/integrations/meta')
export class MetaController {
  constructor(private meta: MetaService) {}

  @RequiresWorkspace()
  @Get()
  get(@WorkspaceId() workspaceId: string) {
    return this.meta.getIntegration(workspaceId);
  }

  @RequiresWorkspace()
  @Post()
  upsert(@Body() dto: UpsertMetaDto, @WorkspaceId() workspaceId: string) {
    return this.meta.upsertIntegration(workspaceId, dto);
  }

  @RequiresWorkspace()
  @Post('test-event')
  testEvent(@WorkspaceId() workspaceId: string) {
    return this.meta.sendTestEvent(workspaceId);
  }
}
