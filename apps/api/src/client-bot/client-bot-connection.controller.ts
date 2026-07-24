import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { ClientBotConnectionService } from './client-bot-connection.service';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';

class ConnectClientBotDto {
  @IsString()
  @MinLength(20)
  token!: string;
}

@Controller('api/client-bots')
export class ClientBotConnectionController {
  constructor(private connections: ClientBotConnectionService) {}

  @RequiresWorkspace()
  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.connections.list(workspaceId);
  }

  @RequiresWorkspace()
  @Post()
  create(@Body() dto: ConnectClientBotDto, @WorkspaceId() workspaceId: string) {
    return this.connections.create(workspaceId, dto.token);
  }

  @RequiresWorkspace()
  @Delete(':id')
  remove(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.connections.remove(workspaceId, id);
  }
}
