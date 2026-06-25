import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRES_WORKSPACE_KEY } from '../decorators/auth.decorator';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresWorkspace = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_WORKSPACE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiresWorkspace) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { id: string } | undefined;
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
      throw new ForbiddenException('Not a member of this workspace');
    }

    request.workspaceId = workspaceId;
    request.workspaceRole = membership.role;
    return true;
  }
}
