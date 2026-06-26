'use client';

const STORAGE_KEY = 'cleartg_local_v1';

export interface LocalChannel {
  id: string;
  title: string;
  username?: string;
  botIsAdmin: boolean;
  clicks: number;
  membershipEvents: number;
}

export interface LocalCampaign {
  id: string;
  channelId: string;
  name: string;
  adPlatform: string;
  source?: string;
  medium?: string;
  clicks: number;
  subscribers: number;
}

export interface LocalLink {
  id: string;
  channelId: string;
  campaignId?: string;
  slug: string;
  name: string;
  linkMode: 'LANDING_PAGE' | 'SHORTLINK';
  clicks: number;
  subscribers: number;
}

export interface LocalMeta {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
}

export interface LocalState {
  version: 1;
  user: { email: string; name: string };
  workspace: { id: string; name: string; slug: string };
  channels: LocalChannel[];
  campaigns: LocalCampaign[];
  links: LocalLink[];
  meta?: LocalMeta;
}

function newId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function newSlug() {
  return Math.random().toString(36).slice(2, 12);
}

export function createInitialState(email: string): LocalState {
  return {
    version: 1,
    user: { email, name: 'Admin' },
    workspace: { id: 'local-ws', name: 'Мій workspace', slug: 'main' },
    channels: [],
    campaigns: [],
    links: [],
  };
}

export function loadState(): LocalState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalState;
  } catch {
    return null;
  }
}

export function saveState(state: LocalState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function ensureState(email: string): LocalState {
  const existing = loadState();
  if (existing) return existing;
  const initial = createInitialState(email);
  saveState(initial);
  return initial;
}

export function addChannel(state: LocalState, data: { title: string; username?: string }): LocalState {
  const next: LocalState = {
    ...state,
    channels: [
      ...state.channels,
      {
        id: newId(),
        title: data.title,
        username: data.username,
        botIsAdmin: true,
        clicks: 0,
        membershipEvents: 0,
      },
    ],
  };
  saveState(next);
  return next;
}

export function addCampaign(
  state: LocalState,
  data: { channelId: string; name: string; adPlatform?: string; source?: string; medium?: string },
): LocalState {
  const next: LocalState = {
    ...state,
    campaigns: [
      ...state.campaigns,
      {
        id: newId(),
        channelId: data.channelId,
        name: data.name,
        adPlatform: data.adPlatform ?? 'META',
        source: data.source,
        medium: data.medium,
        clicks: 0,
        subscribers: 0,
      },
    ],
  };
  saveState(next);
  return next;
}

export function addLink(
  state: LocalState,
  data: {
    channelId: string;
    campaignId?: string;
    name: string;
    linkMode: 'LANDING_PAGE' | 'SHORTLINK';
  },
): LocalState {
  const next: LocalState = {
    ...state,
    links: [
      ...state.links,
      {
        id: newId(),
        channelId: data.channelId,
        campaignId: data.campaignId,
        slug: newSlug(),
        name: data.name,
        linkMode: data.linkMode,
        clicks: 0,
        subscribers: 0,
      },
    ],
  };
  saveState(next);
  return next;
}

export function saveMeta(state: LocalState, meta: LocalMeta): LocalState {
  const next = { ...state, meta };
  saveState(next);
  return next;
}

export function getOverview(state: LocalState) {
  const clicks = state.links.reduce((s, l) => s + l.clicks, 0);
  const subscribers = state.links.reduce((s, l) => s + l.subscribers, 0);
  return {
    clicks,
    subscribers,
    unsubscribes: 0,
    clickToSubscribeRate: clicks > 0 ? subscribers / clicks : 0,
    retention: { d1: 0, d7: 0, d30: 0, total: subscribers },
    attributions: [] as Array<{ type: string; count: number; share: number; confidenceLabel: string }>,
    deliveryStats: [] as Array<{ status: string; count: number }>,
  };
}

export function channelById(state: LocalState, id: string) {
  return state.channels.find((c) => c.id === id);
}

export function campaignById(state: LocalState, id: string) {
  return state.campaigns.find((c) => c.id === id);
}
