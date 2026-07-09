import { Controller, Get, Param, Post, Body, Req, Res, Header } from '@nestjs/common';

type TrackingReply = {
  redirect(url: string): unknown;
  header(name: string, value: string): TrackingReply;
};
import { TrackingService } from './tracking.service';
import { CreateTrackingLinkDto } from './dto/create-tracking-link.dto';
import { Public, RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';
import { renderLandingPage, renderShortlinkPage, renderRedirectPage } from './tracking-html';
import type { RecordClickResult } from './tracking.service';

type RequestWithMeta = {
  query: Record<string, string>;
  headers: Record<string, string>;
  ip?: string;
};

function extractRequestMeta(req: RequestWithMeta) {
  return {
    ip: req.ip ?? req.headers['x-forwarded-for']?.split(',')[0],
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'],
  };
}

function respondToClick(result: RecordClickResult, reply: TrackingReply) {
  const { pageContext, autoRedirect, redirectDelayMs } = result;

  if (autoRedirect && redirectDelayMs === 0) {
    return reply.redirect(pageContext.telegramUrl);
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
    const result = await this.tracking.recordClick(
      slug,
      req.query as Record<string, string | undefined>,
      extractRequestMeta(req),
      'landing_page',
      'LANDING_PAGE',
    );

    const body = respondToClick(result, reply);
    if (typeof body === 'string') {
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return body;
    }
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
    const result = await this.tracking.recordClick(
      slug,
      req.query as Record<string, string | undefined>,
      extractRequestMeta(req),
      'shortlink_page',
      'SHORTLINK',
    );

    const body = respondToClick(result, reply);
    if (typeof body === 'string') {
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return body;
    }
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
