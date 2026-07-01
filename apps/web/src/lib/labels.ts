export function attributionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    EXACT_CLICK_INVITE: 'Точне (invite з кліку)',
    CAMPAIGN_INVITE: 'Кампанія (invite)',
    PROBABILISTIC: 'Ймовірне (найближчий клік)',
    ORGANIC: 'Органіка',
    UNKNOWN: 'Невідомо',
  };
  return map[type] ?? type;
}

export function confidenceLabelUk(score: number): string {
  if (score >= 0.95) return 'точно';
  if (score >= 0.75) return 'висока';
  if (score >= 0.5) return 'середня';
  if (score >= 0.25) return 'низька';
  return 'невідомо';
}

export function formatDateUk(d: string | Date) {
  return new Date(d).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function sourceSummary(row: {
  attributionType: string | null;
  campaignName: string | null;
  trackingLinkSlug: string | null;
  trackingLinkName?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
}) {
  const parts: string[] = [];
  if (row.campaignName) parts.push(row.campaignName);
  if (row.trackingLinkSlug) {
    parts.push(`/${row.trackingLinkSlug}`);
  } else if (row.trackingLinkName) {
    parts.push(row.trackingLinkName);
  }
  if (row.utmSource) parts.push(`utm: ${row.utmSource}`);
  if (row.utmCampaign && row.utmCampaign !== row.campaignName) {
    parts.push(row.utmCampaign);
  }
  if (parts.length === 0 && row.attributionType) {
    parts.push(attributionTypeLabel(row.attributionType));
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}
