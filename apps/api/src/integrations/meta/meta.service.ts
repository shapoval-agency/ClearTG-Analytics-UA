import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { apiErrorText, checkResult, type IntegrationCheckItem, type IntegrationCheckResult } from '../integration-check';
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
    gaSessionId?: string | null;
    ipHash?: string | null;
    userAgentHash?: string | null;
  } | null;
  externalIdHash?: string | null;
  /** Сторінка, з якої почався перехід (наше трекінгове посилання). */
  eventSourceUrl?: string;
}

export interface DeliveryResult {
  success: boolean;
  /** Не відправлялось з очікуваної причини (вимкнено, немає дії для цілі) — не помилка. */
  skipped?: boolean;
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
  TG_Reached_Telegram: 'TelegramReached',
};

const GRAPH = 'https://graph.facebook.com/v21.0';

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
      return { success: false, skipped: true, error: 'No active Meta integration' };
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
    // client_ip_address / client_user_agent Meta приймає лише в сирому вигляді.
    // Ми зберігаємо тільки їхні хеші (приватність) — тому не передаємо зовсім:
    // хеш на місці IP погіршував якість зіставлення.

    const eventData = {
      event_name: metaEventName,
      event_time: Math.floor(payload.eventTime.getTime() / 1000),
      event_id: payload.eventId,
      action_source: 'website',
      ...(payload.eventSourceUrl ? { event_source_url: payload.eventSourceUrl } : {}),
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
      const url = `${GRAPH}/${integration.pixelId}/events?access_token=${accessToken}`;
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

    // Нові дані = нова перевірка: відправка вимикається, доки verify() не пройде (S3-05).
    if (existing) {
      return this.prisma.metaIntegration.update({
        where: { id: existing.id },
        data: {
          pixelId: data.pixelId.trim(),
          accessTokenEnc,
          testEventCode: data.testEventCode?.trim() || null,
          isActive: false,
        },
      });
    }

    return this.prisma.metaIntegration.create({
      data: {
        workspaceId,
        pixelId: data.pixelId.trim(),
        accessTokenEnc,
        testEventCode: data.testEventCode?.trim() || null,
        isActive: false,
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

  /**
   * S3-05: перевірка до запуску — піксель існує, токен дійсний і має до нього доступ.
   * Нічого не відправляє в рекламну статистику.
   */
  async verify(workspaceId: string): Promise<IntegrationCheckResult> {
    const integration = await this.prisma.metaIntegration.findFirst({ where: { workspaceId } });
    if (!integration) throw new NotFoundException('Спочатку збережіть Pixel ID і токен Meta');

    const checks: IntegrationCheckItem[] = [];
    if (!/^\d{10,20}$/.test(integration.pixelId)) {
      checks.push({ id: 'pixel_format', label: 'Pixel ID', status: 'error', detail: 'Pixel ID складається лише з цифр (10–20). Скопіюйте його з Events Manager.' });
      return checkResult(checks);
    }

    let token: string;
    try {
      token = this.crypto.decrypt(integration.accessTokenEnc);
    } catch {
      checks.push({ id: 'token', label: 'Токен доступу', status: 'error', detail: 'Токен пошкоджений — збережіть його ще раз.' });
      return checkResult(checks);
    }

    try {
      const res = await fetch(`${GRAPH}/${integration.pixelId}?fields=id,name&access_token=${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => null);
      if (res.ok) {
        checks.push({ id: 'pixel', label: 'Піксель і токен', status: 'ok', detail: `Доступ до пікселя «${(body as { name?: string })?.name ?? integration.pixelId}» підтверджено.` });
      } else {
        checks.push({
          id: 'pixel',
          label: 'Піксель і токен',
          status: 'error',
          detail: `Meta відхилила доступ: ${apiErrorText(body, `HTTP ${res.status}`)}. Перевірте Pixel ID і що токен згенеровано для цього пікселя (Events Manager → Налаштування → Conversions API).`,
        });
      }
    } catch {
      checks.push({ id: 'pixel', label: 'Піксель і токен', status: 'error', detail: 'Не вдалося зв’язатися з Meta. Спробуйте ще раз.' });
    }

    checks.push(
      integration.testEventCode
        ? { id: 'test_mode', label: 'Тестовий режим', status: 'warning', detail: 'Задано Test Event Code — події йдуть у «Тестові події», а не в статистику реклами. Приберіть код перед запуском.' }
        : { id: 'test_mode', label: 'Тестовий режим', status: 'ok', detail: 'Події підуть у робочу статистику.' },
    );
    return checkResult(checks);
  }

  /** Увімкнення відправки — лише після успішної перевірки. */
  async setActive(workspaceId: string, isActive: boolean) {
    const integration = await this.prisma.metaIntegration.findFirst({ where: { workspaceId } });
    if (!integration) throw new NotFoundException('Meta не підключена');
    if (isActive) {
      const check = await this.verify(workspaceId);
      if (!check.ok) {
        throw new BadRequestException(check.checks.find((c) => c.status === 'error')?.detail ?? 'Перевірка не пройдена');
      }
    }
    await this.prisma.metaIntegration.update({ where: { id: integration.id }, data: { isActive } });
    return this.getIntegration(workspaceId);
  }
}
