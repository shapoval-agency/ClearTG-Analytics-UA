import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyService } from '../agency/agency.service';
import { BotAdminService } from '../telegram/bot-admin.service';
import { resolveFrontendUrl } from '../common/public-app-url';
import { MailService } from '../common/mail.service';

const MAGIC_LINK_TTL_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject(forwardRef(() => AgencyService))
    private agency: AgencyService,
    private botAdmin: BotAdminService,
    private mail: MailService,
  ) {}

  async requestMagicLink(email: string) {
    const normalized = email.trim().toLowerCase();
    const { link } = await this.createMagicLink(normalized);
    const delivery = await this.sendMagicLinkEmail(normalized, link);

    const isDev = this.config.get<string>('NODE_ENV') !== 'production';
    const staging = this.config.get<string>('STAGING_MODE') === 'true';
    return {
      message: delivery.sent ? 'Magic link sent' : 'Magic link created',
      emailSent: delivery.sent,
      ...(delivery.error ? { emailError: delivery.error } : {}),
      ...((isDev || staging || !delivery.sent) ? { devLink: link } : {}),
    };
  }

  /** Create magic-link token + URL (used by login and agency invites). */
  async createMagicLink(email: string): Promise<{ link: string; email: string }> {
    const normalized = email.trim().toLowerCase();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);

    await this.prisma.magicLinkToken.create({
      data: { email: normalized, tokenHash, expiresAt },
    });

    const appUrl = resolveFrontendUrl(this.config);
    return {
      email: normalized,
      link: `${appUrl}/auth/callback?token=${rawToken}`,
    };
  }

  async sendMagicLinkEmail(email: string, link: string) {
    return this.mail.send({
      to: email,
      subject: 'Вхід у ClearTG Analytics',
      text:
        `Вітаємо!\n\n` +
        `Перейдіть за посиланням, щоб увійти в ClearTG Analytics:\n${link}\n\n` +
        `Посилання дійсне ${MAGIC_LINK_TTL_MINUTES} хвилин.\n` +
        `Якщо ви не запитували вхід — проігноруйте цей лист.`,
      html:
        `<p>Вітаємо!</p>` +
        `<p><a href="${link}">Увійти в ClearTG Analytics</a></p>` +
        `<p style="color:#64748b;font-size:14px">Посилання дійсне ${MAGIC_LINK_TTL_MINUTES} хвилин.</p>`,
    });
  }

  async sendClientInviteEmail(email: string, workspaceName: string, link: string) {
    return this.mail.send({
      to: email,
      subject: `Запрошення до ClearTG — ${workspaceName}`,
      text:
        `Вас додано до кабінету «${workspaceName}» у ClearTG Analytics.\n\n` +
        `Відкрийте посилання, щоб увійти:\n${link}\n\n` +
        `Посилання дійсне ${MAGIC_LINK_TTL_MINUTES} хвилин.`,
      html:
        `<p>Вас додано до кабінету <strong>${workspaceName}</strong> у ClearTG Analytics.</p>` +
        `<p><a href="${link}">Увійти в кабінет</a></p>` +
        `<p style="color:#64748b;font-size:14px">Посилання дійсне ${MAGIC_LINK_TTL_MINUTES} хвилин.</p>`,
    });
  }

  async verifyMagicLink(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.prisma.magicLinkToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new Error('Invalid or expired magic link');
    }

    await this.prisma.magicLinkToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const user = await this.prisma.user.upsert({
      where: { email: record.email },
      create: { email: record.email, emailVerified: true },
      update: { emailVerified: true },
    });

    const workspaces = await this.prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
    });

    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      isAgencyAdmin: this.agency.isAgencyAdmin(user.email),
      workspaces: workspaces.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
      })),
    };
  }

  /** Тестовий вхід: один логін/пароль, лише коли STAGING_MODE=true */
  async stagingLogin(email: string, password: string) {
    if (this.config.get<string>('STAGING_MODE') !== 'true') {
      throw new UnauthorizedException('Staging login disabled');
    }

    const expectedEmail =
      this.config.get<string>('STAGING_LOGIN_EMAIL') ?? 'test@cleartg.ua';
    const expectedPassword =
      this.config.get<string>('STAGING_LOGIN_PASSWORD') ?? 'cleartg123';
    const agencyEmail = this.agency.getAgencyAdminEmail();

    const normalized = email.trim().toLowerCase();
    const allowedEmails = [expectedEmail.trim().toLowerCase()];
    if (agencyEmail) allowedEmails.push(agencyEmail);

    if (
      !allowedEmails.includes(normalized) ||
      password !== expectedPassword
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = await this.prisma.user.upsert({
      where: { email: normalized },
      create: { email: normalized, emailVerified: true, name: 'Test User' },
      update: { emailVerified: true },
    });

    const workspaces = await this.prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
    });

    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      isAgencyAdmin: this.agency.isAgencyAdmin(user.email),
      workspaces: workspaces.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
      })),
    };
  }

  async createTelegramBindLink(userId: string) {
    return this.botAdmin.createBindToken(userId);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, telegramId: true },
    });
    if (!user) return null;

    const workspaces = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
    });

    return {
      user,
      isAgencyAdmin: this.agency.isAgencyAdmin(user.email),
      workspaces: workspaces.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
      })),
    };
  }
}
