import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../crypto/crypto.service';
import { ConsentSnapshot, buildFbcFromFbclid } from '@cleartg/shared';

export interface ConversionPayload {
  eventName: string;
  eventTime: Date;
  eventId: string;
  consent: ConsentSnapshot;
  click?: {
    fbclid?: string | null;
    fbp?: string | null;
    fbc?: string | null;
    gclid?: string | null;
    gbraid?: string | null;
    wbraid?: string | null;
    ttclid?: string | null;
    ttp?: string | null;
    gaClientId?: string | null;
    ipHash?: string | null;
    userAgentHash?: string | null;
  } | null;
  externalIdHash?: string | null;
}

export interface DeliveryResult {
  success: boolean;
  requestPayload?: unknown;
  responseStatus?: number;
  responseBody?: unknown;
  error?: string;
}

const META_EVENT_MAP: Record<string, string> = {
  TG_Subscribe: 'Lead',
  TG_Qualified_Subscribe_D1: 'QualifiedLead_D1',
  TG_Qualified_Subscribe_D7: 'QualifiedLead_D7',
  LeadMagnet_Claimed: 'LeadMagnetClaimed',
};

@Injectable()
export class MetaService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async sendEvent(workspaceId: string, payload: ConversionPayload): Promise<DeliveryResult> {
    const integration = await this.prisma.metaIntegration.findFirst({
      where: { workspaceId, isActive: true },
    });
    if (!integration) {
      return { success: false, error: 'No active Meta integration' };
    }

    const accessToken = this.crypto.decrypt(integration.accessTokenEnc);
    const metaEventName = META_EVENT_MAP[payload.eventName] ?? payload.eventName;

    const userData: Record<string, unknown> = {};
    if (payload.externalIdHash && payload.consent.ad_user_data === 'granted') {
      userData.external_id = [payload.externalIdHash];
    }
    if (payload.click?.fbp) userData.fbp = payload.click.fbp;
    const fbc = buildFbcFromFbclid(payload.click?.fbclid, payload.click?.fbc);
    if (fbc) userData.fbc = fbc;
    if (payload.click?.ipHash) userData.client_ip_address = payload.click.ipHash;
    if (payload.click?.userAgentHash) userData.client_user_agent = payload.click.userAgentHash;

    const eventData = {
      event_name: metaEventName,
      event_time: Math.floor(payload.eventTime.getTime() / 1000),
      event_id: payload.eventId,
      action_source: 'website',
      user_data: userData,
      custom_data: {
        content_name: payload.eventName,
      },
    };

    const body: Record<string, unknown> = {
      data: [eventData],
    };
    if (integration.testEventCode) {
      body.test_event_code = integration.testEventCode;
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${integration.pixelId}/events?access_token=${accessToken}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const responseBody = await response.json();

      return {
        success: response.ok,
        requestPayload: body,
        responseStatus: response.status,
        responseBody,
        error: response.ok ? undefined : JSON.stringify(responseBody),
      };
    } catch (err) {
      return {
        success: false,
        requestPayload: body,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async sendTestEvent(workspaceId: string) {
    return this.sendEvent(workspaceId, {
      eventName: 'TG_Subscribe',
      eventTime: new Date(),
      eventId: `test_${Date.now()}`,
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
      externalIdHash: 'test_external_id_hash',
    });
  }

  async upsertIntegration(
    workspaceId: string,
    data: { pixelId: string; accessToken: string; testEventCode?: string },
  ) {
    const existing = await this.prisma.metaIntegration.findFirst({ where: { workspaceId } });
    const accessTokenEnc = this.crypto.encrypt(data.accessToken);

    if (existing) {
      return this.prisma.metaIntegration.update({
        where: { id: existing.id },
        data: {
          pixelId: data.pixelId,
          accessTokenEnc,
          testEventCode: data.testEventCode,
        },
      });
    }

    return this.prisma.metaIntegration.create({
      data: {
        workspaceId,
        pixelId: data.pixelId,
        accessTokenEnc,
        testEventCode: data.testEventCode,
      },
    });
  }

  async getIntegration(workspaceId: string) {
    const integration = await this.prisma.metaIntegration.findFirst({ where: { workspaceId } });
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
