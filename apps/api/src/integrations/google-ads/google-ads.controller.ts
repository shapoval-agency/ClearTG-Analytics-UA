import { Controller, Get, Post, Body, Query, Res, HttpStatus } from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { GoogleAdsOAuthService } from './google-ads-oauth.service';
import { RequiresWorkspace, Public } from '../../common/decorators/auth.decorator';
import { WorkspaceId } from '../../common/decorators/user.decorator';
import { IsOptional, IsString } from 'class-validator';
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
      return res.redirect(HttpStatus.FOUND, `${appUrl}/integrations/google-ads?error=oauth_denied`);
    }

    try {
      const { workspaceId, tokens } = await this.oauth.exchangeCode(code, state);
      const tokensEnc = this.oauth.encryptTokens(tokens);
      await this.googleAds.saveOAuthTokens(workspaceId, tokensEnc);
      return res.redirect(HttpStatus.FOUND, `${appUrl}/integrations/google-ads?connected=1`);
    } catch {
      return res.redirect(HttpStatus.FOUND, `${appUrl}/integrations/google-ads?error=oauth_failed`);
    }
  }

  @RequiresWorkspace()
  @Post('test-event')
  testEvent(@WorkspaceId() workspaceId: string) {
    return this.googleAds.sendTestEvent(workspaceId);
  }
}
