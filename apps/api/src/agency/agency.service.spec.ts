import { describe, it, expect, vi } from 'vitest';
import { AgencyService } from './agency.service';

function build(opts: { member?: boolean } = {}) {
  const prisma = {
    workspace: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'w1', name: 'Мій', createdAt: new Date(), _count: { channels: 1, subscriberProfiles: 5 },
          members: [{ userId: 'admin', role: 'ADMIN', user: { email: 'admin@a.ua' } }, { userId: 'o1', role: 'OWNER', user: { email: 'o1@x.ua' } }] },
        { id: 'w2', name: 'Чужий', createdAt: new Date(), _count: { channels: 0, subscriberProfiles: 0 },
          members: [{ userId: 'o2', role: 'OWNER', user: { email: 'o2@x.ua' } }] },
      ]),
      findUnique: vi.fn().mockResolvedValue({ id: 'w2', name: 'Чужий', members: [{ user: { email: 'o2@x.ua' } }] }),
    },
    workspaceMember: { findUnique: vi.fn().mockResolvedValue(opts.member ? { id: 'm' } : null) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  return { service: new AgencyService(prisma as never, { get: vi.fn() } as never, {} as never), prisma };
}

describe('AgencyService — усі кабінети', () => {
  it('показує й кабінети, де адміністратор не учасник', async () => {
    const { service } = build();
    const list = await service.listAllWorkspaces('admin');
    expect(list.map((w) => [w.id, w.isMember, w.ownerEmail])).toEqual([
      ['w1', true, 'o1@x.ua'],
      ['w2', false, 'o2@x.ua'],
    ]);
  });

  it('вхід у чужий кабінет пишеться в журнал аудиту цього кабінету', async () => {
    const { service, prisma } = build();
    const result = await service.recordAdminView('admin', 'admin@a.ua', 'w2');
    expect(result).toMatchObject({ id: 'w2', readOnly: true });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ workspaceId: 'w2', userId: 'admin', action: 'platform_admin_view' }),
    });
  });

  it('у власний кабінет — без запису й без обмежень', async () => {
    const { service, prisma } = build({ member: true });
    expect((await service.recordAdminView('admin', 'admin@a.ua', 'w2')).readOnly).toBe(false);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
