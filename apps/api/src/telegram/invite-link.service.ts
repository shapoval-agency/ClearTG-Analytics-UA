import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { BotAdminService } from './bot-admin.service';
import { isPaidAdPlatform } from '@cleartg/shared';

// Telegram обмежує назву invite-посилання (те, що бачить адмін каналу в
// самому Telegram) 32 символами — окремо від нашого власного поля `name`,
// яке може бути довшим і показується тільки в кабінеті.
const TELEGRAM_INVITE_NAME_LIMIT = 32;

@Injectable()
export class InviteLinkService {
  private readonly logger = new Logger(InviteLinkService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TelegramService))
    private telegram: TelegramService,
    private botAdmin: BotAdminService,
  ) {}

  async createForClick(input: {
    clickEventId: string;
    workspaceId: string;
    channelId: string;
    campaignId: string | null;
    trackingLinkId: string;
    telegramChatId: string;
  }) {
    const bot = this.telegram.getBot();
    if (!bot) {
      this.logger.warn('Telegram bot not configured — skipping per-click invite');
      return null;
    }

    try {
      const label = `ct_${input.clickEventId.slice(0, 16)}`;
      const created = await bot.api.createChatInviteLink(input.telegramChatId, {
        name: label,
        member_limit: 1,
      });

      return this.prisma.inviteLink.create({
        data: {
          workspaceId: input.workspaceId,
          channelId: input.channelId,
          campaignId: input.campaignId,
          trackingLinkId: input.trackingLinkId,
          clickEventId: input.clickEventId,
          telegramInviteLink: created.invite_link,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to create invite link for click ${input.clickEventId}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  findByTelegramUrl(url: string) {
    return this.prisma.inviteLink.findUnique({
      where: { telegramInviteLink: url },
      include: { clickEvent: true },
    });
  }

  findById(id: string) {
    return this.prisma.inviteLink.findUnique({ where: { id } });
  }

  // ─── Тип 2 з ТЗ: самостійні запрошувальні посилання "під джерело" ───────────

  /**
   * Створює постійну (без ліміту учасників, без прив'язки до кліку)
   * запрошувальне посилання — те, що агентство копіює й публікує/передає
   * партнеру напряму (посів). На відміну від per-click invite (Тип 3),
   * тут немає нашого домену між рекламою і Telegram.
   */
  async createStandalone(input: {
    workspaceId: string;
    channelId: string;
    campaignId: string;
    name: string;
  }) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: input.channelId, workspaceId: input.workspaceId },
    });
    if (!channel) throw new NotFoundException('Канал не знайдено в цьому workspace');

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: input.campaignId, workspaceId: input.workspaceId },
    });
    if (!campaign) throw new NotFoundException('Кампанію не знайдено в цьому workspace');
    if (isPaidAdPlatform(campaign.adPlatform)) {
      throw new BadRequestException(
        'Запрошувальні посилання не призначені для платної реклами (Meta/Google/TikTok) — ' +
          'там немає UTM-міток і немає прив\'язки клік→підписка. Створіть tracking-посилання замість цього.',
      );
    }

    const name = input.name.trim();
    if (!name) throw new BadRequestException('Вкажіть назву джерела для цього посилання');

    const bot = this.telegram.getBot();
    if (!bot) {
      throw new ServiceUnavailableException(
        'Telegram-бот не налаштований — неможливо створити запрошувальне посилання',
      );
    }

    let created;
    try {
      created = await bot.api.createChatInviteLink(channel.telegramChatId, {
        name: name.slice(0, TELEGRAM_INVITE_NAME_LIMIT),
      });
    } catch (err) {
      this.logger.error(
        `Failed to create standalone invite link for channel ${channel.id}: ${err instanceof Error ? err.message : err}`,
      );
      throw new BadRequestException(
        'Telegram відхилив створення посилання — перевірте, що бот адмін каналу з правом «Додавання учасників».',
      );
    }

    return this.prisma.inviteLink.create({
      data: {
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        campaignId: input.campaignId,
        telegramInviteLink: created.invite_link,
        source: 'STANDALONE',
        name,
      },
      include: {
        channel: { select: { title: true } },
        campaign: { select: { name: true, adPlatform: true } },
      },
    });
  }

  listStandalone(workspaceId: string) {
    return this.prisma.inviteLink.findMany({
      where: { workspaceId, source: 'STANDALONE' },
      include: {
        channel: { select: { title: true } },
        campaign: { select: { name: true, adPlatform: true } },
        _count: { select: { membershipEvents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Ручна архівація власником — свідомо відкликає посилання в Telegram. */
  async revokeStandalone(workspaceId: string, id: string) {
    const invite = await this.prisma.inviteLink.findFirst({
      where: { id, workspaceId, source: 'STANDALONE' },
      include: { channel: true },
    });
    if (!invite) throw new NotFoundException('Посилання не знайдено');
    if (invite.isRevoked) return invite;

    const bot = this.telegram.getBot();
    if (bot) {
      try {
        await bot.api.revokeChatInviteLink(invite.channel.telegramChatId, invite.telegramInviteLink);
      } catch (err) {
        // Могли вже видалити вручну в Telegram раніше — не блокуємо позначення в БД.
        this.logger.warn(
          `revokeChatInviteLink failed for ${id} (possibly already removed manually): ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return this.prisma.inviteLink.update({
      where: { id },
      data: { isRevoked: true, revokedAt: new Date(), lastCheckedAt: new Date() },
      include: {
        channel: { select: { title: true } },
        campaign: { select: { name: true, adPlatform: true } },
      },
    });
  }

  /**
   * Bot API не має методу "перевірити статус конкретного посилання" — тому
   * пасивно пробуємо editChatInviteLink з тими самими параметрами (no-op
   * для валідного посилання). Якщо адмін видалив/відкликав посилання вручну в
   * самому Telegram, виклик впаде — це і є сигнал "посилання мертве".
   * Викликається періодично з InviteLinkHealthProcessor.
   */
  async checkStandaloneLinksHealth() {
    const bot = this.telegram.getBot();
    if (!bot) return { checked: 0, revoked: 0 };

    const links = await this.prisma.inviteLink.findMany({
      where: { source: 'STANDALONE', isRevoked: false },
      include: { channel: true },
    });

    let revoked = 0;
    for (const link of links) {
      try {
        await bot.api.editChatInviteLink(link.channel.telegramChatId, link.telegramInviteLink, {
          name: link.name ? link.name.slice(0, TELEGRAM_INVITE_NAME_LIMIT) : undefined,
        });
        await this.prisma.inviteLink.update({
          where: { id: link.id },
          data: { lastCheckedAt: new Date() },
        });
      } catch (err) {
        this.logger.warn(
          `Standalone invite link ${link.id} no longer valid in Telegram (revoked manually?): ${err instanceof Error ? err.message : err}`,
        );
        await this.prisma.inviteLink.update({
          where: { id: link.id },
          data: { isRevoked: true, revokedAt: new Date(), lastCheckedAt: new Date() },
        });
        revoked++;
        await this.botAdmin.notifyInviteLinkRevoked(link.workspaceId, link.name ?? link.telegramInviteLink, link.channel.title, bot);
      }
    }

    return { checked: links.length, revoked };
  }
}
