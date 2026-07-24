import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipEventType, WorkspaceRole } from '@cleartg/database';
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { tryPublicAppUrl } from '../common/public-app-url';
import { formatRecentSubscribersList, formatChannelDigest, kyivDayStart, type DigestPersonRow } from '@cleartg/shared';

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

  /** Public Vercel cabinet URL; null if missing or localhost (Telegram rejects those). */
  private cabinetUrl(path = '/dashboard') {
    const base = tryPublicAppUrl(this.config);
    if (!base) return null;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p === '/' ? '' : p}`;
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
    const kb = new InlineKeyboard()
      .text('📊 Звіт за вчора', 'menu:report_yesterday')
      .text('📈 За 24 год', 'menu:report_24h')
      .row()
      .text('📺 Мої канали', 'menu:channels')
      .text('👥 Останні підписники', 'menu:recent_subs');

    const app = tryPublicAppUrl(this.config);
    if (app) {
      kb.url('🖥 Кабінет', `${app}/dashboard`);
    } else {
      kb.text('🖥 Кабінет', 'menu:cabinet');
    }

    return kb.row().text('❓ Допомога', 'menu:help');
  }

  async sendWelcomeMenu(ctx: Context, linked: boolean) {
    const home = this.cabinetUrl('/') ?? 'https://clear-tg-analytics-ua-web.vercel.app';
    const text = linked
      ? '👋 ClearTG Analytics UA\n\n' +
        'Бот для адміністраторів каналу: звіти, канали, досьє підписників.\n\n' +
        '• Надішліть @username — досьє підписника\n' +
        '• Або перешліть повідомлення від учасника\n' +
        '• /report — звіт за вчора\n' +
        '• /channels — список каналів'
      : '👋 ClearTG Analytics UA\n\n' +
        'Щоб отримувати звіти в Telegram, спочатку привʼяжіть бота до кабінету:\n' +
        `1. Увійдіть на ${home}\n` +
        '2. Налаштування → Telegram-бот\n' +
        '3. Натисніть «Привʼязати» і знову відкрийте посилання\n\n' +
        'Після привʼязки додайте бота адміном каналу — він зʼявиться в кабінеті.';

    await ctx.reply(text, {
      reply_markup: linked ? this.mainMenuKeyboard() : undefined,
    });
  }

  /** Одне повідомлення на кожен канал, де була активність (підписки/відписки) за період. */
  async buildChannelDigests(workspaceIds: string[], mode: 'yesterday' | '24h'): Promise<string[]> {
    const now = new Date();
    let from: Date;
    let to: Date;

    if (mode === 'yesterday') {
      // Межі "вчора" — за київською добою, а не за TZ процесу (зазвичай UTC),
      // інакше підписки біля півночі потрапляють не в той день.
      from = kyivDayStart(now, 1);
      to = kyivDayStart(now, 0);
    } else {
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      to = now;
    }

    const channels = await this.prisma.channel.findMany({
      where: { workspaceId: { in: workspaceIds }, isActive: true },
    });

    const messages: string[] = [];

    for (const channel of channels) {
      const [subs, unsubs] = await Promise.all([
        this.prisma.membershipEvent.findMany({
          where: {
            channelId: channel.id,
            eventType: MembershipEventType.SUBSCRIBE,
            occurredAt: { gte: from, lt: to },
          },
          include: {
            attribution: { include: { trackingLink: true } },
            subscriberProfile: { select: { botStarted: true } },
          },
        }),
        this.prisma.unsubscribeEvent.findMany({
          where: { channelId: channel.id, occurredAt: { gte: from, lt: to } },
          include: {
            subscriberProfile: {
              include: { membershipEvent: { include: { attribution: { include: { trackingLink: true } } } } },
            },
          },
        }),
      ]);

      if (subs.length === 0 && unsubs.length === 0) continue;

      const totalActive = await this.prisma.subscriberProfile.count({
        where: { channelId: channel.id, unsubscribeEvents: { none: {} } },
      });

      const subscriberRows: DigestPersonRow[] = subs.map((s) => ({
        telegramUserId: s.telegramUserId,
        username: s.telegramUsername,
        firstName: s.telegramFirstName,
        lastName: s.telegramLastName,
        occurredAt: s.occurredAt,
        sourceLabel: s.attribution?.trackingLink?.name ?? 'без посилання',
        botStarted: s.subscriberProfile?.botStarted ?? false,
      }));

      // Якщо subscriberProfile немає — людина вже була в каналі до підключення
      // бота (ми ніколи не бачили її підписку, тільки зараз бачимо відписку).
      // Показуємо це окремою групою "початкова аудиторія" і рахуємо дні
      // від дати підключення каналу — це нижня межа ("не менше N днів"),
      // а не точна дата підписки, якої ми просто не знаємо.
      const unsubscriberRows: DigestPersonRow[] = unsubs.map((u) => {
        const subscribedAt = u.subscriberProfile?.subscribedAt;
        const daysInChannel = subscribedAt
          ? Math.max(0, Math.floor((u.occurredAt.getTime() - subscribedAt.getTime()) / 86_400_000))
          : Math.max(0, Math.floor((u.occurredAt.getTime() - channel.createdAt.getTime()) / 86_400_000));
        return {
          telegramUserId: u.telegramUserId,
          username: u.telegramUsername,
          firstName: u.telegramFirstName,
          lastName: u.telegramLastName,
          occurredAt: u.occurredAt,
          sourceLabel: u.subscriberProfile
            ? (u.subscriberProfile.membershipEvent.attribution?.trackingLink?.name ?? 'без посилання')
            : 'початкова аудиторія',
          daysInChannel,
          daysApprox: !subscribedAt,
          botStarted: u.subscriberProfile?.botStarted ?? false,
        };
      });

      messages.push(
        formatChannelDigest({
          channelTitle: channel.title,
          totalActive,
          netChange: subs.length - unsubs.length,
          subscribers: subscriberRows,
          unsubscribers: unsubscriberRows,
        }),
      );
    }

    return messages;
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
    const messages = await this.buildChannelDigests(wsIds, mode);
    if (messages.length === 0) {
      await ctx.reply('За цей період активності немає.', { reply_markup: this.mainMenuKeyboard() });
      return;
    }
    for (let i = 0; i < messages.length; i++) {
      const isLast = i === messages.length - 1;
      await ctx.reply(messages[i], isLast ? { reply_markup: this.mainMenuKeyboard() } : undefined);
    }
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
      const channelsUrl = this.cabinetUrl('/channels');
      await ctx.reply(
        'Каналів ще немає.\n\n' +
          `1. Додайте @${this.botUsername()} адміном каналу\n` +
          '2. Увімкніть «Додавання учасників»\n' +
          (channelsUrl ? `3. Або синхронізуйте в ${channelsUrl}` : '3. Або синхронізуйте канали в веб-кабінеті'),
      );
      return;
    }

    await ctx.reply(`📺 Ваші канали:\n\n${lines.join('\n')}`, {
      reply_markup: this.mainMenuKeyboard(),
    });
  }

  async sendRecentSubscribers(ctx: Context, telegramId: string, limit = 10) {
    const user = await this.getLinkedUser(telegramId);
    if (!user) {
      await ctx.reply('Спочатку привʼяжіть бота до кабінету.');
      return;
    }

    const wsIds = this.workspaceIdsForUser(user);
    if (wsIds.length === 0) {
      await ctx.reply('У вас немає доступних workspace.');
      return;
    }

    const profiles = await this.prisma.subscriberProfile.findMany({
      where: { workspaceId: { in: wsIds } },
      include: {
        channel: { select: { title: true } },
        membershipEvent: { select: { telegramUsername: true } },
        _count: { select: { unsubscribeEvents: true } },
      },
      orderBy: { subscribedAt: 'desc' },
      take: limit,
    });

    const text = formatRecentSubscribersList(
      profiles.map((p) => ({
        username: p.membershipEvent.telegramUsername,
        telegramUserId: p.telegramUserId,
        channelTitle: p.channel.title,
        subscribedAt: p.subscribedAt,
        isActive: p._count.unsubscribeEvents === 0,
      })),
    );

    await ctx.reply(text, { reply_markup: this.mainMenuKeyboard() });
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

    const dossierUrl = this.cabinetUrl(`/subscribers/${profile.id}`);
    return (
      `👤 Досьє підписника\n\n` +
      `Канал: ${profile.channel.title}\n` +
      `Username: ${profile.membershipEvent.telegramUsername ? `@${profile.membershipEvent.telegramUsername}` : '—'}\n` +
      `ID: ${profile.telegramUserId}\n` +
      `Підписка: ${profile.subscribedAt.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}\n` +
      `Статус: ${active ? '✅ у каналі' : '❌ відписався'}\n` +
      (attr
        ? `\nДжерело: ${this.attrLabel(attr.attributionType)} (${Math.round(attr.confidenceScore * 100)}%)\n` +
          `Кампанія: ${attr.campaign?.name ?? '—'}\n` +
          `Посилання: ${attr.trackingLink?.slug ? `/l/${attr.trackingLink.slug}` : '—'}\n` +
          `UTM: ${attr.clickEvent?.utmSource ?? '—'} / ${attr.clickEvent?.utmCampaign ?? '—'}`
        : '\nДжерело: не визначено') +
      (dossierUrl ? `\n\n🖥 ${dossierUrl}` : '')
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

  async notifyChannelDisconnected(telegramUserId: string, channelTitle: string, bot: { api: { sendMessage: (id: number, text: string) => Promise<unknown> } }) {
    try {
      await bot.api.sendMessage(
        parseInt(telegramUserId, 10),
        `⚠️ Канал «${channelTitle}» відключено від ClearTG.\n\n` +
          'Бота прибрано з адміністраторів (або знято потрібні права) — збір підписок/відписок зупинено.\n' +
          'Щоб відновити, поверніть боту права адміністратора з можливістю «Додавання учасників».',
      );
    } catch {
      /* user may not have started bot */
    }
  }

  async notifyMissingInvitePermission(telegramUserId: string, channelTitle: string, bot: { api: { sendMessage: (id: number, text: string) => Promise<unknown> } }) {
    try {
      await bot.api.sendMessage(
        parseInt(telegramUserId, 10),
        `⚠️ Бот доданий адміністратором каналу «${channelTitle}», але без права «Додавання учасників».\n\n` +
          'Підписки й відписки вже фіксуються, але точні (per-click) invite-посилання для реклами створюватися не будуть.\n' +
          'Відкрийте налаштування адміністратора бота в каналі й увімкніть це право.',
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
        const messages = await this.buildChannelDigests(wsIds, 'yesterday');
        if (messages.length === 0) continue;
        const chatId = parseInt(user.telegramId, 10);
        await bot.api.sendMessage(chatId, '🌅 Щоденний звіт');
        for (const text of messages) {
          await bot.api.sendMessage(chatId, text);
        }
      } catch {
        /* blocked bot */
      }
    }
  }

  helpText() {
    const home = this.cabinetUrl('/') ?? 'https://clear-tg-analytics-ua-web.vercel.app';
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
      '/subscribers — останні підписники\n' +
      '/cabinet — посилання на кабінет\n\n' +
      `Кабінет: ${home}`
    );
  }
}
