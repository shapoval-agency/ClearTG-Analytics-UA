import { describe, it, expect, vi } from 'vitest';

vi.mock('grammy', () => ({
  Bot: class {
    api = { getMe: () => Promise.resolve({ username: 'cleartg_test_bot' }) };
  },
}));

import { ClientBotConnectionService } from './client-bot-connection.service';

function build(existing: Record<string, unknown> | null) {
  const prisma = {
    telegramBotConnection: {
      findFirst: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'conn_1', botUsername: 'cleartg_test_bot', connectedAt: new Date(), ...data })),
      create: vi.fn(),
    },
  };
  const crypto = { encrypt: vi.fn().mockReturnValue('new_enc') };
  const runtime = { startBot: vi.fn().mockResolvedValue(undefined) };
  const service = new ClientBotConnectionService(prisma as never, crypto as never, runtime as never);
  return { service, prisma, runtime };
}

describe('ClientBotConnectionService.create — перепідключення', () => {
  it('бот із нечитабельним токеном перепідключається тим самим записом (історія зберігається)', async () => {
    const { service, prisma, runtime } = build({
      id: 'conn_1', isActive: false, lastError: 'TOKEN_UNREADABLE: …',
    });

    await service.create('ws', '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

    expect(prisma.telegramBotConnection.create).not.toHaveBeenCalled();
    expect(prisma.telegramBotConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn_1' },
      data: { tokenEnc: 'new_enc', isActive: true, lastError: null, lastErrorAt: null },
    });
    expect(runtime.startBot).toHaveBeenCalledWith('conn_1', '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  });

  it('активного бота повторно не підключає', async () => {
    const { service } = build({ id: 'conn_1', isActive: true, lastError: null });
    await expect(service.create('ws', '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).rejects.toThrow('уже підключений');
  });
});
