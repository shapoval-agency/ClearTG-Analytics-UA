import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';

@Injectable()
export class InviteLinkService {
  private readonly logger = new Logger(InviteLinkService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TelegramService))
    private telegram: TelegramService,
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
}
