import { describe, expect, it, vi } from 'vitest';
import { TelegramService } from './telegram.service';

type SubscribeRunner = {
  processSubscribe(
    workspaceId: string,
    channelId: string,
    telegramUserId: string,
    username: string | undefined,
    firstName: string | undefined,
    lastName: string | undefined,
    updateId: number,
    telegramInviteUrl?: string | null,
  ): Promise<void>;
};

function buildService(options: { duplicate?: boolean; activeProfile?: boolean } = {}) {
  const occurredAt = new Date('2026-10-30T10:00:00.000Z');
  const prisma = {
    membershipEvent: {
      findFirst: vi.fn().mockResolvedValue(options.duplicate ? { id: 'existing' } : null),
      create: vi.fn().mockResolvedValue({ id: 'membership_new', occurredAt }),
    },
    subscriberProfile: {
      findFirst: vi.fn().mockResolvedValue(
        options.activeProfile ? { id: 'profile_old', _count: { unsubscribeEvents: 0 } } : null,
      ),
      create: vi.fn().mockResolvedValue({ id: 'profile_new' }),
    },
    unsubscribeEvent: { create: vi.fn().mockResolvedValue({ id: 'unsub_recovered' }) },
  };
  const logger = { warn: vi.fn(), error: vi.fn(), log: vi.fn() };
  const attribution = { attributeMembership: vi.fn().mockResolvedValue(undefined) };
  const conversion = { createSubscribeEvent: vi.fn().mockResolvedValue(undefined) };
  const crypto = { getHashSalt: vi.fn().mockReturnValue('salt') };
  const inviteLinks = { findByTelegramUrl: vi.fn().mockResolvedValue(null) };
  const service = new TelegramService(
    prisma as never,
    logger as never,
    { get: vi.fn() } as never,
    attribution as never,
    conversion as never,
    crypto as never,
    {} as never,
    inviteLinks as never,
    {} as never,
  ) as unknown as SubscribeRunner;
  return { service, prisma, logger, attribution, conversion };
}

describe('TelegramService.processSubscribe', () => {
  it('ігнорує повторну доставку того самого Telegram update', async () => {
    const { service, prisma } = buildService({ duplicate: true });

    await service.processSubscribe('ws_1', 'ch_1', '42', 'user', 'Name', undefined, 1001);

    expect(prisma.membershipEvent.create).not.toHaveBeenCalled();
    expect(prisma.subscriberProfile.findFirst).not.toHaveBeenCalled();
  });

  it('закриває старий активний цикл і створює нову підписку, якщо webhook відписки загубився', async () => {
    const { service, prisma, logger, attribution, conversion } = buildService({ activeProfile: true });

    await service.processSubscribe('ws_1', 'ch_1', '42', 'user', 'Name', undefined, 1002);

    expect(prisma.unsubscribeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subscriberProfileId: 'profile_old',
        telegramUserId: '42',
        occurredAt: new Date('2026-10-30T10:00:00.000Z'),
      }),
    });
    expect(prisma.subscriberProfile.create).toHaveBeenCalled();
    expect(attribution.attributeMembership).toHaveBeenCalledWith('membership_new', null);
    expect(conversion.createSubscribeEvent).toHaveBeenCalledWith('membership_new');
    expect(logger.warn).toHaveBeenCalled();
  });
});
