/**
 * Пресети періоду для /v2/reports.
 *
 * Навмисно тільки чотири готові варіанти, без довільного вибору дат —
 * бриф прямо просить не додавати «складні фільтри». Фактичні межі доби
 * (з урахуванням київського часового поясу, DST) рахує бекенд у
 * kyivDateRange() — тут лише підбираються календарні дати `YYYY-MM-DD`,
 * які йому передати.
 */
export type ReportPeriod = 'today' | '7d' | '30d' | 'all';

export const PERIOD_OPTIONS: Array<{ value: ReportPeriod; label: string }> = [
  { value: 'today', label: 'Сьогодні' },
  { value: '7d', label: '7 днів' },
  { value: '30d', label: '30 днів' },
  { value: 'all', label: 'Увесь час' },
];

function kyivDateOffset(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  // Той самий прийом, що вже є в getDailyDigest() на бекенді для лейбла дати:
  // календарний день саме за київським часом, не за UTC/локальним TZ сервера.
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
}

export function isReportPeriod(value: string | undefined): value is ReportPeriod {
  return PERIOD_OPTIONS.some((o) => o.value === value);
}

export interface ResolvedPeriod {
  value: ReportPeriod;
  label: string;
  from?: string;
  to?: string;
}

/** `undefined`/невідоме значення → 'all', той самий безпечний дефолт, що й на бекенді без параметрів. */
export function resolvePeriod(period: string | undefined): ResolvedPeriod {
  const value: ReportPeriod = isReportPeriod(period) ? period : 'all';
  const label = PERIOD_OPTIONS.find((o) => o.value === value)!.label;

  if (value === 'today') {
    const today = kyivDateOffset(0);
    return { value, label, from: today, to: today };
  }
  if (value === '7d') {
    return { value, label, from: kyivDateOffset(6), to: kyivDateOffset(0) };
  }
  if (value === '30d') {
    return { value, label, from: kyivDateOffset(29), to: kyivDateOffset(0) };
  }
  return { value, label };
}
