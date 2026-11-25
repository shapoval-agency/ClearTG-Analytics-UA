import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { apiErrorText, checkResult, type IntegrationCheckItem, type IntegrationCheckResult } from '../integration-check';
import { conversionsDryRun, dryRunResult, DRY_RUN_CHECK } from '../dry-run';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../crypto/crypto.service';
import { GoogleAdsOAuthService } from './google-ads-oauth.service';
import { ConversionPayload, DeliveryResult } from '../meta/meta.service';
import {
  buildUploadClickConversionBody,
  canUploadGoogleConversion,
  CONVERSION_EVENTS,
} from '@cleartg/shared';

/** Дії-конверсії для додаткових цілей (S3-12, S3-16) зберігаються в eventMapping. */
interface GoogleAdsEventMapping {
  [CONVERSION_EVENTS.reach]?: string;
  [CONVERSION_EVENTS.gift]?: string;
}

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
      reachConversionActionId?: string;
      giftConversionActionId?: string;
      oauthCredentialsEnc?: string;
    },
  ) {
    const customerId = data.customerId.replace(/[-\s]/g, '');
    const existing = await this.prisma.googleAdsIntegration.findFirst({ where: { workspaceId } });

    const oauthCredentialsEnc =
      data.oauthCredentialsEnc ??
      existing?.oauthCredentialsEnc ??
      this.crypto.encrypt(JSON.stringify({ access_token: '', expires_at: 0 }));

    const eventMapping: GoogleAdsEventMapping = {};
    if (data.reachConversionActionId?.trim()) eventMapping[CONVERSION_EVENTS.reach] = data.reachConversionActionId.trim();
    if (data.giftConversionActionId?.trim()) eventMapping[CONVERSION_EVENTS.gift] = data.giftConversionActionId.trim();

    const fields = {
      customerId,
      conversionActionId: data.conversionActionId.trim(),
      managerAccountId: data.managerAccountId?.replace(/[-\s]/g, '') || null,
      oauthCredentialsEnc,
      eventMapping: eventMapping as object,
      // Нові дані = нова перевірка: відправка вимкнена, доки verify() не пройде (S3-01).
      isActive: false,
    };

    if (existing) {
      return this.prisma.googleAdsIntegration.update({ where: { id: existing.id }, data: fields });
    }
    return this.prisma.googleAdsIntegration.create({ data: { workspaceId, ...fields } });
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

    const mapping = (integration.eventMapping ?? {}) as GoogleAdsEventMapping;
    return {
      id: integration.id,
      customerId: integration.customerId,
      conversionActionId: integration.conversionActionId,
      reachConversionActionId: mapping[CONVERSION_EVENTS.reach] ?? null,
      giftConversionActionId: mapping[CONVERSION_EVENTS.gift] ?? null,
      managerAccountId: integration.managerAccountId,
      isActive: integration.isActive,
      oauthConnected,
      developerTokenConfigured: Boolean(this.config.get<string>('GOOGLE_ADS_DEVELOPER_TOKEN')),
      dryRun: conversionsDryRun(),
    };
  }

  async sendEvent(workspaceId: string, payload: ConversionPayload): Promise<DeliveryResult> {
    const integration = await this.prisma.googleAdsIntegration.findFirst({
      where: { workspaceId, isActive: true },
    });
    if (!integration) {
      return { success: false, skipped: true, error: 'No active Google Ads integration' };
    }

    // Кожна ціль — своя дія-конверсія в Google Ads. Без неї подію не шлемо,
    // щоб «дійшов до Telegram» не рахувався як підписка.
    const mapping = (integration.eventMapping ?? {}) as GoogleAdsEventMapping;
    const conversionActionId =
      payload.eventName === CONVERSION_EVENTS.subscribe
        ? integration.conversionActionId
        : mapping[payload.eventName as keyof GoogleAdsEventMapping];
    if (!conversionActionId) {
      return { success: false, skipped: true, error: `No Google Ads conversion action for ${payload.eventName}` };
    }

    const dryRun = conversionsDryRun();
    const developerToken = this.config.get<string>('GOOGLE_ADS_DEVELOPER_TOKEN');
    if (!developerToken && !dryRun) {
      return { success: false, error: 'GOOGLE_ADS_DEVELOPER_TOKEN not configured' };
    }

    const conversionInput = {
      customerId: integration.customerId,
      conversionActionId,
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
        skipped: true,
        error: 'skipped_no_identifier: no gclid/gbraid/wbraid or permitted user identifier',
      };
    }

    if (payload.consent.ad_personalization === 'denied') {
      return {
        success: false,
        skipped: true,
        error: 'skipped_policy_restriction: ad_personalization denied',
      };
    }

    const requestBody = buildUploadClickConversionBody(conversionInput);

    if (dryRun || !developerToken) {
      return dryRunResult(
        'google_ads',
        `https://googleads.googleapis.com/${API_VERSION}/customers/${integration.customerId}:uploadClickConversions`,
        requestBody,
      );
    }

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

  /**
   * S3-01: перевірка до запуску — є developer token, OAuth-доступ живий,
   * дія-конверсія існує, увімкнена і приймає завантаження кліків.
   */
  async verify(workspaceId: string): Promise<IntegrationCheckResult> {
    const integration = await this.prisma.googleAdsIntegration.findFirst({ where: { workspaceId } });
    if (!integration) throw new NotFoundException('Спочатку збережіть Customer ID і дію-конверсію Google Ads');

    const checks: IntegrationCheckItem[] = [];
    if (conversionsDryRun()) {
      const mappingDry = (integration.eventMapping ?? {}) as GoogleAdsEventMapping;
      for (const [id, label, actionId] of [
        ['subscribe', 'Дія-конверсія «Підписка»', integration.conversionActionId],
        ['reach', 'Дія-конверсія «Дійшов до Telegram»', mappingDry[CONVERSION_EVENTS.reach]],
        ['gift', 'Дія-конверсія «Забрав подарок»', mappingDry[CONVERSION_EVENTS.gift]],
      ] as Array<[string, string, string | undefined]>) {
        if (!actionId) continue;
        checks.push(/^\d+$/.test(actionId)
          ? { id, label, status: 'ok', detail: `ID ${actionId}` }
          : { id, label, status: 'error', detail: 'ID дії-конверсії — це число з адреси сторінки дії в Google Ads.' });
      }
      checks.push(DRY_RUN_CHECK);
      return checkResult(checks);
    }

    const developerToken = this.config.get<string>('GOOGLE_ADS_DEVELOPER_TOKEN');
    if (!developerToken) {
      checks.push({ id: 'developer_token', label: 'Доступ ClearTG до Google Ads API', status: 'error', detail: 'На сервері не налаштовано GOOGLE_ADS_DEVELOPER_TOKEN — зверніться до підтримки ClearTG.' });
      return checkResult(checks);
    }

    let accessToken: string;
    try {
      const tokens = await this.oauth.getValidAccessToken(integration.oauthCredentialsEnc);
      if (!tokens.accessToken) throw new Error('empty');
      accessToken = tokens.accessToken;
      if (tokens.updatedEnc) {
        await this.prisma.googleAdsIntegration.update({ where: { id: integration.id }, data: { oauthCredentialsEnc: tokens.updatedEnc } });
      }
      checks.push({ id: 'oauth', label: 'Вхід через Google', status: 'ok', detail: 'Доступ до акаунта Google Ads підтверджено.' });
    } catch {
      checks.push({ id: 'oauth', label: 'Вхід через Google', status: 'error', detail: 'Натисніть «Увійти через Google» і дайте доступ до Google Ads.' });
      return checkResult(checks);
    }

    const mapping = (integration.eventMapping ?? {}) as GoogleAdsEventMapping;
    const actions: Array<[string, string, string | undefined]> = [
      ['subscribe', 'Дія-конверсія «Підписка»', integration.conversionActionId],
      ['reach', 'Дія-конверсія «Дійшов до Telegram»', mapping[CONVERSION_EVENTS.reach]],
      ['gift', 'Дія-конверсія «Забрав подарок»', mapping[CONVERSION_EVENTS.gift]],
    ];
    const customerId = integration.customerId.replace(/-/g, '');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    if (integration.managerAccountId) headers['login-customer-id'] = integration.managerAccountId.replace(/-/g, '');

    for (const [id, label, actionId] of actions) {
      if (!actionId) continue;
      if (!/^\d+$/.test(actionId)) {
        checks.push({ id, label, status: 'error', detail: 'ID дії-конверсії — це число з адреси сторінки дії в Google Ads.' });
        continue;
      }
      try {
        const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: `SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.type FROM conversion_action WHERE conversion_action.id = ${actionId}`,
          }),
        });
        const body = (await res.json().catch(() => null)) as {
          results?: Array<{ conversionAction?: { name?: string; status?: string; type?: string } }>;
        } | null;
        if (!res.ok) {
          checks.push({ id, label, status: 'error', detail: `Google Ads відхилив запит: ${apiErrorText(body, `HTTP ${res.status}`)}. Перевірте Customer ID${integration.managerAccountId ? ' і ID менеджерського акаунта' : ''}.` });
          continue;
        }
        const action = body?.results?.[0]?.conversionAction;
        if (!action) {
          checks.push({ id, label, status: 'error', detail: `Дію-конверсію ${actionId} не знайдено в акаунті ${integration.customerId}.` });
        } else if (action.status !== 'ENABLED') {
          checks.push({ id, label, status: 'error', detail: `Дія «${action.name}» не увімкнена (${action.status}).` });
        } else if (action.type !== 'UPLOAD_CLICKS') {
          checks.push({ id, label, status: 'error', detail: `Дія «${action.name}» має тип ${action.type}. Потрібен тип «Імпорт → кліки» (UPLOAD_CLICKS).` });
        } else {
          checks.push({ id, label, status: 'ok', detail: `«${action.name}» готова приймати конверсії.` });
        }
      } catch {
        checks.push({ id, label, status: 'error', detail: 'Не вдалося зв’язатися з Google Ads. Спробуйте ще раз.' });
      }
    }
    return checkResult(checks);
  }

  async setActive(workspaceId: string, isActive: boolean) {
    const integration = await this.prisma.googleAdsIntegration.findFirst({ where: { workspaceId } });
    if (!integration) throw new NotFoundException('Google Ads не підключено');
    if (isActive) {
      const check = await this.verify(workspaceId);
      if (!check.ok) {
        throw new BadRequestException(check.checks.find((c) => c.status === 'error')?.detail ?? 'Перевірка не пройдена');
      }
    }
    await this.prisma.googleAdsIntegration.update({ where: { id: integration.id }, data: { isActive } });
    return this.getIntegration(workspaceId);
  }
}
