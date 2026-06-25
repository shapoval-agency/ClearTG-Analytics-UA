import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { AdPlatform, SpendModel, TargetEvent } from '@cleartg/database';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';

class CreateCampaignDto {
  @IsString()
  channelId!: string;

  @IsString()
  name!: string;

  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() medium?: string;
  @IsOptional() @IsString() creative?: string;
  @IsOptional() @IsEnum(AdPlatform) adPlatform?: AdPlatform;
  @IsOptional() @IsEnum(SpendModel) spendModel?: SpendModel;
  @IsOptional() @IsNumber() spendAmount?: number;
  @IsOptional() @IsNumber() attributionWindowMinutes?: number;
  @IsOptional() @IsEnum(TargetEvent) targetEvent?: TargetEvent;
}

@Controller('api/campaigns')
export class CampaignController {
  constructor(private campaign: CampaignService) {}

  @RequiresWorkspace()
  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.campaign.list(workspaceId);
  }

  @RequiresWorkspace()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.campaign.getById(id);
  }

  @RequiresWorkspace()
  @Post()
  create(@Body() dto: CreateCampaignDto, @WorkspaceId() workspaceId: string) {
    return this.campaign.create(workspaceId, dto);
  }
}
