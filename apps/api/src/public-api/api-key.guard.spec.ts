import { describe, expect, it, vi } from 'vitest';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

function setup(opts: { key?: { id: string; workspaceId: string } | null; allowed?: boolean } = {}) {
  const service = {
    resolveKey: vi.fn().mockResolvedValue(opts.key === undefined ? { id: 'k1', workspaceId: 'ws1' } : opts.key),
    takeRateLimit: vi.fn().mockResolvedValue({ allowed: opts.allowed ?? true, retryAfterSec: 12 }),
  };
  return { guard: new ApiKeyGuard(service as never), service };
}

function ctx(headers: Record<string, string>) {
  const request: Record<string, unknown> = { headers };
  const reply = { headers: {} as Record<string, unknown>, header(n: string, v: unknown) { this.headers[n] = v; } };
  return {
    request,
    reply,
    context: { switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }) } as never,
  };
}

describe('ApiKeyGuard', () => {
  it('lets a valid key through and binds its workspace', async () => {
    const { guard } = setup();
    const c = ctx({ authorization: 'Bearer ctg_good' });
    await expect(guard.canActivate(c.context)).resolves.toBe(true);
    expect(c.request.workspaceId).toBe('ws1');
  });

  it('ignores x-workspace-id from the caller', async () => {
    const { guard } = setup();
    const c = ctx({ authorization: 'Bearer ctg_good', 'x-workspace-id': 'someone_else' });
    await guard.canActivate(c.context);
    expect(c.request.workspaceId).toBe('ws1');
  });

  it('rejects a missing key without touching the database', async () => {
    const { guard, service } = setup();
    await expect(guard.canActivate(ctx({}).context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.resolveKey).not.toHaveBeenCalled();
  });

  it('rejects an unknown or revoked key', async () => {
    const { guard } = setup({ key: null });
    await expect(guard.canActivate(ctx({ 'x-api-key': 'ctg_bad' }).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('answers 429 with Retry-After over the limit', async () => {
    const { guard } = setup({ allowed: false });
    const c = ctx({ authorization: 'Bearer ctg_good' });
    const err = await guard.canActivate(c.context).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(c.reply.headers['Retry-After']).toBe(12);
  });
});
