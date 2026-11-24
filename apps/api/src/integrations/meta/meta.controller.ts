import { Controller, Get, Post, Body } from '@nestjs/common';
import { MetaService } from './meta.service';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
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

class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
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

  /** S3-05: перевірка до запуску. */
  @RequiresWorkspace()
  @Post('verify')
  verify(@WorkspaceId() workspaceId: string) {
    return this.meta.verify(workspaceId);
  }

  /** Увімкнути / вимкнути відправку (вмикається лише після перевірки). */
  @RequiresWorkspace()
  @Post('active')
  setActive(@Body() dto: SetActiveDto, @WorkspaceId() workspaceId: string) {
    return this.meta.setActive(workspaceId, dto.isActive);
  }

  @RequiresWorkspace()
  @Post('test-event')
  testEvent(@WorkspaceId() workspaceId: string) {
    return this.meta.sendTestEvent(workspaceId);
  }
}
