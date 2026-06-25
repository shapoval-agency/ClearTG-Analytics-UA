import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { InviteLinkService } from '../telegram/invite-link.service';
import {
  parseConsentFromQuery,
  extractClickIds,
  parseUserAgent,
  hashIp,
  hashUserAgent,
  generateSlug,
  DEFAULT_CONSENT,
  resolveDefaultLinkMode,
  validateLinkModeForPlatform,
  getPublicLinkPath,
  type LinkMode,
} from '@cleartg/shared';
import { CreateTrackingLinkDto } from './dto/create-tracking-link.dto';
import type { LandingPageContext } from './tracking-html';
import { InviteLinkService } from '../telegram/invite-link.service';

export type TrackingPageSource = 'landing_page' | 'shortlink_page';

export interface RecordClickResult {
  clickEvent: { id: string };
  pageContext: LandingPageContext;
  autoRedirect: boolean;
  redirectDelayMs: number;
  consent: ReturnType<typeof parseConsentFromQuery>;
  privacyPolicyUrl: string | null;
}

@Injectable()
export class TrackingService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    @Inject(forwardRef(() => InviteLinkService))
    private inviteLinks: InviteLinkService,
  ) {}

  async createLink(workspaceId: string, dto: CreateTrackingLinkDto) {
    const campaign = dto.campaignId
      ? await this.prisma.campaign.findFirst({
          where: { id: dto.campaignId, workspaceId },
          select: { adPlatform: true },
        })
      : null;

    if (dto.campaignId && !campaign) {
      throw new BadRequestException('Campaign not found in workspace');
    }

    const platform = campaign?.adPlatform ?? null;
    const linkMode: LinkMode = dto.linkMode ?? resolveDefaultLinkMode(platform);
    const validation = validateLinkModeForPlatform(linkMode, platform);
    if (!validation.valid) {
      throw new BadRequestException(validation.reason);
    }

    const slug = generateSlug(10);
    const link = await this.prisma.trackingLink.create({
      data: {
        workspaceId,
        channelId: dto.channelId,
        campaignId: dto.campaignId,
        slug,
        name: dto.name,
        linkMode,
        landingTitle: dto.landingTitle,
        landingDescription: dto.landingDescription,
        destinationMode: dto.destinationMode ?? 'INVITE_LINK',
        landingPostUrl: dto.landingPostUrl,
        destinationUrl: dto.destinationUrl,
        autoRedirect: dto.autoRedirect ?? true,
        redirectDelayMs: dto.redirectDelayMs ?? 0,
        usePerClickInvite: dto.usePerClickInvite ?? true,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        utmTerm: dto.utmTerm,
      },
      include: {
        channel: { select: { title: true } },
        campaign: { select: { name: true, adPlatform: true } },
      },
    });

    return {
      ...link,
      publicPath: getPublicLinkPath(link.linkMode as LinkMode, link.slug),
    };
  }

  async listLinks(workspaceId: string) {
    const links = await this.prisma.trackingLink.findMany({
      where: { workspaceId },
      include: {
        channel: { select: { id: true, title: true } },
        campaign: { select: { id: true, name: true, adPlatform: true } },
        _count: { select: { clickEvents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      ...link,
      publicPath: getPublicLinkPath(link.linkMode as LinkMode, link.slug),
    }));
  }

  async getLinkBySlug(slug: string) {
    const link = await this.prisma.trackingLink.findUnique({
      where: { slug },
      include: {
        channel: true,
        campaign: true,
        workspace: { select: { privacyPolicyUrl: true } },
      },
    });
    if (!link || !link.isActive) {
      throw new NotFoundException('Tracking link not found');
    }
    return link;
  }

  assertLinkModeForRoute(link: { linkMode: string; slug: string }, expected: LinkMode) {
    if (link.linkMode !== expected) {
      const correctPath = getPublicLinkPath(link.linkMode as LinkMode, link.slug);
      throw new NotFoundException(
        `Це посилання доступне за адресою ${correctPath}`,
      );
    }
  }

  async recordClick(
    slug: string,
    query: Record<string, string | undefined>,
    headers: { ip?: string; userAgent?: string; referer?: string },
    pageSource: TrackingPageSource,
    expectedLinkMode: LinkMode,
  ): Promise<RecordClickResult> {
    const link = await this.getLinkBySlug(slug);
    this.assertLinkModeForRoute(link, expectedLinkMode);
    const salt = this.crypto.getHashSalt();
    const clickIds = extractClickIds(query);
    const consent = parseConsentFromQuery(query);
    const ua = headers.userAgent ? parseUserAgent(headers.userAgent) : null;

    const clickEvent = await this.prisma.clickEvent.create({
      data: {
        workspaceId: link.workspaceId,
        channelId: link.channelId,
        campaignId: link.campaignId,
        trackingLinkId: link.id,
        fbclid: clickIds.fbclid,
        fbp: clickIds.fbp,
        fbc: clickIds.fbc,
        gclid: clickIds.gclid,
        gbraid: clickIds.gbraid,
        wbraid: clickIds.wbraid,
        ttclid: clickIds.ttclid,
        ttp: clickIds.ttp,
        gaClientId: clickIds.gaClientId,
        gaSessionId: clickIds.gaSessionId,
        utmSource: clickIds.utmSource ?? link.utmSource,
        utmMedium: clickIds.utmMedium ?? link.utmMedium,
        utmCampaign: clickIds.utmCampaign ?? link.utmCampaign,
        utmContent: clickIds.utmContent ?? link.utmContent,
        utmTerm: clickIds.utmTerm ?? link.utmTerm,
        referrer: headers.referer,
        ipHash: headers.ip ? hashIp(headers.ip, salt) : null,
        userAgentHash: headers.userAgent ? hashUserAgent(headers.userAgent, salt) : null,
        browser: ua?.browser,
        device: ua?.device,
        os: ua?.os,
        consentSnapshot: consent as object,
      },
    });

    await this.prisma.consentEvent.create({
      data: {
        workspaceId: link.workspaceId,
        clickEventId: clickEvent.id,
        source: pageSource,
        consentData: consent as object,
        ipHash: headers.ip ? hashIp(headers.ip, salt) : null,
        userAgentHash: headers.userAgent ? hashUserAgent(headers.userAgent, salt) : null,
      },
    });

    const telegramUrl = await this.resolveDestination(link, clickEvent.id);
    const pageContext = this.buildPageContext(link, telegramUrl);

    return {
      clickEvent,
      pageContext,
      autoRedirect: link.autoRedirect,
      redirectDelayMs: link.redirectDelayMs,
      consent,
      privacyPolicyUrl: link.workspace.privacyPolicyUrl,
    };
  }

  buildPageContext(
    link: {
      linkMode: string;
      landingTitle: string | null;
      landingDescription: string | null;
      channel: { title: string; username: string | null };
      workspace: { privacyPolicyUrl: string | null };
    },
    telegramUrl: string,
  ): LandingPageContext {
    const defaultDescription =
      'Зараз відкриється Telegram-канал. Підписка відбувається вручну — ми не додаємо вас автоматично.';

    return {
      channelTitle: link.channel.title,
      channelUsername: link.channel.username,
      landingTitle: link.landingTitle ?? link.channel.title,
      landingDescription: link.landingDescription ?? defaultDescription,
      telegramUrl,
      privacyPolicyUrl: link.workspace.privacyPolicyUrl ?? '/privacy',
      linkMode: link.linkMode as 'LANDING_PAGE' | 'SHORTLINK',
    };
  }

  private async resolveDestination(
    link: {
      destinationMode: string;
      landingPostUrl: string | null;
      destinationUrl: string | null;
      usePerClickInvite: boolean;
      workspaceId: string;
      channelId: string;
      campaignId: string | null;
      id: string;
      channel: { username: string | null; telegramChatId: string };
    },
    clickId: string,
  ): Promise<string> {
    const shouldUseInvite =
      link.usePerClickInvite && link.destinationMode === 'INVITE_LINK';

    if (shouldUseInvite) {
      const invite = await this.inviteLinks.createForClick({
        clickEventId: clickId,
        workspaceId: link.workspaceId,
        channelId: link.channelId,
        campaignId: link.campaignId,
        trackingLinkId: link.id,
        telegramChatId: link.channel.telegramChatId,
      });
      if (invite) return invite.telegramInviteLink;
    }

    switch (link.destinationMode) {
      case 'PUBLIC_POST':
        return link.landingPostUrl ?? (link.channel.username
          ? `https://t.me/${link.channel.username}`
          : `https://t.me/c/${link.channel.telegramChatId.replace('-100', '')}`);
      case 'INVITE_LINK':
        return link.destinationUrl ?? `https://t.me/${link.channel.username ?? 'channel'}`;
      case 'BOT_START':
        return `https://t.me/${process.env.TELEGRAM_BOT_USERNAME ?? 'cleartg_bot'}?start=click_${clickId}`;
      case 'EXTERNAL_URL':
        return link.destinationUrl ?? 'https://t.me';
      default:
        return link.landingPostUrl ?? 'https://t.me';
    }
  }

  getDefaultConsent() {
    return DEFAULT_CONSENT;
  }
}
