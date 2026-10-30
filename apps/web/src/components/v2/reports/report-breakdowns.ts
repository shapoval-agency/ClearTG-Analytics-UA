import type {
  TrackingLinkReportRow,
  UnsubscribeFeedRow,
  UnsubscribeTimingReport,
} from '@/lib/api';

export interface PerformanceBreakdownRow {
  key: string;
  label: string;
  source: string;
  campaign: string;
  clicks: number;
  reached: number;
  subscribers: number;
  unsubscribes: number;
}

function aggregate(
  rows: TrackingLinkReportRow[],
  identity: (row: TrackingLinkReportRow) => { key: string; label: string } | null,
) {
  const groups = new Map<string, PerformanceBreakdownRow>();

  for (const row of rows) {
    const item = identity(row);
    if (!item) continue;
    const source = row.utmSource?.trim() || 'Без utm_source';
    const campaign = row.campaignName?.trim() || row.utmCampaign?.trim() || 'Без кампанії';
    const key = `${source}::${campaign}::${item.key}`;
    const current = groups.get(key) ?? {
      key,
      label: item.label,
      source,
      campaign,
      clicks: 0,
      reached: 0,
      subscribers: 0,
      unsubscribes: 0,
    };
    current.clicks += row.clicks;
    current.reached += row.reached;
    current.subscribers += row.subscribers;
    current.unsubscribes += row.unsubscribes;
    groups.set(key, current);
  }

  return [...groups.values()].sort((a, b) => b.clicks - a.clicks || b.subscribers - a.subscribers);
}

/** S2-19: джерело → кампанія → креатив; creativeTag має пріоритет над utm_content. */
export function buildCreativeBreakdown(rows: TrackingLinkReportRow[]) {
  return aggregate(rows, (row) => {
    const label = row.creativeTag?.trim() || row.utmContent?.trim() || 'Без мітки креативу';
    return { key: label.toLocaleLowerCase('uk-UA'), label };
  });
}

/** S2-20: порівнюємо лише посилання, для яких справді заданий конкретний допис. */
export function buildLandingPostBreakdown(rows: TrackingLinkReportRow[]) {
  return aggregate(rows, (row) => {
    if (row.landingPostUrl) return { key: row.landingPostUrl, label: row.landingPostUrl };
    if (row.postNumber != null) return { key: `post-${row.postNumber}`, label: `Допис №${row.postNumber}` };
    return null;
  });
}

/** Fallback для поетапного деплою: старий API ще не має unsubscribe-timing endpoint. */
export function buildUnsubscribeTimingFromFeed(rows: UnsubscribeFeedRow[]): UnsubscribeTimingReport {
  const counts = { day1: 0, week: 0, month: 0, later: 0 };
  let unknown = 0;
  const dayMs = 86_400_000;

  for (const row of rows) {
    if (!row.subscribedAt) {
      unknown += 1;
      continue;
    }
    const start = new Date(row.subscribedAt).getTime();
    const end = new Date(row.occurredAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      unknown += 1;
      continue;
    }
    const duration = Math.max(0, end - start);
    if (duration < dayMs) counts.day1 += 1;
    else if (duration < 7 * dayMs) counts.week += 1;
    else if (duration < 30 * dayMs) counts.month += 1;
    else counts.later += 1;
  }

  const knownTotal = rows.length - unknown;
  const bucket = (count: number) => ({ count, share: knownTotal > 0 ? count / knownTotal : 0 });
  return {
    total: rows.length,
    knownTotal,
    unknown,
    buckets: {
      day1: bucket(counts.day1),
      week: bucket(counts.week),
      month: bucket(counts.month),
      later: bucket(counts.later),
    },
  };
}
