import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../crypto/crypto.service';
import { GoogleAdsOAuthService } from './google-ads-oauth.service';
import { ConversionPayload, DeliveryResult } from '../meta/meta.service';
import {
  buildUploadClickConversionBody,
  canUploadGoogleConversion,
} from '@cleartg/shared';

const API_VERSION = 'v18';

@Injectable()
export class GoogleAdsService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private oauth: GoogleAdsOAuthService,
    private config: ConfigService,
  ) {}

  async upsertIntegration(
    workspaceId: string,
    data: {
      customerId: string;
      conversionActionId: string;
      managerAccountId?: string;
      oauthCredentialsEnc?: string;
    },
  ) {
    const customerId = data.customerId.replace(/-/g, '');
    const existing = await this.prisma.googleAdsIntegration.findFirst({ where: { workspaceId } });

    const oauthCredentialsEnc =
      data.oauthCredentialsEnc ??
      existing?.oauthCredentialsEnc ??
      this.crypto.encrypt(JSON.stringify({ access_token: '', expires_at: 0 }));

    if (existing) {
      return this.prisma.googleAdsIntegration.update({
        where: { id: existing.id },
        data: {
          customerId,
          conversionActionId: data.conversionActionId,
          managerAccountId: data.managerAccountId?.replace(/-/g, ''),
          oauthCredentialsEnc,
        },
      });
    }

    return this.prisma.googleAdsIntegration.create({
      data: {
        workspaceId,
        customerId,
        conversionActionId: data.conversionActionId,
        managerAccountId: data.managerAccountId?.replace(/-/g, ''),
        oauthCredentialsEnc,
      },
    });
  }

  async saveOAuthTokens(workspaceId: string, tokensEnc: string) {
    const existing = await this.prisma.googleAdsIntegration.findFirst({ where: { workspaceId } });
    if (!existing) {
      throw new Error('Create Google Ads integration settings before OAuth connect');
    }
    return this.prisma.googleAdsIntegration.update({
      where: { id: existing.id },
      data: { oauthCredentialsEnc: tokensEnc },
    });
  }

  async getIntegration(workspaceId: string) {
    const integration = await this.prisma.googleAdsIntegration.findFirst({ where: { workspaceId } });
    if (!integration) return null;

    let oauthConnected = false;
    try {
      const tokens = this.oauth.decryptTokens(integration.oauthCredentialsEnc);
      oauthConnected = !!(tokens.refresh_token || tokens.access_token);
    } catch {
      oauthConnected = false;
    }

    return {
      id: integration.id,
      customerId: integration.customerId,
      conversionActionId: integration.conversionActionId,
      managerAccountId: integration.managerAccountId,
      isActive: integration.isActive,
      oauthConnected,
    };
  }

  async sendEvent(workspaceId: string, payload: ConversionPayload): Promise<DeliveryResult> {
    const integration = await this.prisma.googleAdsIntegration.findFirst({
      where: { workspaceId, isActive: true },
    });
    if (!integration) {
      return { success: false, error: 'No active Google Ads integration' };
    }

    const developerToken = this.config.get<string>('GOOGLE_ADS_DEVELOPER_TOKEN');
    if (!developerToken) {
      return { success: false, error: 'GOOGLE_ADS_DEVELOPER_TOKEN not configured' };
    }

    const conversionInput = {
      customerId: integration.customerId,
      conversionActionId: integration.conversionActionId,
      eventTime: payload.eventTime,
      eventId: payload.eventId,
      currency: 'UAH',
      gclid: payload.click?.gclid,
      gbraid: payload.click?.gbraid,
      wbraid: payload.click?.wbraid,
      externalIdHash: payload.externalIdHash,
      consentAdUserDataGranted: payload.consent.ad_user_data === 'granted',
    };

    if (!canUploadGoogleConversion(conversionInput)) {
      return {
        success: false,
        error: 'skipped_no_identifier: no gclid/gbraid/wbraid or permitted user identifier',
      };
    }

    if (payload.consent.ad_personalization === 'denied') {
      return {
        success: false,
        error: 'skipped_policy_restriction: ad_personalization denied',
      };
    }

    const requestBody = buildUploadClickConversionBody(conversionInput);

    try {
      const { accessToken, updatedEnc } = await this.oauth.getValidAccessToken(
        integration.oauthCredentialsEnc,
      );

      if (updatedEnc) {
        await this.prisma.googleAdsIntegration.update({
          where: { id: integration.id },
          data: { oauthCredentialsEnc: updatedEnc },
        });
      }

      const customerId = integration.customerId.replace(/-/g, '');
      const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}:uploadClickConversions`;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      };

      if (integration.managerAccountId) {
        headers['login-customer-id'] = integration.managerAccountId.replace(/-/g, '');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const responseBody = await response.json().catch(() => ({}));

      const partialErrors = responseBody?.partialFailureError?.details;
      const hasPartialFailure = Array.isArray(partialErrors) && partialErrors.length > 0;

      return {
        success: response.ok && !hasPartialFailure,
        requestPayload: requestBody,
        responseStatus: response.status,
        responseBody,
        error: response.ok
          ? hasPartialFailure
            ? JSON.stringify(partialErrors)
            : undefined
          : JSON.stringify(responseBody),
      };
    } catch (err) {
      return {
        success: false,
        requestPayload: requestBody,
        error: err instanceof Error ? err.message : 'Unknown Google Ads error',
      };
    }
  }

  async sendTestEvent(workspaceId: string) {
    return this.sendEvent(workspaceId, {
      eventName: 'TG_Subscribe',
      eventTime: new Date(),
      eventId: `test_gads_${Date.now()}`,
      consent: {
        analytics_storage: 'granted',
        marketing_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        meta_allowed: true,
        google_allowed: true,
        tiktok_allowed: true,
        ga4_allowed: true,
      },
      click: { gclid: 'TEST_GCLID_CLEARTG_DEV' },
      externalIdHash: 'test_external_id_hash',
    });
  }
}
