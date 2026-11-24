/**
 * Результат перевірки підключення рекламної системи (S3-01, S3-05).
 * Відправка вмикається лише після перевірки без помилок.
 */
export interface IntegrationCheckItem {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

export interface IntegrationCheckResult {
  ok: boolean;
  checkedAt: string;
  checks: IntegrationCheckItem[];
}

export function checkResult(checks: IntegrationCheckItem[]): IntegrationCheckResult {
  return {
    ok: checks.every((c) => c.status !== 'error'),
    checkedAt: new Date().toISOString(),
    checks,
  };
}

/** Текст помилки від API — коротко й без токенів у рядку. */
export function apiErrorText(body: unknown, fallback: string): string {
  const message =
    (body as { error?: { message?: string } } | null)?.error?.message ??
    (body as { message?: string } | null)?.message;
  return typeof message === 'string' && message ? message.slice(0, 300) : fallback;
}
