import { WorkspaceRole } from '@cleartg/database';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateSlug } from '@cleartg/shared';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async create(name: string, ownerUserId: string) {
    const slug = generateSlug(8);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    return this.prisma.workspace.create({
      data: {
        name,
        slug,
        privacyPolicyUrl: `${appUrl}/privacy`,
        members: {
          create: { userId: ownerUserId, role: 'OWNER' },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
  }

  async findByIdForUser(id: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: id, userId } },
    });
    if (!membership) return null;

    return this.prisma.workspace.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, email: true, name: true } } } },
        _count: { select: { channels: true, campaigns: true, trackingLinks: true } },
      },
    });
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: { _count: { select: { channels: true, campaigns: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
    }));
  }

  async listMembers(workspaceId: string, actorUserId: string) {
    await this.assertCanManageMembers(workspaceId, actorUserId);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
    }));
  }

  async inviteMember(
    workspaceId: string,
    actorUserId: string,
    email: string,
    role: WorkspaceRole = WorkspaceRole.MEMBER,
  ) {
    await this.assertCanManageMembers(workspaceId, actorUserId);

    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.upsert({
      where: { email: normalized },
      create: { email: normalized, emailVerified: false },
      update: {},
    });

    const member = await this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      create: { workspaceId, userId: user.id, role },
      update: { role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    return {
      id: member.id,
      userId: member.user.id,
      email: member.user.email,
      name: member.user.name,
      role: member.role,
    };
  }

  private async assertCanManageMembers(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (
      !membership ||
      (membership.role !== WorkspaceRole.OWNER && membership.role !== WorkspaceRole.ADMIN)
    ) {
      throw new ForbiddenException('Only OWNER or ADMIN can manage members');
    }
  }
}
