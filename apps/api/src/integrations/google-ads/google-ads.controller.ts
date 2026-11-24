import { Controller, Get, Post, Body, Query, Res, HttpStatus } from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { GoogleAdsOAuthService } from './google-ads-oauth.service';
import { RequiresWorkspace, Public } from '../../common/decorators/auth.decorator';
import { WorkspaceId } from '../../common/decorators/user.decorator';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { resolveFrontendUrl } from '../../common/public-app-url';

class UpsertGoogleAdsDto {
  @IsString()
  customerId!: string;

  @IsString()
  conversionActionId!: string;

  @IsOptional()
  @IsString()
  managerAccountId?: string;

  /** S3-12: окрема дія-конверсія для «дійшов до Telegram». */
  @IsOptional()
  @IsString()
  reachConversionActionId?: string;

  /** S3-16: окрема дія-конверсія для «забрав подарок». */
  @IsOptional()
  @IsString()
  giftConversionActionId?: string;
}

class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

@Controller('api/integrations/google-ads')
export class GoogleAdsController {
  constructor(
    private googleAds: GoogleAdsService,
    private oauth: GoogleAdsOAuthService,
    private config: ConfigService,
  ) {}

  @RequiresWorkspace()
  @Get()
  get(@WorkspaceId() workspaceId: string) {
    return this.googleAds.getIntegration(workspaceId);
  }

  @RequiresWorkspace()
  @Post()
  upsert(@Body() dto: UpsertGoogleAdsDto, @WorkspaceId() workspaceId: string) {
    return this.googleAds.upsertIntegration(workspaceId, dto);
  }

  @RequiresWorkspace()
  @Get('auth-url')
  authUrl(@WorkspaceId() workspaceId: string) {
    return { url: this.oauth.getAuthUrl(workspaceId) };
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: { redirect: (statusCode: number, url: string) => void },
  ) {
    const appUrl = resolveFrontendUrl(this.config);

    if (error || !code || !state) {
      return res.redirect(HttpStatus.FOUND, `${appUrl}/v2/ads?google=oauth_denied`);
    }

    try {
      const { workspaceId, tokens } = await this.oauth.exchangeCode(code, state);
      const tokensEnc = this.oauth.encryptTokens(tokens);
      await this.googleAds.saveOAuthTokens(workspaceId, tokensEnc);
      return res.redirect(HttpStatus.FOUND, `${appUrl}/v2/ads?google=connected`);
    } catch {
      return res.redirect(HttpStatus.FOUND, `${appUrl}/v2/ads?google=oauth_failed`);
    }
  }

  /** Перевірка до запуску (S3-01). */
  @RequiresWorkspace()
  @Post('verify')
  verify(@WorkspaceId() workspaceId: string) {
    return this.googleAds.verify(workspaceId);
  }

  /** Увімкнути / вимкнути відправку (S3-03); вмикається лише після перевірки. */
  @RequiresWorkspace()
  @Post('active')
  setActive(@Body() dto: SetActiveDto, @WorkspaceId() workspaceId: string) {
    return this.googleAds.setActive(workspaceId, dto.isActive);
  }

  @RequiresWorkspace()
  @Post('test-event')
  testEvent(@WorkspaceId() workspaceId: string) {
    return this.googleAds.sendTestEvent(workspaceId);
  }
}
