import { Injectable, NotFoundException, BadRequestException, Inject, Optional, forwardRef } from '@nestjs/common';
import { ConversionService } from '../conversion/conversion.service';
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
  isPaidAdPlatform,
  getPublicLinkPath,
  type LinkMode,
} from '@cleartg/shared';
import { CreateTrackingLinkDto } from './dto/create-tracking-link.dto';
import { UpdateTrackingLinkDto } from './dto/update-tracking-link.dto';
import { BulkCreateTrackingLinksDto } from './dto/bulk-create-tracking-links.dto';
import { Prisma } from '@cleartg/database';
import type { LandingPageContext } from './tracking-html';
import { resolveFrontendUrl } from '../common/public-app-url';

export type TrackingPageSource = 'landing_page' | 'shortlink_page';

export interface RecordClickResult {
  clickEvent: { id: string };
  pageContext: LandingPageContext;
  autoRedirect: boolean;
  redirectDelayMs: number;
  consent: ReturnType<typeof parseConsentFromQuery>;
  privacyPolicyUrl: string | null;
  /**
   * П.10 з ТЗ: канал недоступний (бота прибрали/зняли права) — клік вже
   * зафіксовано, але переходу в Telegram не буде. Контролер має показати
   * зрозумілу сторінку замість редиректу на непрацююче посилання.
   */
  channelUnavailable: boolean;
  channelTitle: string;
}

type LinkInput = Pick<
  CreateTrackingLinkDto,
  | 'channelId'
  | 'campaignId'
  | 'botConnectionId'
  | 'linkMode'
  | 'destinationMode'
  | 'landingPostUrl'
  | 'destinationUrl'
  | 'postNumber'
>;

/** https://t.me/username — особистий акаунт (S2-05). */
export function isTelegramUsernameUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 't.me' &&
      /^\/[A-Za-z][A-Za-z0-9_]{3,31}\/?$/.test(url.pathname) &&
      !url.search
    );
  } catch {
    return false;
  }
}

