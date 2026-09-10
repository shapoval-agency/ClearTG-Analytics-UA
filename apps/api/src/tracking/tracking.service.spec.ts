import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackingService } from './tracking.service';

/**
 * Юніт-тести на TrackingService.recordClick — без бази, без Telegram, без
 * браузера. Мета: закрити руками саме той клас багів, який ми нещодавно
 * ловили руками через QA-гайд (напр. telegramOpenedAt ніколи не
 * проставлявся для дефолтних посилань). Prisma/Crypto/InviteLinks тут
 * повністю замінені на фейки — тестуємо тільки бізнес-логіку сервісу.
 */

function buildFakeLink(overrides: Record<string, unknown> = {}) {
  return {
    id: 'link_1',
    workspaceId: 'ws_1',
    channelId: 'channel_1',
    campaignId: null,
    slug: 'test-slug',
    isActive: true,
    linkMode: 'SHORTLINK',
    landingTitle: null,
    landingDescription: null,
    destinationMode: 'INVITE_LINK',
    landingPostUrl: null,
    destinationUrl: null,
    postNumber: null,
    usePerClickInvite: false,
    autoRedirect: true,
    redirectDelayMs: 0,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    channel: {
      title: 'Test Channel',
      username: 'testchannel',
      telegramChatId: '-1000000000001',
      botIsAdmin: false,
    },
    campaign: null,
    botConnection: null,
    workspace: { privacyPolicyUrl: null },
    ...overrides,
  };
}

function buildService(link: ReturnType<typeof buildFakeLink>) {
  const clickEventUpdate = vi.fn().mockResolvedValue(undefined);
  const prisma = {
    trackingLink: {
      findUnique: vi.fn().mockResolvedValue(link),
    },
    clickEvent: {
      create: vi.fn().mockResolvedValue({ id: 'click_1' }),
      update: clickEventUpdate,
    },
    consentEvent: {
      create: vi.fn().mockResolvedValue({ id: 'consent_1' }),
    },
  };
  const crypto = { getHashSalt: vi.fn().mockReturnValue('test-salt') };
  const inviteLinks = { createForClick: vi.fn() };

  const service = new TrackingService(prisma as never, crypto as never, inviteLinks as never);
  return { service, prisma, crypto, inviteLinks, clickEventUpdate };
}

describe('TrackingService.recordClick', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
  });

  it('проставляє telegramOpenedAt одразу, коли редирект миттєвий (дефолт: autoRedirect=true, delay=0)', async () => {
    const link = buildFakeLink();
    const { service, clickEventUpdate } = buildService(link);

    const result = await service.recordClick('test-slug', {}, {}, 'shortlink_page', 'SHORTLINK');

    expect(result.channelUnavailable).toBe(false);
    expect(clickEventUpdate).toHaveBeenCalledWith({
      where: { id: 'click_1' },
      data: { telegramOpenedAt: expect.any(Date) },
    });
  });

  it('НЕ проставляє telegramOpenedAt, коли є затримка редиректу (сторінка реально показується, чекаємо маячок)', async () => {
    const link = buildFakeLink({ redirectDelayMs: 3000 });
    const { service, clickEventUpdate } = buildService(link);

    await service.recordClick('test-slug', {}, {}, 'shortlink_page', 'SHORTLINK');

    expect(clickEventUpdate).not.toHaveBeenCalled();
  });

  it('НЕ проставляє telegramOpenedAt, коли autoRedirect вимкнено (ручний CTA)', async () => {
    const link = buildFakeLink({ autoRedirect: false });
    const { service, clickEventUpdate } = buildService(link);

    await service.recordClick('test-slug', {}, {}, 'shortlink_page', 'SHORTLINK');

    expect(clickEventUpdate).not.toHaveBeenCalled();
  });

  it('НЕ проставляє telegramOpenedAt, коли канал недоступний (нема куди редиректити)', async () => {
    const link = buildFakeLink({
      destinationMode: 'INVITE_LINK',
      destinationUrl: null,
      channel: {
        title: 'Private Channel',
        username: null,
        telegramChatId: '-1000000000002',
        botIsAdmin: false,
      },
    });
    const { service, clickEventUpdate } = buildService(link);

    const result = await service.recordClick('test-slug', {}, {}, 'shortlink_page', 'SHORTLINK');

    expect(result.channelUnavailable).toBe(true);
    expect(clickEventUpdate).not.toHaveBeenCalled();
  });
});
