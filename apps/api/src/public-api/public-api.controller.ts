import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Public, RequiresWorkspace } from '../common/decorators/auth.decorator';
import { CurrentUser, WorkspaceId, type AuthUser } from '../common/decorators/user.decorator';
import { PublicApiService } from './public-api.service';
import { ApiKeyGuard } from './api-key.guard';
import { parseLookupQuery } from './public-api';

class CreateApiKeyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;
}

class SourceQueryDto {
  @IsOptional() @IsString() @MaxLength(40)
  telegram_user_id?: string;

  @IsOptional() @IsString() @MaxLength(40)
  username?: string;

  @IsOptional() @IsString() @MaxLength(40)
  channel_id?: string;
}

/** S4-13: ключі API в кабінеті. */
@Controller('api/api-keys')
@RequiresWorkspace()
export class ApiKeyController {
  constructor(private service: PublicApiService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.service.list(workspaceId);
  }

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: { workspaceRole?: string },
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.service.create(workspaceId, user.id, req.workspaceRole, dto.name);
  }

  @Delete(':id')
  revoke(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: { workspaceRole?: string },
    @Param('id') id: string,
  ) {
    return this.service.revoke(workspaceId, user.id, req.workspaceRole, id);
  }
}

/** S4-12: публічний API для CRM і розробників клієнта. */
@Controller('api/v1')
@Public()
@UseGuards(ApiKeyGuard)
export class PublicApiV1Controller {
  constructor(private service: PublicApiService) {}

  @Get('source')
  source(@WorkspaceId() workspaceId: string, @Query() query: SourceQueryDto) {
    const parsed = parseLookupQuery(query);
    if ('error' in parsed) throw new BadRequestException(parsed.error);
    return this.service.lookupSource(workspaceId, parsed, query.channel_id?.trim() || undefined);
  }
}