@Injectable()
export class TrackingService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    @Inject(forwardRef(() => InviteLinkService))
    private inviteLinks: InviteLinkService,
    @Optional() private conversion?: ConversionService,
  ) {}

  /**
   * Єдина перевірка вхідних даних посилання — для створення, редагування й
   * масового створення. Повертає вже нормалізовані значення.
   *
   * Канал і кампанія мають належати цьому кабінету: раніше `channelId` не
   * перевірявся, і посилання можна було прив'язати до чужого каналу.
   */
  private async validateLinkInput(
    workspaceId: string,
    input: LinkInput,
    existingLinkMode?: LinkMode,
  ): Promise<{ linkMode: LinkMode }> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: input.channelId, workspaceId },
      select: { id: true },
    });
    if (!channel) throw new BadRequestException('Канал не знайдено в цьому кабінеті.');

    let platform: string | null = null;
    if (input.campaignId) {
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: input.campaignId, workspaceId },
        select: { adPlatform: true, channelId: true },
      });
      if (!campaign) throw new BadRequestException('Кампанію не знайдено в цьому кабінеті.');
      if (campaign.channelId !== input.channelId) {
        throw new BadRequestException('Кампанія належить іншому каналу — оберіть кампанію цього каналу.');
      }
      platform = campaign.adPlatform;
    }

    const destinationMode = input.destinationMode ?? 'INVITE_LINK';

    if (destinationMode === 'CLIENT_BOT_START' && !input.botConnectionId) {
      throw new BadRequestException('Оберіть підключеного бота, куди вестиме посилання.');
    }
    if (input.botConnectionId) {
      const botConnection = await this.prisma.telegramBotConnection.findFirst({
        where: { id: input.botConnectionId, workspaceId },
        select: { isActive: true },
      });
      if (!botConnection) {
        throw new BadRequestException('Бота не знайдено в цьому кабінеті.');
      }
      if (destinationMode === 'CLIENT_BOT_START' && !botConnection.isActive) {
        throw new BadRequestException('Цей бот відключений. Перепідключіть його в розділі «Канали».');
      }
    }

    if (destinationMode === 'PERSONAL_CHAT') {
      if (!input.destinationUrl || !isTelegramUsernameUrl(input.destinationUrl)) {
        throw new BadRequestException(
          'Вкажіть особистий акаунт у форматі https://t.me/username.',
        );
      }
    }

    if (destinationMode === 'PUBLIC_POST' && !input.postNumber && !input.landingPostUrl) {
      // Без жодного з двох — посилання мовчки відкриє канал цілком, а користувач
      // думатиме, що веде на конкретний пост. Краще відмовити одразу.
      throw new BadRequestException(
        'Для переходу на конкретний пост вкажіть його номер (або повне посилання на пост).',
      );
    }
    if (destinationMode === 'PUBLIC_POST' && input.landingPostUrl) {
      let postUrl: URL;
      try {
        postUrl = new URL(input.landingPostUrl);
      } catch {
        throw new BadRequestException('Вкажіть коректне посилання на допис у Telegram.');
      }
      if (postUrl.protocol !== 'https:' || postUrl.hostname.toLowerCase() !== 't.me') {
        throw new BadRequestException('Посилання на допис має вести на https://t.me/.');
      }
    }

    // Режим (/l/ чи /r/) вшитий в адресу, яка вже може стояти в рекламі, тож
    // при редагуванні він не змінюється. Перевіряємо лише головне правило:
    // коротке посилання не можна віддати під платний трафік.
    if (existingLinkMode) {
      if (existingLinkMode === 'SHORTLINK' && isPaidAdPlatform(platform)) {
        throw new BadRequestException(
          'Це коротке посилання не можна віддати під Meta, Google чи TikTok — для платної реклами потрібна сторінка переходу. Створіть нове посилання під цю кампанію.',
        );
      }
      return { linkMode: existingLinkMode };
    }

    const linkMode: LinkMode = input.linkMode ?? resolveDefaultLinkMode(platform as never);
    const validation = validateLinkModeForPlatform(linkMode, platform as never);
    if (!validation.valid) throw new BadRequestException(validation.reason);

    return { linkMode };
  }

  private linkData(dto: CreateTrackingLinkDto, linkMode: LinkMode) {
    return {
      channelId: dto.channelId,
      campaignId: dto.campaignId,
      botConnectionId: dto.botConnectionId,
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
      postNumber: dto.postNumber,
      creativeTag: dto.creativeTag,
    } satisfies Omit<Prisma.TrackingLinkUncheckedCreateInput, 'workspaceId' | 'slug'>;
  }

  async createLink(workspaceId: string, dto: CreateTrackingLinkDto) {
    const { linkMode } = await this.validateLinkInput(workspaceId, dto);

    const link = await this.prisma.trackingLink.create({
      data: { workspaceId, slug: generateSlug(10), ...this.linkData(dto, linkMode) },
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

  /**
   * S2-09: пачка посилань однією операцією. Спільні налаштування
   * перевіряються один раз, а всі посилання створюються в одній транзакції —
   * або всі, або жодного.
   */
  async createLinksBulk(workspaceId: string, dto: BulkCreateTrackingLinksDto) {
    const { linkMode } = await this.validateLinkInput(workspaceId, dto.base);

    const names = dto.items.map((item) => item.name.trim());
    if (names.some((name) => !name)) {
      throw new BadRequestException('У кожного посилання має бути назва.');
    }
    if (new Set(names.map((n) => n.toLocaleLowerCase('uk-UA'))).size !== names.length) {
      throw new BadRequestException('Назви посилань у пачці повторюються — зробіть їх різними.');
    }

    const links = await this.prisma.$transaction(
      dto.items.map((item, index) =>
        this.prisma.trackingLink.create({
          data: {
            workspaceId,
            slug: generateSlug(10),
            ...this.linkData(
              {
                ...dto.base,
                name: names[index],
                creativeTag: item.creativeTag?.trim() || dto.base.creativeTag,
                utmContent: item.utmContent?.trim() || dto.base.utmContent,
              },
              linkMode,
            ),
          },
        }),
      ),
    );

    return links.map((link) => ({
      ...link,
      publicPath: getPublicLinkPath(link.linkMode as LinkMode, link.slug),
    }));
  }

  /**
   * S2-07 / S2-18: редагування без втрати історії. Адреса, канал і режим
   * посилання не змінюються (див. UpdateTrackingLinkDto), тому вже запущена
   * реклама продовжує працювати, а історичні кліки лишаються з цим посиланням.
   */
  async updateLink(workspaceId: string, id: string, dto: UpdateTrackingLinkDto) {
    const existing = await this.prisma.trackingLink.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundException('Посилання не знайдено');

    const changes: Prisma.TrackingLinkUncheckedUpdateInput = {};
    const nullable = [
      'name', 'campaignId', 'botConnectionId', 'landingPostUrl', 'destinationUrl', 'postNumber',
      'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'creativeTag',
    ] as const;
    for (const key of nullable) {
      const value = dto[key];
      if (value === undefined) continue;
      (changes as Record<string, unknown>)[key] =
        typeof value === 'string' ? value.trim() || null : value;
    }
    if (dto.destinationMode !== undefined) changes.destinationMode = dto.destinationMode;
    if (dto.autoRedirect !== undefined) changes.autoRedirect = dto.autoRedirect;
    if (dto.redirectDelayMs !== undefined) changes.redirectDelayMs = dto.redirectDelayMs;

    const merged = { ...existing, ...changes } as typeof existing;
    await this.validateLinkInput(
      workspaceId,
      {
        channelId: existing.channelId,
        campaignId: merged.campaignId ?? undefined,
        botConnectionId: merged.botConnectionId ?? undefined,
        destinationMode: merged.destinationMode,
        landingPostUrl: merged.landingPostUrl ?? undefined,
        destinationUrl: merged.destinationUrl ?? undefined,
        postNumber: merged.postNumber ?? undefined,
      },
      existing.linkMode as LinkMode,
    );

    const link = await this.prisma.trackingLink.update({
      where: { id },
      data: changes,
      include: {
        channel: { select: { id: true, title: true } },
        campaign: { select: { id: true, name: true, adPlatform: true } },
        _count: { select: { clickEvents: true } },
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

  /**
   * "Видалення" посилання — це деактивація (isActive=false), а НЕ DELETE рядка.
   * ClickEvent.trackingLinkId має onDelete: Cascade — фізичне видалення TrackingLink
   * знищило б усю історію кліків/аналітики по ньому. Деактивована посилання просто
   * перестає приймати нові кліки (getLinkBySlug кидає 404), історія лишається.
   */
  async setActive(workspaceId: string, id: string, isActive: boolean) {
    const link = await this.prisma.trackingLink.findFirst({ where: { id, workspaceId } });
    if (!link) throw new NotFoundException('Tracking link not found');

    return this.prisma.trackingLink.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Фізичне видалення посилання (на відміну від setActive/архівації вище).
   * Дозволено лише коли по посиланню ще немає жодного кліку: ClickEvent.trackingLinkId
   * має onDelete: Cascade, тож видалення посилання зі статистикою назавжди знищило б
   * її. Якщо кліки вже є — відмовляємо і пропонуємо архівувати замість видалення.
   */
  async deleteLink(workspaceId: string, id: string) {
    const link = await this.prisma.trackingLink.findFirst({
      where: { id, workspaceId },
      include: { _count: { select: { clickEvents: true } } },
    });
    if (!link) throw new NotFoundException('Tracking link not found');

    if (link._count.clickEvents > 0) {
      throw new BadRequestException(
        `Це посилання вже має ${link._count.clickEvents} клік(ів) — видалення знищить цю статистику назавжди. Заархівуйте посилання, якщо просто хочете прибрати його з активних.`,
      );
    }

    await this.prisma.trackingLink.delete({ where: { id } });
  }

  async getLinkBySlug(slug: string) {
    const link = await this.prisma.trackingLink.findUnique({
      where: { slug },
      include: {
        channel: true,
        campaign: true,
        botConnection: { select: { botUsername: true } },
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
        // S2-10/S2-11: перехід у Telegram підтверджує лише натискання кнопки на
        // сторінці. При автоматичному редиректі (миттєвому чи із затримкою) це
        // не вимірюється — такий клік не входить у частку «дійшли».
        reachTracked: !link.autoRedirect,
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
    const apiOrigin = resolveFrontendUrl();
    const pageContext = this.buildPageContext(link, telegramUrl ?? 'https://t.me', clickEvent.id, apiOrigin);
    pageContext.adTags = await this.resolveAdTags(link.workspaceId, consent);

    /**
     * Раніше при миттєвому редиректі сервер сам ставив telegramOpenedAt — і
     * частка «дійшли до Telegram» для таких посилань завжди була ~100%, тобто
     * нічого не показувала. Тепер такий клік просто позначено reachTracked=false
     * (див. вище), а факт відкриття ставить лише маячок з кнопки на сторінці.
     */
    if (telegramUrl === null && link.autoRedirect) {
      // Канал недоступний — людина точно не дійшла, і це відомо напевно.
      await this.prisma.clickEvent.update({
        where: { id: clickEvent.id },
        data: { reachTracked: true },
      });
    }

    return {
      clickEvent,
      pageContext,
      autoRedirect: link.autoRedirect,
      redirectDelayMs: link.redirectDelayMs,
      consent,
      privacyPolicyUrl: link.workspace.privacyPolicyUrl,
      channelUnavailable: telegramUrl === null,
      channelTitle: link.channel.title,
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
    clickId?: string,
    apiOrigin?: string,
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
      clickId,
      apiOrigin,
    };
  }

  /**
   * S3-13: які рекламні теги можна поставити на сторінці переходу — лише
   * увімкнені інтеграції і лише з дозволу людини для цієї платформи.
   */
  private async resolveAdTags(workspaceId: string, consent: ReturnType<typeof parseConsentFromQuery>) {
    if (!consent.meta_allowed && !consent.ga4_allowed) return undefined;
    const [meta, ga4] = await Promise.all([
      consent.meta_allowed
        ? this.prisma.metaIntegration.findFirst({ where: { workspaceId, isActive: true }, select: { pixelId: true } })
        : null,
      consent.ga4_allowed
        ? this.prisma.gA4Integration.findFirst({ where: { workspaceId, isActive: true }, select: { measurementId: true } })
        : null,
    ]);
    if (!meta && !ga4) return undefined;
    return { metaPixelId: meta?.pixelId, ga4MeasurementId: ga4?.measurementId };
  }

  /**
   * S3-13: cookies _fbp / _ga зі сторінки переходу. Приймаємо лише для свіжого
   * кліку (до 30 хв), у суворому форматі і без перезапису вже відомих значень —
   * сторонній запит не може підмінити ідентифікатори.
   */
  async recordIdentity(clickId: string, data: { fbp?: unknown; gaClientId?: unknown; gaSessionId?: unknown }) {
    const click = await this.prisma.clickEvent.findUnique({
      where: { id: clickId },
      select: { clickedAt: true, fbp: true, gaClientId: true, gaSessionId: true },
    });
    if (!click || Date.now() - click.clickedAt.getTime() > 30 * 60 * 1000) return { ok: true };

    const update: { fbp?: string; gaClientId?: string; gaSessionId?: string } = {};
    if (!click.fbp && typeof data.fbp === 'string' && /^fb\.\d\.\d{10,13}\.\d{1,25}$/.test(data.fbp)) {
      update.fbp = data.fbp;
    }
    if (!click.gaClientId && typeof data.gaClientId === 'string' && /^\d{1,12}\.\d{9,11}$/.test(data.gaClientId)) {
      update.gaClientId = data.gaClientId;
    }
    if (!click.gaSessionId && typeof data.gaSessionId === 'string' && /^\d{9,11}$/.test(data.gaSessionId)) {
      update.gaSessionId = data.gaSessionId;
    }
    if (Object.keys(update).length > 0) {
      await this.prisma.clickEvent.update({ where: { id: clickId }, data: update });
    }
    return { ok: true };
  }

  async recordTelegramOpen(clickId: string) {
    const click = await this.prisma.clickEvent.findUnique({
      where: { id: clickId },
      include: { trackingLink: true, campaign: true },
    });
    if (!click || click.telegramOpenedAt) return { ok: true, duplicate: true };

    await this.prisma.clickEvent.update({
      where: { id: clickId },
      data: { telegramOpenedAt: new Date() },
    });

    // S3-12: окрема ціль «дійшов до Telegram». Збій тут не повинен ламати маячок.
    await this.conversion?.createReachEvent(clickId).catch(() => null);

    return { ok: true };
  }

  /**
   * Скрипт для сайту клієнта: підміняє посилання t.me на наше трекінгове.
   * S3-14: перед переходом перевіряє, що ClearTG відповідає (до 1,5 с). Якщо ні —
   * людина йде за початковим t.me-посиланням: аналітика не ламає трафік.
   */
  getEmbedScript() {
    return `(function(){var s=document.currentScript;var slug=s&&s.getAttribute("data-slug");var app=(s&&s.getAttribute("data-app-url"))||"";var path=(s&&s.getAttribute("data-path"))||("/l/"+slug);if(!slug||!app)return;var base=app.replace(/\\/$/,"");function go(original){var q=new URLSearchParams(location.search);q.set("ctg_fallback",original);var u=base+path+(q.toString()?"?"+q:"");var done=false;function to(url){if(done)return;done=true;location.href=url;}var timer=setTimeout(function(){to(original);},1500);try{fetch(base+"/api/tracking/ping",{cache:"no-store"}).then(function(r){clearTimeout(timer);to(r.ok?u:original);},function(){clearTimeout(timer);to(original);});}catch(e){clearTimeout(timer);to(original);}}function bind(root){(root||document).querySelectorAll('a[href*="t.me/"]').forEach(function(a){if(a.dataset.ctg)return;a.dataset.ctg="1";a.addEventListener("click",function(e){e.preventDefault();go(a.href);});});}function start(){bind(document);if(window.MutationObserver)new MutationObserver(function(){bind(document);}).observe(document.documentElement,{childList:true,subtree:true});}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();})();`;
  }

  async getEmbedSnippet(workspaceId: string, slug: string) {
    const link = await this.prisma.trackingLink.findFirst({
      where: { workspaceId, slug, isActive: true },
      include: { channel: { select: { title: true } } },
    });
    if (!link) throw new NotFoundException('Tracking link not found');

    const appUrl = resolveFrontendUrl();
    const publicPath = getPublicLinkPath(link.linkMode as LinkMode, link.slug);

    return {
      slug: link.slug,
      channelTitle: link.channel.title,
      appUrl,
      scriptTag: `<script src="${appUrl}/cleartg.js" data-slug="${link.slug}" data-app-url="${appUrl}" data-path="${publicPath}" defer></script>`,
      directLink: `${appUrl}${publicPath}`,
      hint: 'Вставте скрипт перед </body> на Tilda, Taplink, WordPress або іншому лендингу. Посилання t.me/ будуть вести через tracking.',
    };
  }

  /**
   * Повертає `null`, коли перехід у Telegram фізично неможливо побудувати —
   * бота прибрали з каналу (або зняли права), invite-лінка не створюється,
   * а публічного `@username` для запасного посилання теж немає (п.10 з ТЗ).
   * Раніше в цьому випадку повертався мертвий рядок `t.me/channel` — людина
   * тихо впиралась у неробочу посилання без жодного пояснення.
   */
  private async resolveDestination(
    link: {
      destinationMode: string;
      landingPostUrl: string | null;
      destinationUrl: string | null;
      postNumber: number | null;
      usePerClickInvite: boolean;
      workspaceId: string;
      channelId: string;
      campaignId: string | null;
      id: string;
      channel: {
        username: string | null;
        telegramChatId: string;
        botIsAdmin: boolean;
        joinRequestsEnabled: boolean;
      };
      botConnection: { botUsername: string } | null;
    },
    clickId: string,
  ): Promise<string | null> {
    const shouldUseInvite =
      link.usePerClickInvite && link.destinationMode === 'INVITE_LINK' && link.channel.botIsAdmin;

    if (shouldUseInvite) {
      const invite = await this.inviteLinks.createForClick({
        clickEventId: clickId,
        workspaceId: link.workspaceId,
        channelId: link.channelId,
        campaignId: link.campaignId,
        trackingLinkId: link.id,
        telegramChatId: link.channel.telegramChatId,
        createsJoinRequest: link.channel.joinRequestsEnabled,
      });
      if (invite) return invite.telegramInviteLink;
    }

    switch (link.destinationMode) {
      case 'PUBLIC_POST': {
        if (link.landingPostUrl) return link.landingPostUrl;
        // t.me/c/... працює лише для тих, хто вже в каналі (Telegram не вміє
        // відкрити конкретний пост закритого каналу людині ззовні) — але це
        // все одно краще, ніж порожній екран, якщо публічного username немає.
        const base = link.channel.username
          ? `https://t.me/${link.channel.username}`
          : `https://t.me/c/${link.channel.telegramChatId.replace('-100', '')}`;
        return link.postNumber ? `${base}/${link.postNumber}` : base;
      }
      case 'INVITE_LINK':
        if (link.destinationUrl) return link.destinationUrl;
        // Публічний канал — t.me/username все одно робочий, навіть без
        // нашого бота (просто без per-click атрибуції). Приватний канал без
        // username і без бота — робочого посилання побудувати нема з чого.
        return link.channel.username ? `https://t.me/${link.channel.username}` : null;
      case 'BOT_START':
        return `https://t.me/${process.env.TELEGRAM_BOT_USERNAME ?? 'cleartg_bot'}?start=click_${clickId}`;
      case 'CLIENT_BOT_START':
        // Блок 1.2 ТЗ: перехід у бота КЛІЄНТА (не наш), короткий код замість
        // повного набору UTM (ліміт Telegram — 64 символи на payload).
        if (!link.botConnection) return 'https://t.me';
        return `https://t.me/${link.botConnection.botUsername}?start=click_${clickId}`;
      case 'EXTERNAL_URL':
        return link.destinationUrl ?? 'https://t.me';
      case 'PERSONAL_CHAT':
        // Особистий акаунт — не бот, доступу до листування нема і не буде.
        // Фіксуємо лише сам факт кліку/переходу, як і для EXTERNAL_URL.
        return link.destinationUrl ?? 'https://t.me';
      default:
        return link.landingPostUrl ?? 'https://t.me';
    }
  }

  getDefaultConsent() {
    return DEFAULT_CONSENT;
  }
}
