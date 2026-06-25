import { Controller, Get, Post, Body } from '@nestjs/common';
import { TikTokService } from './tiktok.service';
import { RequiresWorkspace } from '../../common/decorators/auth.decorator';
import { WorkspaceId } from '../../common/decorators/user.decorator';
import { IsOptional, IsString } from 'class-validator';

class UpsertTikTokDto {
  @IsString()
  pixelId!: string;

  @IsString()
  accessToken!: string;

  @IsOptional()
  @IsString()
  testEventCode?: string;
}

@Controller('api/integrations/tiktok')
export class TikTokController {
  constructor(private tiktok: TikTokService) {}

  @RequiresWorkspace()
  @Get()
  get(@WorkspaceId() workspaceId: string) {
    return this.tiktok.getIntegration(workspaceId);
  }

  @RequiresWorkspace()
  @Post()
  upsert(@Body() dto: UpsertTikTokDto, @WorkspaceId() workspaceId: string) {
    return this.tiktok.upsertIntegration(workspaceId, dto);
  }

  @RequiresWorkspace()
  @Post('test-event')
  testEvent(@WorkspaceId() workspaceId: string) {
    return this.tiktok.sendTestEvent(workspaceId);
  }
}
