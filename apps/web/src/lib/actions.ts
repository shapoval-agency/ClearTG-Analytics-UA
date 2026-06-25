'use server';

import { redirect } from 'next/navigation';
import { setSession, setWorkspace, clearSession } from './session';

import { getApiOrigin } from '@/lib/api-origin';

const API_URL = getApiOrigin();

export async function logoutAction() {
  await clearSession();
  redirect('/login');
}

export async function createWorkspaceAction(name: string) {
  const { cookies } = await import('next/headers');
  const token = (await cookies()).get('cleartg_token')?.value;
  if (!token) redirect('/login');

  const res = await fetch(`${API_URL}/api/workspaces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    return { error: 'Не вдалося створити workspace' };
  }

  const workspace = await res.json();
  await setWorkspace(workspace.id);
  redirect('/dashboard');
}

export async function saveMetaIntegrationAction(data: {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
}) {
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const token = jar.get('cleartg_token')?.value;
  const workspaceId = jar.get('cleartg_workspace')?.value;
  if (!token || !workspaceId) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/meta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-workspace-id': workspaceId,
    },
    body: JSON.stringify(data),
  });
  return { ok: res.ok };
}

export async function testMetaEventAction() {
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const token = jar.get('cleartg_token')?.value;
  const workspaceId = jar.get('cleartg_workspace')?.value;
  if (!token || !workspaceId) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/meta/test-event`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-workspace-id': workspaceId,
    },
  });
  const body = await res.json();
  return { ok: res.ok, body };
}

export async function saveGA4IntegrationAction(data: {
  measurementId: string;
  apiSecret: string;
  streamId?: string;
}) {
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const token = jar.get('cleartg_token')?.value;
  const workspaceId = jar.get('cleartg_workspace')?.value;
  if (!token || !workspaceId) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/ga4`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-workspace-id': workspaceId,
    },
    body: JSON.stringify(data),
  });
  return { ok: res.ok };
}

export async function testGA4EventAction() {
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const token = jar.get('cleartg_token')?.value;
  const workspaceId = jar.get('cleartg_workspace')?.value;
  if (!token || !workspaceId) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/ga4/test-event`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-workspace-id': workspaceId,
    },
  });
  const body = await res.json();
  return { ok: res.ok, body };
}

export async function createLeadMagnetAction(data: {
  channelId: string;
  name: string;
  contentUrl?: string;
  consentText: string;
  description?: string;
}) {
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const token = jar.get('cleartg_token')?.value;
  const workspaceId = jar.get('cleartg_workspace')?.value;
  if (!token || !workspaceId) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/lead-magnets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-workspace-id': workspaceId,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) return { error: 'Не вдалося створити lead magnet' };
  const body = await res.json();
  return { ok: true, botLink: body.botLink as string };
}

async function googleAdsHeaders() {
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const token = jar.get('cleartg_token')?.value;
  const workspaceId = jar.get('cleartg_workspace')?.value;
  if (!token || !workspaceId) return null;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-workspace-id': workspaceId,
  };
}

export async function saveGoogleAdsIntegrationAction(data: {
  customerId: string;
  conversionActionId: string;
  managerAccountId?: string;
}) {
  const headers = await googleAdsHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/google-ads`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return { ok: res.ok, error: res.ok ? undefined : 'Не вдалося зберегти' };
}

export async function getGoogleAdsAuthUrlAction() {
  const headers = await googleAdsHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/google-ads/auth-url`, { headers });
  if (!res.ok) return { error: 'OAuth URL недоступний' };
  const body = await res.json();
  return { url: body.url as string };
}

export async function testGoogleAdsEventAction() {
  const headers = await googleAdsHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/google-ads/test-event`, {
    method: 'POST',
    headers,
  });
  const body = await res.json();
  return { ok: res.ok, body };
}

export async function saveTikTokIntegrationAction(data: {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
}) {
  const headers = await googleAdsHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/tiktok`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return { ok: res.ok, error: res.ok ? undefined : 'Не вдалося зберегти' };
}

export async function testTikTokEventAction() {
  const headers = await googleAdsHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/tiktok/test-event`, {
    method: 'POST',
    headers,
  });
  const body = await res.json();
  return { ok: res.ok, body };
}
