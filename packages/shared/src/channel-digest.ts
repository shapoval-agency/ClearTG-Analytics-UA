const MAX_ROWS_PER_GROUP = 50;

export interface DigestPersonRow {
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  occurredAt: Date;
  sourceLabel: string;
  /** Days between subscribe and unsubscribe (only relevant for the unsubscribe list). */
  daysInChannel?: number;
  /** True when subscribedAt is unknown (user joined before we started tracking) — days is a lower bound. */
  daysApprox?: boolean;
  /** Already pressed /start on the admin bot — reachable for direct messaging. */
  botStarted?: boolean;
}

export interface ChannelDigestInput {
  channelTitle: string;
  totalActive: number;
  netChange: number;
  subscribers: DigestPersonRow[];
  unsubscribers: DigestPersonRow[];
}

function displayName(row: DigestPersonRow): string {
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ');
  if (name) return name;
  if (row.username) return '';
  return `id ${row.telegramUserId}`;
}

function formatPersonLine(row: DigestPersonRow): string {
  const time = row.occurredAt.toLocaleTimeString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
  });
  const name = displayName(row);
  const usernamePart = row.username ? `${name ? ', ' : ''}@${row.username}` : '';
  const starPart = row.botStarted ? ' ★' : '';
  const daysPart =
    row.daysInChannel !== undefined ? ` (${row.daysApprox ? '>' : ''}${row.daysInChannel} дн.)` : '';
  return `${time} ${name}${usernamePart}${starPart}${daysPart}`;
}

/** Groups by джерело (назва tracking-посилання чи "без посилання"), найбільші групи першими. */
function groupBySource(rows: DigestPersonRow[]): Array<[string, DigestPersonRow[]]> {
  const groups = new Map<string, DigestPersonRow[]>();
  for (const row of rows) {
    const list = groups.get(row.sourceLabel) ?? [];
    list.push(row);
    groups.set(row.sourceLabel, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

function formatSection(label: string, rows: DigestPersonRow[]): string {
  const lines = [`${label}: ${rows.length}`];
  if (rows.length > 0) {
    for (const [sourceLabel, group] of groupBySource(rows)) {
      lines.push('');
      lines.push(`(${group.length}) ${sourceLabel}:`);
      const shown = group.slice(0, MAX_ROWS_PER_GROUP);
      for (const row of shown) lines.push(formatPersonLine(row));
      const rest = group.length - shown.length;
      if (rest > 0) lines.push(`і ще: ${rest}`);
    }
  }
  return lines.join('\n');
}

/** Одне повідомлення на канал — тільки для каналів, де була активність за період. */
export function formatChannelDigest(input: ChannelDigestInput): string {
  const sign = input.netChange >= 0 ? '+' : '';
  const header = `За вчора у вас ${sign}${input.netChange} підписників, всього ${input.totalActive} в каналі «${input.channelTitle}»`;

  return [
    header,
    '',
    formatSection('Підписалися', input.subscribers),
    '',
    formatSection('Відписалися', input.unsubscribers),
  ].join('\n');
}
