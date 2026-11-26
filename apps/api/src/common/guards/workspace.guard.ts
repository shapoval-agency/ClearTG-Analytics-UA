import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { isPlatformAdminEmail, isReadOnlyMethod, PLATFORM_ADMIN_READ_ONLY_MESSAGE } from './platform-admin';
import { REQUIRES_WORKSPACE_KEY } from '../decorators/auth.decorator';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresWorkspace = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_WORKSPACE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiresWorkspace) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { id: string; email?: string } | undefined;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const workspaceId = request.headers['x-workspace-id'] as string | undefined;
    if (!workspaceId) {
      throw new ForbiddenException('x-workspace-id header required');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: user.id },
      },
    });

    if (!membership) {
      // Адміністратор платформи бачить будь-який кабінет, але лише в режимі перегляду.
      if (isPlatformAdminEmail(user.email, this.config.get<string>('AGENCY_ADMIN_EMAIL'))) {
        const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
        if (!workspace) throw new ForbiddenException('Workspace not found');
        if (!isReadOnlyMethod(request.method)) {
          throw new ForbiddenException(PLATFORM_ADMIN_READ_ONLY_MESSAGE);
        }
        request.workspaceId = workspaceId;
        request.workspaceRole = 'PLATFORM_ADMIN_VIEW';
        request.platformAdminView = true;
        return true;
      }
      throw new ForbiddenException('Not a member of this workspace');
    }

    request.workspaceId = workspaceId;
    request.workspaceRole = membership.role;
    return true;
  }
}
