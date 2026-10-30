import { describe, expect, it, vi } from 'vitest';
import { ChannelService } from './channel.service';

describe('ChannelService.getBotStatus', () => {
  it('зберігає обов’язкове право invite і час живої перевірки', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      channel: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ch_1',
          title: 'Channel',
          telegramChatId: '-1001',
          botIsAdmin: true,
          botCanInviteUsers: false,
        }),
        update,
      },
    };
    const telegram = {
      getBotPermissions: vi.fn().mockResolvedValue({
        isAdmin: true,
        canInviteUsers: true,
        canManageChat: false,
        issues: [],
        ready: true,
      }),
    };
    const service = new ChannelService(prisma as never, telegram as never);

    await service.getBotStatus('ch_1', 'ws_1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'ch_1' },
      data: {
        botIsAdmin: true,
        botCanInviteUsers: true,
        botStatusCheckedAt: expect.any(Date),
      },
    });
  });
});
