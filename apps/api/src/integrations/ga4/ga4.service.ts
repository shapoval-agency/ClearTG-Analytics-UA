import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { checkResult, type IntegrationCheckItem, type IntegrationCheckResult } from '../integration-check';
import { conversionsDryRun, dryRunResult, DRY_RUN_CHECK } from '../dry-run';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../crypto/crypto.service';
import { ConversionPayload, DeliveryResult } from '../meta/meta.service';

const GA4_EVENT_MAP: Record<string, string> = {
  TG_Subscribe: 'tg_subscribe',
  TG_Qualified_Subscribe_D1: 'tg_qualified_subscribe_d1',
  TG_Qualified_Subscribe_D7: 'tg_qualified_subscribe_d7',
  TG_Qualified_Subscribe_D30: 'tg_qualified_subscribe_d30',
  LeadMagnet_Claimed: 'lead_magnet_claimed',
  TG_Reached_Telegram: 'tg_reached_telegram',
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
      return { success: false, skipped: true, error: 'No active GA4 integration' };
    }
    // Без справжнього client_id (_ga) подія створила б у GA4 вигаданого
    // користувача, не пов'язаного з рекламним візитом. Такі події не шлемо.
    if (!payload.click?.gaClientId) {
      return { success: false, skipped: true, error: 'No GA client_id for this click' };
    }

    const apiSecret = this.crypto.decrypt(integration.apiSecretEnc);
    const gaEventName = GA4_EVENT_MAP[payload.eventName] ?? payload.eventName;

    const params: Record<string, unknown> = {
      event_id: payload.eventId,
      engagement_time_msec: '100',
    };
    if (payload.click.gaSessionId) params.session_id = payload.click.gaSessionId;

    const body: Record<string, unknown> = {
      client_id: payload.click.gaClientId,
      // Час реальної події (підписки), а не моменту відправки — важливо при затримці S3-09.
      timestamp_micros: String(payload.eventTime.getTime() * 1000),
      events: [{ name: gaEventName, params }],
    };

    if (payload.externalIdHash && payload.consent.analytics_storage === 'granted') {
      body.user_id = payload.externalIdHash;
    }

    if (conversionsDryRun()) {
      return dryRunResult('ga4', `https://www.google-analytics.com/mp/collect?measurement_id=${integration.measurementId}`, body);
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

    // Нові дані = нова перевірка: відправка вимкнена, доки verify() не пройде (S3-01).
    if (existing) {
      return this.prisma.gA4Integration.update({
        where: { id: existing.id },
        data: {
          measurementId: data.measurementId.trim().toUpperCase(),
          apiSecretEnc,
          streamId: data.streamId,
          isActive: false,
        },
      });
    }

    return this.prisma.gA4Integration.create({
      data: {
        workspaceId,
        measurementId: data.measurementId.trim().toUpperCase(),
        apiSecretEnc,
        streamId: data.streamId,
        isActive: false,
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

  /**
   * S3-01: перевірка до запуску. GA4 не має окремого методу «перевірити секрет»,
   * тому перевіряємо формат Measurement ID і валідність події через
   * debug-endpoint Measurement Protocol (він не пише в статистику).
   */
  async verify(workspaceId: string): Promise<IntegrationCheckResult> {
    const integration = await this.prisma.gA4Integration.findFirst({ where: { workspaceId } });
    if (!integration) throw new NotFoundException('Спочатку збережіть Measurement ID і API secret GA4');

    const checks: IntegrationCheckItem[] = [];
    if (!/^G-[A-Z0-9]{4,}$/.test(integration.measurementId)) {
      checks.push({ id: 'measurement_id', label: 'Measurement ID', status: 'error', detail: 'Measurement ID має вигляд G-XXXXXXX (Адміністрування → Потоки даних).' });
      return checkResult(checks);
    }
    checks.push({ id: 'measurement_id', label: 'Measurement ID', status: 'ok', detail: integration.measurementId });
    if (conversionsDryRun()) {
      checks.push(DRY_RUN_CHECK);
      return checkResult(checks);
    }

    let secret: string;
    try {
      secret = this.crypto.decrypt(integration.apiSecretEnc);
    } catch {
      checks.push({ id: 'secret', label: 'API secret', status: 'error', detail: 'Секрет пошкоджений — збережіть його ще раз.' });
      return checkResult(checks);
    }

    try {
      const res = await fetch(
        `https://www.google-analytics.com/debug/mp/collect?measurement_id=${integration.measurementId}&api_secret=${encodeURIComponent(secret)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: 'cleartg.verify', events: [{ name: 'tg_subscribe', params: { engagement_time_msec: '1' } }] }),
        },
      );
      const body = (await res.json().catch(() => null)) as { validationMessages?: Array<{ description?: string }> } | null;
      const messages = body?.validationMessages ?? [];
      checks.push(
        res.ok && messages.length === 0
          ? { id: 'payload', label: 'Формат подій', status: 'ok', detail: 'GA4 приймає події ClearTG у цьому форматі.' }
          : { id: 'payload', label: 'Формат подій', status: 'error', detail: messages[0]?.description ?? `GA4 відповів HTTP ${res.status}` },
      );
    } catch {
      checks.push({ id: 'payload', label: 'Формат подій', status: 'error', detail: 'Не вдалося зв’язатися з GA4. Спробуйте ще раз.' });
    }

    checks.push({
      id: 'secret_note',
      label: 'API secret',
      status: 'warning',
      detail: 'GA4 не дозволяє перевірити секрет заздалегідь. Надішліть тестову подію і переконайтеся, що вона з’явилась у звіті «Реальний час».',
    });
    return checkResult(checks);
  }

  async setActive(workspaceId: string, isActive: boolean) {
    const integration = await this.prisma.gA4Integration.findFirst({ where: { workspaceId } });
    if (!integration) throw new NotFoundException('GA4 не підключено');
    if (isActive) {
      const check = await this.verify(workspaceId);
      if (!check.ok) {
        throw new BadRequestException(check.checks.find((c) => c.status === 'error')?.detail ?? 'Перевірка не пройдена');
      }
    }
    await this.prisma.gA4Integration.update({ where: { id: integration.id }, data: { isActive } });
    return this.getIntegration(workspaceId);
  }
}
