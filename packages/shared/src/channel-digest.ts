export interface DigestPersonRow {
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  occurredAt: Date;
  sourceLabel: string;
  /** Only relevant for the unsubscribe list — days between subscribe and unsubscribe. */
  daysInChannel?: number;
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
  const daysPart = row.daysInChannel !== undefined ? ` (${row.daysInChannel} дн.)` : '';
  return `${time} ${name}${usernamePart}${daysPart}`;
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
      for (const row of group) lines.push(formatPersonLine(row));
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
