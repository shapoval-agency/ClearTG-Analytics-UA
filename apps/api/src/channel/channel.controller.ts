import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';

class CreateChannelDto {
  @IsString()
  telegramChatId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  username?: string;
}

class SyncChannelDto {
  @IsString()
  username!: string;
}

class JoinRequestSettingsDto {
  @IsOptional()
  @IsBoolean()
  joinRequestsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoApproveJoinRequests?: boolean;
}

@Controller('api/channels')
export class ChannelController {
  constructor(private channel: ChannelService) {}

  @RequiresWorkspace()
  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.channel.list(workspaceId);
  }

  @RequiresWorkspace()
  @Get('integration-status')
  integrationStatus(@WorkspaceId() workspaceId: string) {
    return this.channel.getIntegrationStatus(workspaceId);
  }

  @RequiresWorkspace()
  @Post('diagnostics')
  diagnostics(@WorkspaceId() workspaceId: string) {
    return this.channel.runDiagnostics(workspaceId);
  }

  @RequiresWorkspace()
  @Get(':id/bot-status')
  botStatus(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.channel.getBotStatus(id, workspaceId);
  }

  @RequiresWorkspace()
  @Get(':id')
  get(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.channel.getById(id, workspaceId);
  }

  @RequiresWorkspace()
  @Post()
  create(@Body() dto: CreateChannelDto, @WorkspaceId() workspaceId: string) {
    return this.channel.create(workspaceId, dto);
  }

  @RequiresWorkspace()
  @Post('sync-telegram')
  sync(@Body() dto: SyncChannelDto, @WorkspaceId() workspaceId: string) {
    return this.channel.syncFromTelegram(workspaceId, dto.username);
  }

  /** S2-14 / S2-15: канал із заявками та автосхвалення. */
  @RequiresWorkspace()
  @Patch(':id/join-requests')
  joinRequests(
    @Param('id') id: string,
    @Body() dto: JoinRequestSettingsDto,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.channel.updateJoinRequestSettings(workspaceId, id, dto);
  }

  @RequiresWorkspace()
  @Patch(':id/archive')
  archive(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.channel.setActive(workspaceId, id, false);
  }

  @RequiresWorkspace()
  @Patch(':id/activate')
  activate(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.channel.setActive(workspaceId, id, true);
  }

  @RequiresWorkspace()
  @Delete(':id')
  delete(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.channel.deleteChannel(workspaceId, id);
  }
}
