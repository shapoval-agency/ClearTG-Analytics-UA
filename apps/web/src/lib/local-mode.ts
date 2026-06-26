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

/** Vercel часто додає пробіли/лапки в env — прибираємо. */
function normalizeEnv(value: string | undefined): string {
  if (!value) return '';
  let v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

export function getLocalCredentials() {
  return {
    email: normalizeEnv(process.env.LOCAL_LOGIN_EMAIL) || 'test@cleartg.ua',
    password: normalizeEnv(process.env.LOCAL_LOGIN_PASSWORD) || 'cleartg123',
  };
}

export function isLocalPasswordConfigured(): boolean {
  return Boolean(normalizeEnv(process.env.LOCAL_LOGIN_PASSWORD));
}
