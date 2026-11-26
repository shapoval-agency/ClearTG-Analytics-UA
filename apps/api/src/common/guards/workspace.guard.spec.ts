import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { WorkspaceGuard } from './workspace.guard';

function setup(opts: { member?: boolean; workspaceExists?: boolean; adminEmail?: string } = {}) {
  const prisma = {
    workspaceMember: { findUnique: vi.fn().mockResolvedValue(opts.member ? { role: 'OWNER' } : null) },
    workspace: { findUnique: vi.fn().mockResolvedValue(opts.workspaceExists === false ? null : { id: 'ws_2' }) },
  };
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) };
  const config = { get: vi.fn().mockReturnValue(opts.adminEmail ?? 'admin@agency.ua') };
  return new WorkspaceGuard(prisma as never, reflector as never, config as never);
}

function ctx(request: Record<string, unknown>) {
  return { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => request }) } as never;
}

describe('WorkspaceGuard — адміністратор платформи', () => {
  it('учасник кабінету проходить як і раніше', async () => {
    const req = { user: { id: 'u1', email: 'owner@x.ua' }, headers: { 'x-workspace-id': 'ws_1' }, method: 'POST' };
    await expect(setup({ member: true }).canActivate(ctx(req))).resolves.toBe(true);
  });

  it('звичайний користувач не бачить чужий кабінет', async () => {
    const req = { user: { id: 'u1', email: 'someone@x.ua' }, headers: { 'x-workspace-id': 'ws_2' }, method: 'GET' };
    await expect(setup().canActivate(ctx(req))).rejects.toThrow('Not a member');
  });

  it('адміністратор бачить чужий кабінет у режимі перегляду', async () => {
    const req: Record<string, unknown> = { user: { id: 'a1', email: 'Admin@Agency.ua' }, headers: { 'x-workspace-id': 'ws_2' }, method: 'GET' };
    await expect(setup().canActivate(ctx(req))).resolves.toBe(true);
    expect(req.workspaceId).toBe('ws_2');
    expect(req.platformAdminView).toBe(true);
  });

  it('адміністратор не може змінювати дані в чужому кабінеті', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const req = { user: { id: 'a1', email: 'admin@agency.ua' }, headers: { 'x-workspace-id': 'ws_2' }, method };
      await expect(setup().canActivate(ctx(req))).rejects.toThrow(/лише переглядати/);
    }
  });

  it('неіснуючий кабінет — відмова навіть адміністратору', async () => {
    const req = { user: { id: 'a1', email: 'admin@agency.ua' }, headers: { 'x-workspace-id': 'nope' }, method: 'GET' };
    await expect(setup({ workspaceExists: false }).canActivate(ctx(req))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('без AGENCY_ADMIN_EMAIL ніхто не отримує доступ до чужих кабінетів', async () => {
    const req = { user: { id: 'a1', email: 'admin@agency.ua' }, headers: { 'x-workspace-id': 'ws_2' }, method: 'GET' };
    await expect(setup({ adminEmail: '' }).canActivate(ctx(req))).rejects.toThrow('Not a member');
  });
});
