import { Injectable } from '@nestjs/common';
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
}
