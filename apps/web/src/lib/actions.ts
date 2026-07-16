'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { setWorkspace, clearSession, clearWorkspace } from './session';
import { getApiOrigin } from '@/lib/api-origin';

const API_URL = getApiOrigin();

async function tokenHeaders() {
  const jar = await cookies();
  const token = jar.get('cleartg_token')?.value;
  if (!token) return null;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function authHeaders() {
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

export async function logoutAction() {
  await clearSession();
  redirect('/login');
}

export async function switchWorkspaceAction(workspaceId: string) {
  const jar = await cookies();
  const token = jar.get('cleartg_token')?.value;
  if (!token) redirect('/login');

  await setWorkspace(workspaceId);
  redirect('/dashboard');
}

export async function createClientWorkspaceAction(data: {
  name: string;
  ownerEmail: string;
}) {
  const headers = await tokenHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/agency/clients`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      error:
        (body as { message?: string }).message?.toString() ??
        'Не вдалося створити клієнта',
    };
  }

  const client = (await res.json()) as { id: string };
  await setWorkspace(client.id);
  redirect('/dashboard');
}

export async function deleteClientWorkspaceAction(workspaceId: string) {
  const headers = await tokenHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const jar = await cookies();
  const currentWorkspace = jar.get('cleartg_workspace')?.value;

  const res = await fetch(`${API_URL}/api/agency/clients/${workspaceId}/delete`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      error:
        (body as { message?: string }).message?.toString() ??
        'Не вдалося видалити клієнта',
    };
  }

  if (currentWorkspace === workspaceId) {
    await clearWorkspace();
  }

  redirect('/agency/clients');
}

export async function inviteMemberAction(data: { email: string; role?: string }) {
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/workspaces/current/members`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    return { error: 'Не вдалося запросити учасника' };
  }

  return { ok: true };
}

export async function createWorkspaceAction(name: string) {
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

export async function createCampaignAction(data: {
  channelId: string;
  name: string;
  adPlatform?: string;
  source?: string;
  medium?: string;
}) {
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/campaigns`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) return { error: 'Не вдалося створити кампанію' };
  redirect('/campaigns');
}

export async function createTrackingLinkAction(data: {
  channelId: string;
  campaignId?: string;
  name?: string;
  linkMode?: 'LANDING_PAGE' | 'SHORTLINK';
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}) {
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/tracking-links`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      autoRedirect: true,
      redirectDelayMs: 0,
      usePerClickInvite: data.linkMode !== 'SHORTLINK',
      destinationMode: data.linkMode === 'SHORTLINK' ? 'PUBLIC_POST' : 'INVITE_LINK',
      ...data,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: (body as { message?: string | string[] }).message?.toString() ?? 'Не вдалося створити посилання' };
  }

  redirect('/links');
}

export async function saveMetaIntegrationAction(data: {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
}) {
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/meta`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return { ok: res.ok };
}

export async function testMetaEventAction() {
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/meta/test-event`, {
    method: 'POST',
    headers,
  });
  const body = await res.json();
  return { ok: res.ok, body };
}

export async function saveGA4IntegrationAction(data: {
  measurementId: string;
  apiSecret: string;
  streamId?: string;
}) {
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/ga4`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return { ok: res.ok };
}

export async function testGA4EventAction() {
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/ga4/test-event`, {
    method: 'POST',
    headers,
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
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/lead-magnets`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) return { error: 'Не вдалося створити lead magnet' };
  const body = await res.json();
  return { ok: true, botLink: body.botLink as string };
}

export async function saveGoogleAdsIntegrationAction(data: {
  customerId: string;
  conversionActionId: string;
  managerAccountId?: string;
}) {
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/google-ads`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return { ok: res.ok, error: res.ok ? undefined : 'Не вдалося зберегти' };
}

export async function getGoogleAdsAuthUrlAction() {
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/google-ads/auth-url`, { headers });
  if (!res.ok) return { error: 'OAuth URL недоступний' };
  const body = await res.json();
  return { url: body.url as string };
}

export async function testGoogleAdsEventAction() {
  const headers = await authHeaders();
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
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/tiktok`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return { ok: res.ok, error: res.ok ? undefined : 'Не вдалося зберегти' };
}

export async function testTikTokEventAction() {
  const headers = await authHeaders();
  if (!headers) return { error: 'Not authenticated' };

  const res = await fetch(`${API_URL}/api/integrations/tiktok/test-event`, {
    method: 'POST',
    headers,
  });
  const body = await res.json();
  return { ok: res.ok, body };
}
