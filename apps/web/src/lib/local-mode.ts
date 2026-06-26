/** Тимчасовий режим: дані в браузері, без бекенду. LOCAL_MODE=true на Vercel. */
export function isLocalMode(): boolean {
  return process.env.LOCAL_MODE === 'true';
}

/** Для client components (потрібен NEXT_PUBLIC_LOCAL_MODE на Vercel). */
export function isLocalModeClient(): boolean {
  return process.env.NEXT_PUBLIC_LOCAL_MODE === 'true';
}

export const LOCAL_SESSION_TOKEN = 'local';
export const LOCAL_WORKSPACE_ID = 'local-ws';

export function getLocalCredentials() {
  return {
    email: process.env.LOCAL_LOGIN_EMAIL ?? 'test@cleartg.ua',
    password: process.env.LOCAL_LOGIN_PASSWORD ?? 'cleartg123',
  };
}
