import { Controller, Get, Post, Body } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';

class DataDeletionDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telegramUserId?: string;
  @IsOptional() @IsString() reason?: string;
}

@Controller('api/privacy')
export class PrivacyController {
  constructor(private prisma: PrismaService) {}

  @RequiresWorkspace()
  @Post('data-deletion')
  requestDeletion(
    @Body() dto: DataDeletionDto,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.prisma.dataDeletionRequest.create({
      data: {
        workspaceId,
        userId: user.id,
        email: dto.email,
        telegramUserId: dto.telegramUserId,
        reason: dto.reason,
      },
    });
  }

  @RequiresWorkspace()
  @Get('consent-log')
  consentLog(@WorkspaceId() workspaceId: string) {
    return this.prisma.consentEvent.findMany({
      where: { workspaceId },
      orderBy: { recordedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        source: true,
        consentData: true,
        recordedAt: true,
      },
    });
  }
}
