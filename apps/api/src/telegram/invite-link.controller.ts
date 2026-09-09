import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { InviteLinkService } from './invite-link.service';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';

class CreateStandaloneInviteLinkDto {
  @IsString()
  channelId!: string;

  @IsString()
  campaignId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;
}

/**
 * Тип 2 з ТЗ: самостійні (не per-click) запрошувальні посилання виду
 * t.me/+код — окремо від tracking-посилань (`api/tracking-links`), бо
 * можливості принципово інші (без UTM, без конкретного поста, зате
 * стовідсоткова точність джерела від самого Telegram).
 */
@Controller('api/invite-links')
export class InviteLinkController {
  constructor(private inviteLinks: InviteLinkService) {}

  @RequiresWorkspace()
  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.inviteLinks.listStandalone(workspaceId);
  }

  @RequiresWorkspace()
  @Post()
  create(@Body() dto: CreateStandaloneInviteLinkDto, @WorkspaceId() workspaceId: string) {
    return this.inviteLinks.createStandalone({ workspaceId, ...dto });
  }

  @RequiresWorkspace()
  @Patch(':id/revoke')
  revoke(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.inviteLinks.revokeStandalone(workspaceId, id);
  }
}
