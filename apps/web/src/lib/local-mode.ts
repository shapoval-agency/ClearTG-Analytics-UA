/** Тимчасовий режим: дані в браузері, без бекенду. */
export function isLocalMode(): boolean {
  if (process.env.LOCAL_MODE === 'true') return true;
  if (process.env.LOCAL_MODE === 'false') return false;
  // Якщо задано логін, але немає бека — автоматично локальний режим
  return Boolean(process.env.LOCAL_LOGIN_EMAIL && !process.env.API_INTERNAL_URL);
}

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
