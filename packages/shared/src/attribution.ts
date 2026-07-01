export type AttributionType =
  | 'EXACT_CLICK_INVITE'
  | 'CAMPAIGN_INVITE'
  | 'PROBABILISTIC'
  | 'ORGANIC'
  | 'UNKNOWN';

export interface ClickCandidate {
  id: string;
  campaignId: string | null;
  trackingLinkId: string;
  clickedAt: Date;
}

export interface InviteLinkCandidate {
  id: string;
  clickEventId: string | null;
  campaignId: string | null;
  trackingLinkId: string | null;
  createdAt: Date;
}

export interface AttributionInput {
  membershipEventId: string;
  channelId: string;
  subscribedAt: Date;
  attributionWindowMinutes: number;
  inviteLinkUsed?: InviteLinkCandidate | null;
  recentClicks: ClickCandidate[];
}

export interface AttributionResult {
  attributionType: AttributionType;
  confidenceScore: number;
  reason: string;
  clickEventId: string | null;
  campaignId: string | null;
  trackingLinkId: string | null;
  attributionWindowMinutes: number;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60);
}

function withinWindow(
  clickTime: Date,
  subscribeTime: Date,
  windowMinutes: number,
): boolean {
  const diff = subscribeTime.getTime() - clickTime.getTime();
  return diff >= 0 && diff <= windowMinutes * 60 * 1000;
}

export function attributeSubscription(input: AttributionInput): AttributionResult {
  const {
    subscribedAt,
    attributionWindowMinutes,
    inviteLinkUsed,
    recentClicks,
  } = input;

  const base = {
    attributionWindowMinutes,
    clickEventId: null as string | null,
    campaignId: null as string | null,
    trackingLinkId: null as string | null,
  };

  // 1. Exact click → invite link match
  if (inviteLinkUsed?.clickEventId) {
    const matchedClick = recentClicks.find((c) => c.id === inviteLinkUsed.clickEventId);
    if (matchedClick && withinWindow(matchedClick.clickedAt, subscribedAt, attributionWindowMinutes)) {
      return {
        ...base,
        attributionType: 'EXACT_CLICK_INVITE',
        confidenceScore: 0.98,
        reason: 'Invite link was created for a specific click and used within attribution window',
        clickEventId: matchedClick.id,
        campaignId: matchedClick.campaignId ?? inviteLinkUsed.campaignId,
        trackingLinkId: matchedClick.trackingLinkId ?? inviteLinkUsed.trackingLinkId,
      };
    }
  }

  // 2. Campaign-level invite link (no specific click)
  if (inviteLinkUsed && !inviteLinkUsed.clickEventId) {
  const campaignClicks = recentClicks.filter(
      (c) =>
        c.campaignId &&
        inviteLinkUsed.campaignId &&
        c.campaignId === inviteLinkUsed.campaignId &&
        withinWindow(c.clickedAt, subscribedAt, attributionWindowMinutes),
    );

    if (campaignClicks.length > 0) {
      const best = campaignClicks.sort(
        (a, b) => subscribedAt.getTime() - a.clickedAt.getTime() - (subscribedAt.getTime() - b.clickedAt.getTime()),
      )[0];

      return {
        ...base,
        attributionType: 'CAMPAIGN_INVITE',
        confidenceScore: 0.82,
        reason: 'Campaign invite link used; matched to nearest click in same campaign',
        clickEventId: best.id,
        campaignId: best.campaignId,
        trackingLinkId: best.trackingLinkId,
      };
    }

    if (inviteLinkUsed.campaignId) {
      return {
        ...base,
        attributionType: 'CAMPAIGN_INVITE',
        confidenceScore: 0.65,
        reason: 'Campaign invite link used but no matching click found in window',
        campaignId: inviteLinkUsed.campaignId,
        trackingLinkId: inviteLinkUsed.trackingLinkId,
      };
    }
  }

  // 3. Probabilistic: nearest click in window
  const eligibleClicks = recentClicks
    .filter((c) => withinWindow(c.clickedAt, subscribedAt, attributionWindowMinutes))
    .sort((a, b) => minutesBetween(a.clickedAt, subscribedAt) - minutesBetween(b.clickedAt, subscribedAt));

  if (eligibleClicks.length > 0) {
    const best = eligibleClicks[0];
    const minutesAgo = minutesBetween(best.clickedAt, subscribedAt);
    const windowRatio = minutesAgo / attributionWindowMinutes;

    let confidence: number;
    if (windowRatio < 0.05) confidence = 0.72;
    else if (windowRatio < 0.2) confidence = 0.58;
    else if (windowRatio < 0.5) confidence = 0.42;
    else confidence = 0.28;

    if (eligibleClicks.length > 3) {
      confidence = Math.max(0.2, confidence - 0.1);
    }

    return {
      ...base,
      attributionType: 'PROBABILISTIC',
      confidenceScore: confidence,
      reason: `Probabilistic match: nearest click ${Math.round(minutesAgo)} min before subscription (${eligibleClicks.length} candidates)`,
      clickEventId: best.id,
      campaignId: best.campaignId,
      trackingLinkId: best.trackingLinkId,
    };
  }

  // 4. No ad clicks — organic
  if (recentClicks.length === 0) {
    return {
      ...base,
      attributionType: 'ORGANIC',
      confidenceScore: 0.5,
      reason: 'No tracked ad clicks found for this channel in attribution window',
    };
  }

  // 5. Unknown
  return {
    ...base,
    attributionType: 'UNKNOWN',
    confidenceScore: 0.1,
    reason: 'Could not determine subscription source with sufficient data',
  };
}

const ATTRIBUTION_TYPE_LABELS: Record<AttributionType, string> = {
  EXACT_CLICK_INVITE: 'Точне (invite з кліку)',
  CAMPAIGN_INVITE: 'Кампанія (invite)',
  PROBABILISTIC: 'Ймовірне (найближчий клік)',
  ORGANIC: 'Органіка',
  UNKNOWN: 'Невідомо',
};

export function attributionTypeLabel(type: AttributionType | string): string {
  return ATTRIBUTION_TYPE_LABELS[type as AttributionType] ?? type;
}
