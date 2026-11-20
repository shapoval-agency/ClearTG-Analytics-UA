import { getSession } from './session';
import { getApiOrigin } from '@/lib/api-origin';

const API_URL = getApiOrigin();

export async function api<T>(
  path: string,
  options?: RequestInit & { workspaceId?: string },
): Promise<T> {
  const session = await getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }

  const workspaceId = options?.workspaceId ?? session.workspaceId;
  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (res.status === 401) {
    throw new AuthError('Unauthorized');
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface DashboardOverview {
  clicks: number;
  /** S2-10: кліки, де перехід у Telegram вимірювався. Нема в старому API. */
  reachTracked?: number;
  reached: number;
  reachRate: number;
  subscribers: number;
  activeSubscribers: number;
  unsubscribes: number;
  clickToSubscribeRate: number;
  retention: { d1: number; d7: number; d30: number; total: number };
  attributions: Array<{
    type: string;
    count: number;
    share: number;
    confidenceLabel: string;
  }>;
  dataIntegrity: { subscribers: number; attributed: number; missing: number; extra: number; ok: boolean };
  unknownSourceMonitor: {
    current: { total: number; unknown: number; share: number };
    previous: { total: number; unknown: number; share: number };
    change: number;
    alert: boolean;
  };
  insights?: Array<{
    id: string;
    kind: 'unknown-growth' | 'unsubscribe-spike' | 'source-drop';
    severity: 'warning' | 'critical';
    title: string;
    description: string;
    href: string;
  }>;
  deliveryStats: Array<{ status: string; count: number }>;
}

export interface IntegrationStatus {
  overall: 'working' | 'attention' | 'not-configured';
  channels: {
    total: number;
    active: number;
    ready: number;
    attention: number;
    lastCheckedAt: string | null;
  };
  tracking: {
    activeLinks: number;
    revokedInviteLinks: number;
    lastClickAt: string | null;
    mechanism: 'tracking-links';
  };
  ads: { connected: string[] };
}

export interface IntegrationDiagnostics {
  overall: 'working' | 'attention' | 'error';
  checkedAt: string;
  checks: Array<{
    id: string;
    label: string;
    status: 'ok' | 'warning' | 'error' | 'info';
    detail: string;
    actionHref?: string;
  }>;
}

export interface DigestSettings {
  enabled: boolean;
  frequency: 'DAILY' | 'WEEKDAYS' | 'WEEKLY';
  hour: number;
  channelIds: string[];
  telegramLinked: boolean;
}

/** GET /api/dashboard/campaigns — розріз «Джерела» в /v2/reports. */
export interface CampaignReportRow {
  id: string;
  name: string;
  adPlatform: string;
  channelTitle: string;
  clicks: number;
  reachTracked?: number;
  reached: number;
  reachRate: number;
  uniqueClickers: number;
  subscribers: number;
  unsubscribes: number;
  conversionRate: number;
}

/** GET /api/dashboard/tracking-links — розріз «Посилання» в /v2/reports. */
export interface TrackingLinkReportRow {
  id: string;
  slug: string;
  name: string | null;
  campaignName: string | null;
  /** Платформа кампанії — рівень «Джерело» в S2-19. Нема в старому API. */
  adPlatform?: string | null;
  channelTitle: string;
  clicks: number;
  reachTracked?: number;
  reached: number;
  reachRate: number;
  uniqueClickers: number;
  subscribers: number;
  unsubscribes: number;
  conversionRate: number;
  autoRedirect: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  creativeTag: string | null;
  postNumber: number | null;
  landingPostUrl: string | null;
}

/** GET /api/dashboard/bot-links — S2-04, клік vs старт бота. */
export interface BotLinkReportRow {
  id: string;
  name: string | null;
  campaignName: string | null;
  botUsername: string | null;
  isActive: boolean;
  clicks: number;
  starts: number;
  blocked: number;
  startRate: number;
}

/** GET /api/client-bots — S2-02, власний бот клієнта. */
export interface ClientBotConnection {
  id: string;
  botUsername: string;
  isActive: boolean;
  lastError: string | null;
  lastErrorAt: string | null;
  connectedAt: string;
}

/**
 * Частка «дійшли до Telegram» лише серед виміряних кліків (S2-10).
 * null — нічого не вимірювалось (усі кліки з миттєвим переходом).
 * Старе API без reachTracked рахувало від усіх кліків — повертаємо як було.
 */
export function measuredReach(row: { clicks: number; reached: number; reachTracked?: number }) {
  const tracked = row.reachTracked ?? row.clicks;
  return tracked > 0 ? { tracked, rate: row.reached / tracked } : null;
}

export interface UnsubscribeTimingBucket {
  count: number;
  share: number;
}

export interface UnsubscribeTimingReport {
  total: number;
  knownTotal: number;
  unknown: number;
  buckets: {
    day1: UnsubscribeTimingBucket;
    week: UnsubscribeTimingBucket;
    month: UnsubscribeTimingBucket;
    later: UnsubscribeTimingBucket;
  };
}

/** GET /api/dashboard/subscribers — рядок списку «Учасники». */
export interface SubscriberFeedRow {
  id: string;
  subscribedAt: string;
  channelTitle: string;
  telegramUserId: string;
  telegramUsername: string | null;
  isActive: boolean;
  joinSource: string;
  attributionType: string;
  campaignName: string | null;
  trackingLinkSlug: string | null;
  trackingLinkName: string | null;
  confidenceScore: number;
  utmSource: string | null;
  utmCampaign: string | null;
}

/** GET /api/dashboard/subscribers/:id — картка учасника. */
export interface SubscriberDossier {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  channel: { id: string; title: string; username: string | null };
  subscribedAt: string;
  isActive: boolean;
  daysInChannel: number;
  retainedD1: boolean | null;
  retainedD7: boolean | null;
  retainedD30: boolean | null;
  botStarted: boolean;
  botOptedOut: boolean;
  attribution: {
    type: string;
    confidence: number;
    reason: string;
    campaign: string | null;
    trackingLink: string | null;
    trackingLinkName?: string | null;
    utm: {
      source: string | null;
      medium: string | null;
      campaign: string | null;
      content: string | null;
      term: string | null;
    };
    creativeTag: string | null;
    postNumber: number | null;
    clickedAt: string | null;
    telegramOpenedAt: string | null;
    reachTracked?: boolean | null;
  } | null;
  unsubscribes: Array<{
    id: string;
    occurredAt: string;
    telegramUsername: string | null;
  }>;
  leadMagnets: Array<{ name: string; slug: string; claimedAt: string }>;
  conversions: Array<{ eventName: string; eventTime: string; status: string }>;
}

/** GET /api/dashboard/unsubscribes. */
export interface UnsubscribeFeedRow {
  id: string;
  occurredAt: string;
  channelTitle: string;
  telegramUserId: string;
  telegramUsername: string | null;
  subscribedAt: string | null;
  hasSubscriberProfile: boolean;
  attributionType: string | null;
  campaignName: string | null;
  trackingLinkSlug: string | null;
  trackingLinkName: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
}

export interface AuthMe {
  user: { id: string; email: string; name: string | null };
  isAgencyAdmin?: boolean;
  workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
}

export interface AgencyClient {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string | null;
  channels: number;
  subscribers: number;
  createdAt: string;
}
