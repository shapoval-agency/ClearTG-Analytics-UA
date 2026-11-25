import type { DeliveryResult } from './meta/meta.service';
import type { IntegrationCheckItem } from './integration-check';

/**
 * «Сухий прогін» конверсій (CONVERSIONS_DRY_RUN=true).
 *
 * Уся цепочка працює по-справжньому — клік, підписка, конверсія, затримка,
 * відсів, черга, — але в Meta / GA4 / Google Ads нічого не відправляється:
 * запит, який пішов би, записується в журнал доставки. Для тестування без
 * рекламних кабінетів. На production має бути вимкнено.
 */
export function conversionsDryRun(): boolean {
  return process.env.CONVERSIONS_DRY_RUN === 'true';
}

/** Результат «відправки» в сухому прогоні: успіх без мережі, з повним запитом. */
export function dryRunResult(platform: string, endpoint: string, requestPayload: unknown): DeliveryResult {
  return {
    success: true,
    dryRun: true,
    requestPayload: { endpoint, body: requestPayload },
    responseStatus: 0,
    responseBody: { dry_run: true, platform, note: 'Не відправлено: CONVERSIONS_DRY_RUN=true' },
  };
}

export const DRY_RUN_CHECK: IntegrationCheckItem = {
  id: 'dry_run',
  label: 'Тестовий режим',
  status: 'warning',
  detail: 'Увімкнено «сухий прогін»: доступи до рекламної системи не перевіряються, події записуються в журнал і нікуди не відправляються.',
};
