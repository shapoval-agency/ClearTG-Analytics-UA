import { Controller, Get, Post, Body, Param, ForbiddenException } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { IsString, MinLength, IsEmail, IsEnum, IsOptional } from 'class-validator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';
import { WorkspaceRole } from '@cleartg/database';

class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;
}

@Controller('api/workspaces')
export class WorkspaceController {
  constructor(private workspace: WorkspaceService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.workspace.listForUser(user.id);
  }

  @RequiresWorkspace()
  @Get('current/members')
  listMembers(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.workspace.listMembers(workspaceId, user.id);
  }

  @RequiresWorkspace()
  @Post('current/members')
  inviteMember(
    @WorkspaceId() workspaceId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.workspace.inviteMember(
      workspaceId,
      user.id,
      dto.email,
      dto.role ?? WorkspaceRole.MEMBER,
    );
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const ws = await this.workspace.findByIdForUser(id, user.id);
    if (!ws) throw new ForbiddenException('Workspace not found or access denied');
    return ws;
  }

  @Post()
  create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: { id: string }) {
    return this.workspace.create(dto.name, user.id);
  }
}
