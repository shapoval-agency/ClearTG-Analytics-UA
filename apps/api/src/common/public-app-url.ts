type EnvLike = NodeJS.ProcessEnv | { get(key: string): string | undefined };

const DEFAULT_PUBLIC_FRONTEND = 'https://clear-tg-analytics-ua-web.vercel.app';
const LOCAL_DEV_FRONTEND = 'http://localhost:3002';

function readEnv(env: EnvLike, key: string): string | undefined {
  if (typeof (env as { get?: (k: string) => string | undefined }).get === 'function') {
    return (env as { get: (k: string) => string | undefined }).get(key);
  }
  return (env as NodeJS.ProcessEnv)[key];
}

function stripSlash(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function isLocalhostUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
}

function isLocalDev(env: EnvLike = process.env): boolean {
  const nodeEnv = (readEnv(env, 'NODE_ENV') ?? 'development').toLowerCase();
  return nodeEnv === 'development' || nodeEnv === 'test';
}

/**
 * Frontend (Vercel) URL for magic links, CORS, embeds, privacy URLs.
 * Never falls back to localhost outside local development.
 */
export function resolveFrontendUrl(env: EnvLike = process.env): string {
  const raw = readEnv(env, 'NEXT_PUBLIC_APP_URL');
  const configured = raw ? stripSlash(raw) : '';

  if (configured && !isLocalhostUrl(configured)) {
    return configured;
  }

  if (isLocalDev(env)) {
    return configured || LOCAL_DEV_FRONTEND;
  }

  // Staging/production on VPS: ignore localhost leftovers, use public cabinet.
  return DEFAULT_PUBLIC_FRONTEND;
}

/**
 * Strict public https URL for Telegram inline buttons (no localhost).
 */
export function getPublicAppUrl(env: EnvLike = process.env): string {
  const url = resolveFrontendUrl(env);
  if (isLocalhostUrl(url)) {
    throw new Error(
      `NEXT_PUBLIC_APP_URL must be a public https URL for Telegram buttons, got: ${url}`,
    );
  }
  if (!/^https:\/\//i.test(url)) {
    throw new Error(`NEXT_PUBLIC_APP_URL must use https://, got: ${url}`);
  }
  return url;
}

export function tryPublicAppUrl(env: EnvLike = process.env): string | null {
  try {
    return getPublicAppUrl(env);
  } catch {
    return null;
  }
}
