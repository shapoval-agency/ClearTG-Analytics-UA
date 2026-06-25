import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../crypto/crypto.service';
import { ConversionPayload, DeliveryResult } from '../meta/meta.service';

const GA4_EVENT_MAP: Record<string, string> = {
  TG_Subscribe: 'tg_subscribe',
  TG_Qualified_Subscribe_D1: 'tg_qualified_subscribe_d1',
  TG_Qualified_Subscribe_D7: 'tg_qualified_subscribe_d7',
  TG_Qualified_Subscribe_D30: 'tg_qualified_subscribe_d30',
  LeadMagnet_Claimed: 'lead_magnet_claimed',
  tg_click: 'tg_click',
  tg_unsubscribe: 'tg_unsubscribe',
};

@Injectable()
export class GA4Service {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async sendEvent(workspaceId: string, payload: ConversionPayload): Promise<DeliveryResult> {
    const integration = await this.prisma.gA4Integration.findFirst({
      where: { workspaceId, isActive: true },
    });
    if (!integration) {
      return { success: false, error: 'No active GA4 integration' };
    }

    const apiSecret = this.crypto.decrypt(integration.apiSecretEnc);
    const gaEventName = GA4_EVENT_MAP[payload.eventName] ?? payload.eventName;

    const clientId = payload.click?.gaClientId ?? payload.eventId;

    const body: Record<string, unknown> = {
      client_id: clientId,
      events: [
        {
          name: gaEventName,
          params: {
            event_id: payload.eventId,
            engagement_time_msec: '100',
          },
        },
      ],
    };

    if (payload.externalIdHash && payload.consent.analytics_storage === 'granted') {
      body.user_id = payload.externalIdHash;
    }

    if (payload.click?.gaClientId) {
      (body.events as Array<Record<string, unknown>>)[0].params = {
        ...(body.events as Array<Record<string, unknown>>)[0].params as object,
        session_id: payload.click.gaClientId,
      };
    }

    try {
      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${integration.measurementId}&api_secret=${apiSecret}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      return {
        success: response.ok || response.status === 204,
        requestPayload: body,
        responseStatus: response.status,
        responseBody: { status: response.status },
      };
    } catch (err) {
      return {
        success: false,
        requestPayload: body,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async upsertIntegration(
    workspaceId: string,
    data: { measurementId: string; apiSecret: string; streamId?: string },
  ) {
    const existing = await this.prisma.gA4Integration.findFirst({ where: { workspaceId } });
    const apiSecretEnc = this.crypto.encrypt(data.apiSecret);

    if (existing) {
      return this.prisma.gA4Integration.update({
        where: { id: existing.id },
        data: {
          measurementId: data.measurementId,
          apiSecretEnc,
          streamId: data.streamId,
        },
      });
    }

    return this.prisma.gA4Integration.create({
      data: {
        workspaceId,
        measurementId: data.measurementId,
        apiSecretEnc,
        streamId: data.streamId,
      },
    });
  }

  async getIntegration(workspaceId: string) {
    const integration = await this.prisma.gA4Integration.findFirst({ where: { workspaceId } });
    if (!integration) return null;
    return {
      id: integration.id,
      measurementId: integration.measurementId,
      streamId: integration.streamId,
      isActive: integration.isActive,
      hasApiSecret: !!integration.apiSecretEnc,
    };
  }

  async sendTestEvent(workspaceId: string) {
    return this.sendEvent(workspaceId, {
      eventName: 'TG_Subscribe',
      eventTime: new Date(),
      eventId: `test_${Date.now()}`,
      consent: {
        analytics_storage: 'granted',
        marketing_storage: 'unknown',
        ad_user_data: 'unknown',
        ad_personalization: 'unknown',
        meta_allowed: false,
        google_allowed: false,
        tiktok_allowed: false,
        ga4_allowed: true,
      },
      click: { gaClientId: 'test.client.id' },
    });
  }
}
