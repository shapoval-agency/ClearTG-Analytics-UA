import { Body, Controller, Get, Put } from '@nestjs/common';
import { TelegramDigestFrequency } from '@cleartg/database';
import { IsArray, IsBoolean, IsEnum, IsInt, IsString, Max, Min } from 'class-validator';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { CurrentUser, WorkspaceId } from '../common/decorators/user.decorator';
import { BotAdminService } from './bot-admin.service';

class UpdateDigestSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsEnum(TelegramDigestFrequency)
  frequency!: TelegramDigestFrequency;

  @IsInt()
  @Min(0)
  @Max(23)
  hour!: number;

  @IsArray()
  @IsString({ each: true })
  channelIds!: string[];
}

@Controller('api/telegram/digest-settings')
export class TelegramSettingsController {
  constructor(private botAdmin: BotAdminService) {}

  @RequiresWorkspace()
  @Get()
  getSettings(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.botAdmin.getDigestSettings(workspaceId, user.id);
  }

  @RequiresWorkspace()
  @Put()
  updateSettings(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateDigestSettingsDto,
  ) {
    return this.botAdmin.updateDigestSettings(workspaceId, user.id, dto);
  }
}
