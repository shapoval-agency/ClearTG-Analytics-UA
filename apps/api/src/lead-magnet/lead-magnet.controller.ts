import { BadRequestException, Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { LeadMagnetService } from './lead-magnet.service';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

class CreateLeadMagnetDto {
  @IsString()
  channelId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  contentUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3500)
  contentText?: string;

  /** Inline-кнопка Telegram — до 64 символів, тримаємо коротко. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  buttonText?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  consentText!: string;
}

class UpdateLeadMagnetDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  /** Порожній рядок — прибрати посилання. */
  @IsOptional() @IsString() @MaxLength(2000)
  contentUrl?: string;

  @IsOptional() @IsString() @MaxLength(3500)
  contentText?: string;

  @IsOptional() @IsString() @MaxLength(40)
  buttonText?: string;

  @IsOptional() @IsString() @MinLength(10) @MaxLength(1000)
  consentText?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

class PublishLeadMagnetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
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
  create(@Body() dto: CreateLeadMagnetDto, @WorkspaceId() workspaceId: string) {
    return this.leadMagnet.create(workspaceId, dto);
  }

  @RequiresWorkspace()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadMagnetDto, @WorkspaceId() workspaceId: string) {
    if (dto.contentUrl?.trim() && !/^https?:\/\/\S+$/i.test(dto.contentUrl.trim())) {
      throw new BadRequestException('Посилання на матеріал має починатися з https://');
    }
    return this.leadMagnet.update(workspaceId, id, dto);
  }

  @RequiresWorkspace()
  @Get(':id/stats')
  stats(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.leadMagnet.getStats(workspaceId, id);
  }

  @RequiresWorkspace()
  @Post(':id/publish')
  publish(@Param('id') id: string, @Body() dto: PublishLeadMagnetDto, @WorkspaceId() workspaceId: string) {
    return this.leadMagnet.publishToChannel(workspaceId, id, dto.text);
  }
}
