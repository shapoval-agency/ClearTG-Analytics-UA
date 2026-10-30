import { Controller, Get, Param, Patch, Post, Delete, Body, Req, Res, Header } from '@nestjs/common';

type TrackingReply = {
  redirect(code: number, url: string): unknown;
  header(name: string, value: string): TrackingReply;
};
import { TrackingService } from './tracking.service';
import { CreateTrackingLinkDto } from './dto/create-tracking-link.dto';
import { Public, RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';
import {
  renderLandingPage,
  renderShortlinkPage,
  renderRedirectPage,
  renderChannelUnavailablePage,
  renderTrackingPreviewPage,
} from './tracking-html';
import type { RecordClickResult } from './tracking.service';

type RequestWithMeta = {
  method?: string;
  query: Record<string, string | undefined>;
  headers: Record<string, string>;
  ip?: string;
};

const LINK_PREVIEW_USER_AGENT =
  /bot\b|crawler|spider|facebookexternalhit|slack-imgproxy|discordbot|whatsapp|skypeuripreview|viber|vkshare|linkpreview|embedly|iframely/i;

/**
 * Preview crawlers and browser prefetches request the public URL before the
 * person actually opens it. Counting those GETs turns one desktop transition
 * into two clicks. We only exclude explicit preview/prefetch signals; a second
 * real navigation (even from the same device) remains a real click per the ТЗ.
 */
export function isAutomatedPreviewRequest(
  headers: Record<string, string | undefined>,
  method = 'GET',
): boolean {
  const userAgent = headers['user-agent'] ?? '';
  const purpose = [headers['purpose'], headers['sec-purpose'], headers['x-purpose'], headers['x-moz']]
    .filter(Boolean)
    .join(' ');

  return method.toUpperCase() === 'HEAD' ||
    LINK_PREVIEW_USER_AGENT.test(userAgent) ||
    /\b(prefetch|preview)\b/i.test(purpose);
}

function extractRequestMeta(req: RequestWithMeta) {
  return {
    ip: req.ip ?? req.headers['x-forwarded-for']?.split(',')[0],
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'],
  };
}

export function safeTelegramFallback(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 't.me' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function recordClickWithFallback(
  tracking: TrackingService,
  slug: string,
  req: RequestWithMeta,
  reply: TrackingReply,
  pageSource: 'landing_page' | 'shortlink_page',
  linkMode: 'LANDING_PAGE' | 'SHORTLINK',
) {
  try {
    return await tracking.recordClick(slug, req.query, extractRequestMeta(req), pageSource, linkMode);
  } catch (error) {
    const fallback = safeTelegramFallback(req.query.ctg_fallback);
    if (!fallback) throw error;
    reply.redirect(302, fallback);
    return null;
  }
}

async function renderPreviewIfNeeded(
  tracking: TrackingService,
  slug: string,
  req: RequestWithMeta,
  reply: TrackingReply,
  linkMode: 'LANDING_PAGE' | 'SHORTLINK',
): Promise<string | null> {
  if (!isAutomatedPreviewRequest(req.headers, req.method)) return null;

  const link = await tracking.getLinkBySlug(slug);
  tracking.assertLinkModeForRoute(link, linkMode);
  reply.header('Content-Type', 'text/html; charset=utf-8');
  reply.header('X-Robots-Tag', 'noindex, nofollow');

  return renderTrackingPreviewPage(
    link.landingTitle ?? link.channel.title,
    link.landingDescription ?? `Перехід до Telegram-каналу «${link.channel.title}».`,
  );
}

/**
 * `undefined` означає, що редирект уже надіслано напряму через reply.redirect() —
 * контролер НЕ повинен нічого повертати з handler'а після цього.
 *
 * Статус 302 передаємо ЯВНО другим аргументом. Nest виставляє статус відповіді 200
 * ще ДО виконання handler'а (незалежно від @Res passthrough), а Fastify-реалізація
 * reply.redirect(url) БЕЗ явного коду перевикористовує вже виставлений статус замість
 * дефолтного 302 — Location-заголовок був правильний, а статус лишався 200, тому
 * браузер ніколи не переходив за посиланням і просто лишався на пустій сторінці.
 */
function respondToClick(result: RecordClickResult, reply: TrackingReply): string | undefined {
  const { pageContext, autoRedirect, redirectDelayMs } = result;

  // П.10 з ТЗ: клік вже зафіксовано (recordClick), але Telegram-посилання
  // побудувати нема з чого (бота прибрали з приватного каналу без username) —
  // показуємо зрозумілу сторінку замість редиректу на неробоче посилання.
  if (result.channelUnavailable) {
    return renderChannelUnavailablePage(result.channelTitle);
  }

  if (autoRedirect && redirectDelayMs === 0) {
    reply.redirect(302, pageContext.telegramUrl);
    return undefined;
  }

  if (autoRedirect && redirectDelayMs > 0) {
    return renderRedirectPage(pageContext, Math.ceil(redirectDelayMs / 1000));
  }

  return pageContext.linkMode === 'SHORTLINK'
    ? renderShortlinkPage(pageContext)
    : renderLandingPage(pageContext);
}

@Public()
@Controller()
export class LandingPageController {
  constructor(private tracking: TrackingService) {}

  @Get('l/:slug')
  @Header('Cache-Control', 'no-store')
  async landingPage(
    @Param('slug') slug: string,
    @Req() req: RequestWithMeta,
    @Res({ passthrough: true }) reply: TrackingReply,
  ) {
    const preview = await renderPreviewIfNeeded(this.tracking, slug, req, reply, 'LANDING_PAGE');
    if (preview) return preview;

    const result = await recordClickWithFallback(
      this.tracking,
      slug,
      req,
      reply,
      'landing_page',
      'LANDING_PAGE',
    );
    if (!result) return;

    const body = respondToClick(result, reply);
    if (body === undefined) {
      // Редирект уже надіслано в respondToClick() — нічого більше не повертаємо.
      return;
    }
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return body;
  }
}

@Public()
@Controller()
export class ShortlinkController {
  constructor(private tracking: TrackingService) {}

  @Get('r/:slug')
  @Header('Cache-Control', 'no-store')
  async shortlinkPage(
    @Param('slug') slug: string,
    @Req() req: RequestWithMeta,
    @Res({ passthrough: true }) reply: TrackingReply,
  ) {
    const preview = await renderPreviewIfNeeded(this.tracking, slug, req, reply, 'SHORTLINK');
    if (preview) return preview;

    const result = await recordClickWithFallback(
      this.tracking,
      slug,
      req,
      reply,
      'shortlink_page',
      'SHORTLINK',
    );
    if (!result) return;

    const body = respondToClick(result, reply);
    if (body === undefined) {
      // Редирект уже надіслано в respondToClick() — нічого більше не повертаємо.
      return;
    }
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return body;
  }
}

@Controller('api/tracking-links')
export class TrackingLinksController {
  constructor(private tracking: TrackingService) {}

  @RequiresWorkspace()
  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.tracking.listLinks(workspaceId);
  }

  @RequiresWorkspace()
  @Get(':slug/embed')
  embedSnippet(@Param('slug') slug: string, @WorkspaceId() workspaceId: string) {
    return this.tracking.getEmbedSnippet(workspaceId, slug);
  }

  @RequiresWorkspace()
  @Post()
  create(@Body() dto: CreateTrackingLinkDto, @WorkspaceId() workspaceId: string) {
    return this.tracking.createLink(workspaceId, dto);
  }

  @RequiresWorkspace()
  @Patch(':id/archive')
  archive(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.tracking.setActive(workspaceId, id, false);
  }

  @RequiresWorkspace()
  @Patch(':id/activate')
  activate(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.tracking.setActive(workspaceId, id, true);
  }

  @RequiresWorkspace()
  @Delete(':id')
  delete(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.tracking.deleteLink(workspaceId, id);
  }
}

@Public()
@Controller()
export class CleartgScriptController {
  constructor(private tracking: TrackingService) {}

  @Get('cleartg.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  script() {
    return this.tracking.getEmbedScript();
  }
}

@Public()
@Controller('api/tracking')
export class TrackingOpenController {
  constructor(private tracking: TrackingService) {}

  @Post('open/:clickId')
  openTelegram(@Param('clickId') clickId: string) {
    return this.tracking.recordTelegramOpen(clickId);
  }
}
