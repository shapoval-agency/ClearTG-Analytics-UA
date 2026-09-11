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

/**
 * Перетворює необов'язкові `from`/`to` (календарні дати чи будь-які
 * ISO-рядки — беремо лише те, на який київський день припадає момент) на
 * Prisma-сумісний діапазон `{ gte, lt }` для DateTime-фільтра. Той самий
 * прийом, що вже використовує `getDailyDigest` для `day`/`next`: межі
 * рахуються за київським календарним днем, а не за UTC-зрізом рядка, —
 * інакше клік о 23:59 і підписка о 00:01 (Київ) можуть розʼїхатись по
 * різних добах в звіті, хоча для людини це одна й та сама ніч.
 *
 * `from` включно з початку свого дня, `to` включно по кінець свого дня
 * (тобто до початку наступного). Порожній/невалідний рядок — як
 * відсутній параметр: не звужує фільтр, а не кидає помилку (той самий
 * підхід, що вже прийнятий в dashboard.controller.ts для інших
 * query-параметрів — невідоме значення тихо ігнорується, а не 400).
 *
 * Повертає `undefined`, якщо жодної межі задати не вдалось — виклик на
 * стороні сервісу тоді просто не додає це поле у Prisma `where`, і
 * поведінка лишається такою, як була до фільтра періоду.
 */
export function kyivDateRange(
  from?: string | null,
  to?: string | null,
): { gte?: Date; lt?: Date } | undefined {
  const range: { gte?: Date; lt?: Date } = {};

  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) {
      range.gte = kyivDayStart(fromDate, 0);
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      // Верхня межа виключна — початок доби ПІСЛЯ "to", щоб сам день "to" увійшов повністю.
      range.lt = kyivDayStart(toDate, -1);
    }
  }

  return range.gte || range.lt ? range : undefined;
}
