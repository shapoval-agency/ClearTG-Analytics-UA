const KYIV_TZ = 'Europe/Kyiv';

/**
 * `Date#setHours(0,0,0,0)` obeys the SERVER's local timezone, not Kyiv's —
 * on a VPS running with TZ=UTC (the common default), "midnight" there is
 * actually 02:00-03:00 in Kyiv, so day-boundary reports ("yesterday", daily
 * digest) silently shift events near midnight into the wrong calendar day.
 * These helpers compute real Kyiv civil-day boundaries regardless of what
 * timezone the Node process itself runs in.
 */
function kyivWallClockAsUtcMillis(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KYIV_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/** Kyiv's offset from UTC (ms) at the moment `date` — accounts for DST. */
export function kyivOffsetMs(date: Date): number {
  return kyivWallClockAsUtcMillis(date) - date.getTime();
}

/** Start of the Kyiv civil day (00:00 local), `daysAgo` days before `now`. */
export function kyivDayStart(now: Date, daysAgo = 0): Date {
  const offset = kyivOffsetMs(now);
  const shifted = new Date(now.getTime() + offset);
  const dayStartShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysAgo,
    0,
    0,
    0,
    0,
  );
  return new Date(dayStartShifted - offset);
}
