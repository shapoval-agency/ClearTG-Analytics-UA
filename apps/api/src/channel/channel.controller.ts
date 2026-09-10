import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { IsOptional, IsString } from 'class-validator';
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

@Controller('api/channels')
export class ChannelController {
  constructor(private channel: ChannelService) {}

  @RequiresWorkspace()
  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.channel.list(workspaceId);
  }

  @RequiresWorkspace()
  @Get(':id/bot-status')
  botStatus(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.channel.getBotStatus(id, workspaceId);
  }

  @RequiresWorkspace()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.channel.getById(id);
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
