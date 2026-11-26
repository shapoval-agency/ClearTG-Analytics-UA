/**
 * Адміністратор платформи (AGENCY_ADMIN_EMAIL) бачить усі кабінети.
 * У кабінеті, де він не учасник, — лише перегляд: будь-яка зміна даних
 * клієнта без його участі заборонена. Кожен вхід пишеться в журнал аудиту.
 */
export function isPlatformAdminEmail(email: string | undefined | null, adminEmail: string | undefined | null): boolean {
  const admin = adminEmail?.trim().toLowerCase();
  return Boolean(admin && email && email.trim().toLowerCase() === admin);
}

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isReadOnlyMethod(method: string | undefined): boolean {
  return READ_ONLY_METHODS.has((method ?? '').toUpperCase());
}

export const PLATFORM_ADMIN_READ_ONLY_MESSAGE =
  'Режим перегляду адміністратора: у чужому кабінеті можна лише переглядати дані, змінювати їх не можна.';
