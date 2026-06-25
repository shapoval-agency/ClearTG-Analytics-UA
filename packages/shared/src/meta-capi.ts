/** Build Meta fbc parameter from fbclid when _fbc cookie is unavailable. */
export function buildFbcFromFbclid(
  fbclid: string | null | undefined,
  existingFbc?: string | null,
): string | null {
  if (existingFbc) return existingFbc;
  if (!fbclid) return null;
  return `fb.1.${Date.now()}.${fbclid}`;
}
