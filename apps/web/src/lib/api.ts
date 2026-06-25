import { getSession } from './session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
  subscribers: number;
  unsubscribes: number;
  clickToSubscribeRate: number;
  retention: { d1: number; d7: number; d30: number; total: number };
  attributions: Array<{
    type: string;
    count: number;
    share: number;
    confidenceLabel: string;
  }>;
  deliveryStats: Array<{ status: string; count: number }>;
}

export interface AuthMe {
  user: { id: string; email: string; name: string | null };
  workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
}
