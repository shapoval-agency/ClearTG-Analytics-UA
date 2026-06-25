import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../crypto/crypto.service';
import { ConversionPayload, DeliveryResult } from '../meta/meta.service';
import {
  buildTikTokEventPayload,
  canSendTikTokEvent,
  isTikTokSuccessResponse,
} from '@cleartg/shared';

const TIKTOK_EVENTS_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

@Injectable()
export class TikTokService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async sendEvent(workspaceId: string, payload: ConversionPayload): Promise<DeliveryResult> {
    const integration = await this.prisma.tikTokIntegration.findFirst({
      where: { workspaceId, isActive: true },
    });
    if (!integration) {
      return { success: false, error: 'No active TikTok integration' };
    }

    const eventInput = {
      pixelId: integration.pixelId,
      eventName: payload.eventName,
      eventTime: payload.eventTime,
      eventId: payload.eventId,
      ttclid: payload.click?.ttclid,
      ttp: payload.click?.ttp,
      externalIdHash: payload.externalIdHash,
      consentAdUserDataGranted: payload.consent.ad_user_data === 'granted',
      testEventCode: integration.testEventCode,
    };

    if (!canSendTikTokEvent(eventInput)) {
      return {
        success: false,
        error: 'skipped_no_identifier: no ttclid/ttp or permitted external_id',
      };
    }

    if (payload.consent.ad_personalization === 'denied') {
      return {
        success: false,
        error: 'skipped_policy_restriction: ad_personalization denied',
      };
    }

    const accessToken = this.crypto.decrypt(integration.accessTokenEnc);
    const requestBody = buildTikTokEventPayload(eventInput);

    try {
      const response = await fetch(TIKTOK_EVENTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': accessToken,
        },
        body: JSON.stringify(requestBody),
      });

      const responseBody = await response.json();

      return {
        success: response.ok && isTikTokSuccessResponse(responseBody),
        requestPayload: requestBody,
        responseStatus: response.status,
        responseBody,
        error:
          response.ok && isTikTokSuccessResponse(responseBody)
            ? undefined
            : JSON.stringify(responseBody),
      };
    } catch (err) {
      return {
        success: false,
        requestPayload: requestBody,
        error: err instanceof Error ? err.message : 'Unknown TikTok error',
      };
    }
  }

  async sendTestEvent(workspaceId: string) {
    return this.sendEvent(workspaceId, {
      eventName: 'TG_Subscribe',
      eventTime: new Date(),
      eventId: `test_tiktok_${Date.now()}`,
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
      click: { ttclid: 'TEST_TTCLID_CLEARTG_DEV' },
      externalIdHash: 'test_external_id_hash',
    });
  }

  async upsertIntegration(
    workspaceId: string,
    data: { pixelId: string; accessToken: string; testEventCode?: string },
  ) {
    const existing = await this.prisma.tikTokIntegration.findFirst({ where: { workspaceId } });
    const accessTokenEnc = this.crypto.encrypt(data.accessToken);

    if (existing) {
      return this.prisma.tikTokIntegration.update({
        where: { id: existing.id },
        data: {
          pixelId: data.pixelId,
          accessTokenEnc,
          testEventCode: data.testEventCode,
        },
      });
    }

    return this.prisma.tikTokIntegration.create({
      data: {
        workspaceId,
        pixelId: data.pixelId,
        accessTokenEnc,
        testEventCode: data.testEventCode,
      },
    });
  }

  async getIntegration(workspaceId: string) {
    const integration = await this.prisma.tikTokIntegration.findFirst({ where: { workspaceId } });
    if (!integration) return null;
    return {
      id: integration.id,
      pixelId: integration.pixelId,
      testEventCode: integration.testEventCode,
      isActive: integration.isActive,
      hasAccessToken: !!integration.accessTokenEnc,
    };
  }
}
