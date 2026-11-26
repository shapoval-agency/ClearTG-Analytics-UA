import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const startMock = vi.fn();
vi.mock('grammy', () => {
  class GrammyError extends Error {
    constructor(public error_code: number, public description: string) {
      super(`Call to 'getUpdates' failed! (${error_code}: ${description})`);
    }
  }
  class Bot {
    command() {}
    on() {}
    catch() {}
    start(opts: unknown) { return startMock(opts); }
    stop() { return Promise.resolve(); }
  }
  return { Bot, GrammyError };
});

import { GrammyError } from 'grammy';
import { ClientBotRuntimeService } from './client-bot-runtime.service';

function build() {
  const prisma = {
    telegramBotConnection: {
      update: vi.fn().mockResolvedValue({ workspaceId: 'ws', botUsername: 'cleartg_test_bot' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn(),
    },
  };
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const telegram = { getBot: vi.fn().mockReturnValue(null) };
  const runtime = new ClientBotRuntimeService(prisma as never, { decrypt: (v: string) => v } as never, logger as never, telegram as never, {} as never);
  return { runtime, prisma, logger };
}

const conflict = () => new (GrammyError as unknown as new (c: number, d: string) => Error)(409, 'Conflict: terminated by other getUpdates request; make sure that only one bot instance is running');

describe('ClientBotRuntimeService start failures', () => {
  beforeEach(() => { vi.useFakeTimers(); startMock.mockReset(); });
  afterEach(() => vi.useRealTimers());

  it('409 під час деплою не вимикає бота, а повторює старт і відновлюється', async () => {
    const { runtime, prisma, logger } = build();
    startMock.mockRejectedValueOnce(conflict()).mockImplementationOnce((opts: { onStart: () => void }) => {
      opts.onStart();
      return new Promise(() => {});
    });

    await runtime.startBot('conn_1', 'token');
    await vi.runOnlyPendingTimersAsync();

    expect(prisma.telegramBotConnection.update).not.toHaveBeenCalled(); // не вимкнули
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Повтор через 5 с'), 'ClientBot');
    expect(startMock).toHaveBeenCalledTimes(2);
    expect(prisma.telegramBotConnection.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { isActive: true, lastError: null, lastErrorAt: null },
    }));
  });

  it('відкликаний токен (401) вимикає бота одразу, без повторів', async () => {
    const { runtime, prisma } = build();
    startMock.mockRejectedValueOnce(new (GrammyError as unknown as new (c: number, d: string) => Error)(401, 'Unauthorized'));

    await runtime.startBot('conn_1', 'token');
    await vi.runOnlyPendingTimersAsync();

    expect(startMock).toHaveBeenCalledTimes(1);
    expect(prisma.telegramBotConnection.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isActive: false }),
    }));
  });

  it('після вичерпання повторів бот вимикається з поясненням', async () => {
    const { runtime, prisma } = build();
    startMock.mockRejectedValue(conflict());

    await runtime.startBot('conn_1', 'token');
    for (let i = 0; i < 8; i++) await vi.runOnlyPendingTimersAsync();

    expect(startMock).toHaveBeenCalledTimes(7); // 1 + 6 повторів
    expect(prisma.telegramBotConnection.update).toHaveBeenCalledTimes(1);
  });

  it('зупинка скасовує заплановані повтори', async () => {
    const { runtime } = build();
    startMock.mockRejectedValue(conflict());
    await runtime.startBot('conn_1', 'token');
    await vi.advanceTimersByTimeAsync(0);
    await runtime.stopBot('conn_1');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(startMock).toHaveBeenCalledTimes(1);
  });
});

describe('ClientBotRuntimeService — токен зі старим ключем', () => {
  it('не розшифровується → бот вимикається з поясненням, старт не намагається', async () => {
    const prisma = {
      telegramBotConnection: {
        findMany: vi.fn().mockResolvedValue([{ id: 'conn_1', isActive: true, tokenEnc: 'old', lastError: null }]),
        update: vi.fn().mockResolvedValue({ workspaceId: 'ws', botUsername: 'cleartg_test_bot' }),
        updateMany: vi.fn(),
      },
    };
    const crypto = { decrypt: () => { throw new Error('Unsupported state or unable to authenticate data'); } };
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const runtime = new ClientBotRuntimeService(prisma as never, crypto as never, logger as never, { getBot: () => null } as never, {} as never);
    startMock.mockReset();

    await runtime.onModuleInit();

    expect(startMock).not.toHaveBeenCalled();
    expect(prisma.telegramBotConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn_1' },
      data: expect.objectContaining({ isActive: false, lastError: expect.stringContaining('TOKEN_UNREADABLE') }),
    });
  });
});
