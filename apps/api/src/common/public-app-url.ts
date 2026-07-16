/**
 * Public frontend URL for links Telegram users open (Vercel cabinet).
 * Never returns localhost — Telegram rejects those in inline keyboard URLs.
 */
export function getPublicAppUrl(
  env: NodeJS.ProcessEnv | { get(key: string): string | undefined } = process.env,
): string {
  const raw =
    typeof (env as { get?: (k: string) => string | undefined }).get === 'function'
      ? (env as { get: (k: string) => string | undefined }).get('NEXT_PUBLIC_APP_URL')
      : (env as NodeJS.ProcessEnv).NEXT_PUBLIC_APP_URL;

  const url = (raw ?? '').trim().replace(/\/$/, '');
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is required on the API host (e.g. https://clear-tg-analytics-ua-web.vercel.app)',
    );
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_APP_URL must be a public https URL for Telegram buttons, got: ${url}`,
    );
  }
  if (!/^https:\/\//i.test(url)) {
    throw new Error(`NEXT_PUBLIC_APP_URL must use https://, got: ${url}`);
  }
  return url;
}

export function tryPublicAppUrl(
  env: NodeJS.ProcessEnv | { get(key: string): string | undefined } = process.env,
): string | null {
  try {
    return getPublicAppUrl(env);
  } catch {
    return null;
  }
}
