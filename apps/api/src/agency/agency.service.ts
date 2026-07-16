import { ForbiddenException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { generateSlug } from '@cleartg/shared';
import { WorkspaceRole } from '@cleartg/database';
import { resolveFrontendUrl } from '../common/public-app-url';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AgencyService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(forwardRef(() => AuthService))
    private auth: AuthService,
  ) {}

  getAgencyAdminEmail(): string | null {
    const email = this.config.get<string>('AGENCY_ADMIN_EMAIL')?.trim().toLowerCase();
    return email || null;
  }

  isAgencyAdmin(userEmail: string): boolean {
    const agencyEmail = this.getAgencyAdminEmail();
    return Boolean(agencyEmail && userEmail.trim().toLowerCase() === agencyEmail);
  }

  assertAgencyAdmin(userEmail: string) {
    if (!this.isAgencyAdmin(userEmail)) {
      throw new ForbiddenException('Agency admin access required');
    }
  }

  async createClientWorkspace(
    agencyUserId: string,
    ownerEmail: string,
    workspaceName: string,
  ) {
    const normalizedOwner = ownerEmail.trim().toLowerCase();
    const appUrl = resolveFrontendUrl(this.config);

    const owner = await this.prisma.user.upsert({
      where: { email: normalizedOwner },
      create: {
        email: normalizedOwner,
        emailVerified: false,
        name: workspaceName,
      },
      update: {},
    });

    const workspace = await this.prisma.workspace.create({
      data: {
        name: workspaceName,
        slug: generateSlug(8),
        privacyPolicyUrl: `${appUrl}/privacy`,
        members: {
          create: [
            { userId: owner.id, role: WorkspaceRole.OWNER },
            { userId: agencyUserId, role: WorkspaceRole.ADMIN },
          ],
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });

    const { link } = await this.auth.createMagicLink(normalizedOwner);
    const inviteMail = await this.auth.sendClientInviteEmail(
      normalizedOwner,
      workspaceName,
      link,
    );

    const staging = this.config.get<string>('STAGING_MODE') === 'true';

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      ownerEmail: owner.email,
      members: workspace.members.map((m) => ({
        email: m.user.email,
        role: m.role,
      })),
      invite: {
        emailSent: inviteMail.sent,
        ...(inviteMail.error ? { emailError: inviteMail.error } : {}),
        ...((staging || !inviteMail.sent) ? { loginLink: link } : {}),
      },
    };
  }

  async listClientWorkspaces(agencyUserId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId: agencyUserId,
        role: WorkspaceRole.ADMIN,
      },
      include: {
        workspace: {
          include: {
            members: {
              include: { user: { select: { email: true } } },
            },
            _count: {
              select: {
                channels: true,
                subscriberProfiles: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => {
      const owner = m.workspace.members.find((x) => x.role === WorkspaceRole.OWNER);
      return {
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        ownerEmail: owner?.user.email ?? null,
        channels: m.workspace._count.channels,
        subscribers: m.workspace._count.subscriberProfiles,
        createdAt: m.workspace.createdAt,
      };
    });
  }
}
