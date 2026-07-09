import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipEventType, WorkspaceRole } from '@cleartg/database';
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';

const BIND_TTL_SEC = 60 * 60 * 24 * 7;

@Injectable()
export class BotAdminService {
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
  }

  private appUrl() {
    return (
      this.config.get<string>('NEXT_PUBLIC_APP_URL') ??
      this.config.get<string>('API_URL') ??
      'http://localhost:3002'
    ).replace(/\/$/, '');
  }

  private botUsername() {
    return this.config.get<string>('TELEGRAM_BOT_USERNAME') ?? 'cleartg_bot';
  }

  async createBindToken(userId: string): Promise<{ url: string; expiresInDays: number }> {
    const raw = randomBytes(16).toString('hex');
    await this.redis.set(`tg_bind:${raw}`, userId, 'EX', BIND_TTL_SEC);
    return {
      url: `https://t.me/${this.botUsername()}?start=bind_${raw}`,
      expiresInDays: 7,
    };
  }

  async bindTelegramAccount(rawToken: string, telegramId: string, username?: string) {
    const userId = await this.redis.get(`tg_bind:${rawToken}`);
    if (!userId) return { ok: false as const, message: 'Посилання прострочене або недійсне. Отримайте нове в кабінеті.' };

    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramId, name: username ? `@${username}` : undefined },
    });
    await this.redis.del(`tg_bind:${rawToken}`);
    return { ok: true as const, userId };
  }

  async getLinkedUser(telegramId: string) {
    return this.prisma.user.findFirst({
      where: { telegramId },
      include: {
        memberships: {
          include: {
            workspace: {
              include: {
                channels: { where: { isActive: true }, orderBy: { title: 'asc' } },
              },
            },
          },
        },
      },
    });
  }

  workspaceIdsForUser(user: { memberships: Array<{ workspaceId: string; role: WorkspaceRole }> }) {
    const allowed: WorkspaceRole[] = [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ];
    return user.memberships
      .filter((m) => allowed.includes(m.role))
      .map((m) => m.workspaceId);
  }

  mainMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📊 Звіт за вчора', 'menu:report_yesterday')
      .text('📈 За 24 год', 'menu:report_24h')
      .row()
      .text('📺 Мої канали', 'menu:channels')
      .url('🖥 Кабінет', `${this.appUrl()}/dashboard`)
      .row()
      .text('❓ Допомога', 'menu:help');
  }

  async sendWelcomeMenu(ctx: Context, linked: boolean) {
    const text = linked
      ? '👋 ClearTG Analytics UA\n\n' +
        'Бот для адміністраторів каналу: звіти, канали, досьє підписників.\n\n' +
        '• Надішліть @username — досьє підписника\n' +
        '• Або перешліть повідомлення від учасника\n' +
        '• /report — звіт за вчора\n' +
        '• /channels — список каналів'
      : '👋 ClearTG Analytics UA\n\n' +
        'Щоб отримувати звіти в Telegram, спочатку привʼяжіть бота до кабінету:\n' +
        `1. Увійдіть на ${this.appUrl()}\n` +
        '2. Налаштування → Telegram-бот\n' +
        '3. Натисніть «Привʼязати» і знову відкрийте посилання\n\n' +
        'Після привʼязки додайте бота адміном каналу — він зʼявиться в кабінеті.';

    await ctx.reply(text, {
      reply_markup: linked ? this.mainMenuKeyboard() : undefined,
    });
  }

  async buildDigest(workspaceIds: string[], mode: 'yesterday' | '24h') {
    const now = new Date();
    let from: Date;
    let to: Date;
    let label: string;

    if (mode === 'yesterday') {
      from = new Date(now);
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(from);
      to.setDate(to.getDate() + 1);
      label = from.toLocaleDateString('uk-UA');
    } else {
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      to = now;
      label = 'останні 24 год';
    }

    const where = { workspaceId: { in: workspaceIds } };
    const [subs, unsubs, clicks] = await Promise.all([
      this.prisma.membershipEvent.count({
        where: {
          ...where,
          eventType: MembershipEventType.SUBSCRIBE,
          occurredAt: { gte: from, lt: to },
        },
      }),
      this.prisma.unsubscribeEvent.count({
        where: { ...where, occurredAt: { gte: from, lt: to } },
      }),
      this.prisma.clickEvent.count({
        where: { ...where, clickedAt: { gte: from, lt: to } },
      }),
    ]);

    const attributions = await this.prisma.attribution.groupBy({
      by: ['attributionType'],
      where: {
        workspaceId: { in: workspaceIds },
        membershipEvent: {
          eventType: MembershipEventType.SUBSCRIBE,
          occurredAt: { gte: from, lt: to },
        },
      },
      _count: true,
    });

    const sourceLines = attributions
      .map((a) => `  • ${this.attrLabel(a.attributionType)}: ${a._count}`)
      .join('\n');

    return (
      `📊 Звіт (${label})\n\n` +
      `➕ Підписки: ${subs}\n` +
      `➖ Відписки: ${unsubs}\n` +
      `📈 Чистий приріст: ${subs - unsubs}\n` +
      `🔗 Кліки (реклама): ${clicks}\n` +
      (clicks > 0 ? `🎯 CR клік→підписка: ${((subs / clicks) * 100).toFixed(1)}%\n` : '') +
      (sourceLines ? `\nДжерела:\n${sourceLines}` : '') +
      `\n\n🖥 Детальніше: ${this.appUrl()}/dashboard`
    );
  }

  private attrLabel(type: string) {
    const map: Record<string, string> = {
      EXACT_CLICK_INVITE: 'Точна реклама',
      CAMPAIGN_INVITE: 'Кампанія',
      PROBABILISTIC: 'Ймовірна реклама',
      ORGANIC: 'Напряму / органіка',
      UNKNOWN: 'Невідомо',
    };
    return map[type] ?? type;
  }

  async sendReportToChat(ctx: Context, telegramId: string, mode: 'yesterday' | '24h') {
    const user = await this.getLinkedUser(telegramId);
    if (!user) {
      await ctx.reply(
        'Кабінет не привʼязано. Відкрийте Налаштування → Telegram-бот у веб-кабінеті.',
      );
      return;
    }
    const wsIds = this.workspaceIdsForUser(user);
    if (wsIds.length === 0) {
      await ctx.reply('У вас немає доступних workspace.');
      return;
    }
    const text = await this.buildDigest(wsIds, mode);
    await ctx.reply(text, { reply_markup: this.mainMenuKeyboard() });
  }

  async sendChannelsList(ctx: Context, telegramId: string) {
    const user = await this.getLinkedUser(telegramId);
    if (!user) {
      await ctx.reply('Спочатку привʼяжіть бота до кабінету.');
      return;
    }

    const lines: string[] = [];
    for (const m of user.memberships) {
      for (const ch of m.workspace.channels) {
        const status = ch.botIsAdmin ? '✅' : '⚠️';
        lines.push(`${status} ${ch.title}${ch.username ? ` (@${ch.username})` : ''}`);
      }
    }

    if (lines.length === 0) {
      await ctx.reply(
        'Каналів ще немає.\n\n' +
          `1. Додайте @${this.botUsername()} адміном каналу\n` +
          '2. Увімкніть «Додавання учасників»\n' +
          `3. Або синхронізуйте в ${this.appUrl()}/channels`,
      );
      return;
    }

    await ctx.reply(`📺 Ваші канали:\n\n${lines.join('\n')}`, {
      reply_markup: this.mainMenuKeyboard(),
    });
  }

  async lookupDossier(telegramId: string, targetUsername?: string, targetTelegramId?: string) {
    const user = await this.getLinkedUser(telegramId);
    if (!user) return null;

    const wsIds = this.workspaceIdsForUser(user);
    const normalized = targetUsername?.replace(/^@/, '').toLowerCase();

    const profile = await this.prisma.subscriberProfile.findFirst({
      where: {
        workspaceId: { in: wsIds },
        OR: [
          ...(normalized
            ? [{ membershipEvent: { telegramUsername: { equals: normalized, mode: 'insensitive' as const } } }]
            : []),
          ...(targetTelegramId ? [{ telegramUserId: targetTelegramId }] : []),
        ],
      },
      include: {
        channel: { select: { title: true } },
        membershipEvent: {
          include: {
            attribution: {
              include: { campaign: true, trackingLink: true, clickEvent: true },
            },
          },
        },
        unsubscribeEvents: { orderBy: { occurredAt: 'desc' }, take: 1 },
        _count: { select: { unsubscribeEvents: true } },
      },
      orderBy: { subscribedAt: 'desc' },
    });

    if (!profile) return null;

    const attr = profile.membershipEvent.attribution;
    const active = profile._count.unsubscribeEvents === 0;

    return (
      `👤 Досьє підписника\n\n` +
      `Канал: ${profile.channel.title}\n` +
      `Username: ${profile.membershipEvent.telegramUsername ? `@${profile.membershipEvent.telegramUsername}` : '—'}\n` +
      `ID: ${profile.telegramUserId}\n` +
      `Підписка: ${profile.subscribedAt.toLocaleString('uk-UA')}\n` +
      `Статус: ${active ? '✅ у каналі' : '❌ відписався'}\n` +
      (attr
        ? `\nДжерело: ${this.attrLabel(attr.attributionType)} (${Math.round(attr.confidenceScore * 100)}%)\n` +
          `Кампанія: ${attr.campaign?.name ?? '—'}\n` +
          `Посилання: ${attr.trackingLink?.slug ? `/l/${attr.trackingLink.slug}` : '—'}\n` +
          `UTM: ${attr.clickEvent?.utmSource ?? '—'} / ${attr.clickEvent?.utmCampaign ?? '—'}`
        : '\nДжерело: не визначено') +
      `\n\n🖥 ${this.appUrl()}/subscribers/${profile.id}`
    );
  }

  async resolveWorkspaceForChannelRegistration(telegramUserId?: string) {
    if (telegramUserId) {
      const user = await this.getLinkedUser(telegramUserId);
      if (user) {
        const owner = user.memberships.find((m) => m.role === WorkspaceRole.OWNER);
        const admin = user.memberships.find((m) => m.role === WorkspaceRole.ADMIN);
        const pick = owner ?? admin ?? user.memberships[0];
        if (pick) return pick.workspaceId;
      }
    }

    const stagingEmail = this.config.get<string>('STAGING_LOGIN_EMAIL')?.trim().toLowerCase();
    if (stagingEmail) {
      const u = await this.prisma.user.findUnique({ where: { email: stagingEmail } });
      if (u) {
        const m = await this.prisma.workspaceMember.findFirst({
          where: { userId: u.id },
          orderBy: { createdAt: 'asc' },
        });
        if (m) return m.workspaceId;
      }
    }

    const ws = await this.prisma.workspace.findFirst({ where: { slug: 'main' } });
    return ws?.id ?? null;
  }

  async notifyChannelConnected(telegramUserId: string, channelTitle: string, bot: { api: { sendMessage: (id: number, text: string) => Promise<unknown> } }) {
    try {
      await bot.api.sendMessage(
        parseInt(telegramUserId, 10),
        `✅ Канал «${channelTitle}» підключено до ClearTG!\n\n` +
          'Підписки та відписки тепер фіксуються автоматично.\n' +
          'Натисніть /report для звіту.',
      );
    } catch {
      /* user may not have started bot */
    }
  }

  async sendDailyReportsToAll(bot: { api: { sendMessage: (id: number, text: string) => Promise<unknown> } }) {
    const users = await this.prisma.user.findMany({
      where: { telegramId: { not: null } },
      include: { memberships: true },
    });

    for (const user of users) {
      if (!user.telegramId) continue;
      const wsIds = this.workspaceIdsForUser(user);
      if (wsIds.length === 0) continue;

      try {
        const text = await this.buildDigest(wsIds, 'yesterday');
        await bot.api.sendMessage(parseInt(user.telegramId, 10), `🌅 Щоденний звіт\n\n${text}`);
      } catch {
        /* blocked bot */
      }
    }
  }

  helpText() {
    return (
      '❓ Допомога ClearTG\n\n' +
      '1. Привʼяжіть бота в кабінеті (Налаштування → Telegram)\n' +
      '2. Додайте бота адміном каналу (+ право «Додавання учасників»)\n' +
      '3. Створіть tracking-посилання /l/ для реклами\n' +
      '4. Вставте в Meta / Google / TikTok\n\n' +
      'Команди:\n' +
      '/menu — головне меню\n' +
      '/report — звіт за вчора\n' +
      '/channels — канали\n' +
      '/cabinet — посилання на кабінет\n\n' +
      `Кабінет: ${this.appUrl()}`
    );
  }
}
