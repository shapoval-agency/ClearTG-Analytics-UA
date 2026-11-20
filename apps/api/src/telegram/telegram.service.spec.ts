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

describe('TelegramService.handleJoinRequest (S2-14 / S2-15)', () => {
  const request = {
    chat: { id: -1001, type: 'channel' },
    from: { id: 42, username: 'anna', first_name: 'Anna' },
    invite_link: { invite_link: 'https://t.me/+click' },
  };

  function buildJoinService(channel: Record<string, unknown> | null, approve = vi.fn().mockResolvedValue(true)) {
    const prisma = {
      channel: { findFirst: vi.fn().mockResolvedValue(channel) },
      webhookEventRaw: { create: vi.fn().mockResolvedValue({}) },
      membershipEvent: { create: vi.fn().mockResolvedValue({ id: 'jr_1' }) },
    };
    const inviteLinks = { findByTelegramUrl: vi.fn().mockResolvedValue({ id: 'invite_1' }) };
    const logger = { warn: vi.fn(), error: vi.fn(), log: vi.fn() };
    const service = new TelegramService(
      prisma as never, logger as never, { get: vi.fn() } as never, {} as never, {} as never,
      {} as never, {} as never, inviteLinks as never, {} as never,
    );
    (service as unknown as { bot: unknown }).bot = { api: { approveChatJoinRequest: approve } };
    return { service, prisma, approve, logger };
  }

  it('зберігає заявку з посиланням, але не схвалює, якщо автосхвалення вимкнено', async () => {
    const { service, prisma, approve } = buildJoinService({
      id: 'ch_1', workspaceId: 'ws_1', title: 'Closed', autoApproveJoinRequests: false,
    });

    await service.handleJoinRequest(request, 500);

    expect(prisma.webhookEventRaw.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'join_request',
        payload: expect.objectContaining({ chatId: '-1001', userId: '42', inviteLink: 'https://t.me/+click' }),
      }),
    });
    expect(approve).not.toHaveBeenCalled();
    expect(prisma.membershipEvent.create).not.toHaveBeenCalled();
  });

  it('схвалює заявку і фіксує JOIN_REQUEST_APPROVED з точним посиланням', async () => {
    const { service, prisma, approve } = buildJoinService({
      id: 'ch_1', workspaceId: 'ws_1', title: 'Closed', autoApproveJoinRequests: true,
    });

    await service.handleJoinRequest(request, 501);

    expect(approve).toHaveBeenCalledWith(-1001, 42);
    expect(prisma.membershipEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'JOIN_REQUEST_APPROVED',
        inviteLinkId: 'invite_1',
        rawUpdateId: '501',
      }),
    });
  });

  it('не падає і не вигадує схвалення, якщо Telegram відмовив (нема прав)', async () => {
    const { service, prisma, logger } = buildJoinService(
      { id: 'ch_1', workspaceId: 'ws_1', title: 'Closed', autoApproveJoinRequests: true },
      vi.fn().mockRejectedValue(new Error('not enough rights')),
    );

    await service.handleJoinRequest(request, 502);

    expect(prisma.membershipEvent.create).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('ігнорує заявки в непідключені канали', async () => {
    const { service, prisma } = buildJoinService(null);
    await service.handleJoinRequest(request, 503);
    expect(prisma.webhookEventRaw.create).not.toHaveBeenCalled();
  });
});
