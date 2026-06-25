import { Controller, Get, Post, Body } from '@nestjs/common';
import { LeadMagnetService } from './lead-magnet.service';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

class CreateLeadMagnetDto {
  @IsString()
  channelId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  contentUrl?: string;

  @IsString()
  @MinLength(10)
  consentText!: string;
}

@Controller('api/lead-magnets')
export class LeadMagnetController {
  constructor(private leadMagnet: LeadMagnetService) {}

  @RequiresWorkspace()
  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.leadMagnet.list(workspaceId);
  }

  @RequiresWorkspace()
  @Post()
  async create(@Body() dto: CreateLeadMagnetDto, @WorkspaceId() workspaceId: string) {
    const item = await this.leadMagnet.create(workspaceId, dto);
    const botLink = await this.leadMagnet.getBotLink(item.slug);
    return { ...item, botLink };
  }
}
