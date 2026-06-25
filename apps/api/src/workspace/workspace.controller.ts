import { Controller, Get, Post, Body, Param, ForbiddenException } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/user.decorator';

class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

@Controller('api/workspaces')
export class WorkspaceController {
  constructor(private workspace: WorkspaceService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.workspace.listForUser(user.id);
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
