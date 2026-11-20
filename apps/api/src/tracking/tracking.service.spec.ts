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
      joinRequestsEnabled: false,
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

function linkPrisma(overrides: Record<string, unknown> = {}) {
  return {
    channel: { findFirst: vi.fn().mockResolvedValue({ id: 'channel_1' }) },
    campaign: {
      findFirst: vi.fn().mockResolvedValue({ adPlatform: 'META', channelId: 'channel_1' }),
    },
    telegramBotConnection: { findFirst: vi.fn().mockResolvedValue({ isActive: true }) },
    trackingLink: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
        ...data,
        id: `tracking_${data.name ?? '1'}`,
      })),
      findFirst: vi.fn(),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({
        ...data,
        id: 'tracking_1',
        linkMode: 'SHORTLINK',
        slug: 'existing',
      })),
    },
    $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    ...overrides,
  };
}

function linkService(prisma: ReturnType<typeof linkPrisma>) {
  return new TrackingService(prisma as never, { getHashSalt: vi.fn() } as never, {} as never);
}

describe('TrackingService.createLink', () => {
  it('зберігає повний набір UTM і маршрут на конкретний допис', async () => {
    const prisma = linkPrisma();
    const result = await linkService(prisma).createLink('ws_1', {
      channelId: 'channel_1',
      campaignId: 'campaign_1',
      destinationMode: 'PUBLIC_POST',
      landingPostUrl: 'https://t.me/example/123',
      utmSource: 'meta',
      utmMedium: 'cpc',
      utmCampaign: 'launch',
      utmContent: 'video-1',
      utmTerm: 'analytics',
      creativeTag: 'blue',
    });

    expect(prisma.trackingLink.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        destinationMode: 'PUBLIC_POST',
        landingPostUrl: 'https://t.me/example/123',
        utmSource: 'meta',
        utmMedium: 'cpc',
        utmCampaign: 'launch',
        utmContent: 'video-1',
        utmTerm: 'analytics',
        creativeTag: 'blue',
      }),
    }));
    expect(result.publicPath).toMatch(/^\/l\//);
  });

  it('не дозволяє підмінити Telegram-допис зовнішнім редиректом', async () => {
    const prisma = linkPrisma();
    await expect(linkService(prisma).createLink('ws_1', {
      channelId: 'channel_1',
      destinationMode: 'PUBLIC_POST',
      landingPostUrl: 'https://example.com/not-telegram',
    })).rejects.toThrow('https://t.me/');
    expect(prisma.trackingLink.create).not.toHaveBeenCalled();
  });

  it('не дає прив’язати посилання до каналу з чужого кабінету', async () => {
    const prisma = linkPrisma({ channel: { findFirst: vi.fn().mockResolvedValue(null) } });
    await expect(linkService(prisma).createLink('ws_1', { channelId: 'foreign_channel' }))
      .rejects.toThrow('Канал не знайдено');
    expect(prisma.channel.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'foreign_channel', workspaceId: 'ws_1' },
    }));
    expect(prisma.trackingLink.create).not.toHaveBeenCalled();
  });

  it('не приймає кампанію іншого каналу', async () => {
    const prisma = linkPrisma({
      campaign: {
        findFirst: vi.fn().mockResolvedValue({ adPlatform: 'META', channelId: 'channel_2' }),
      },
    });
    await expect(linkService(prisma).createLink('ws_1', {
      channelId: 'channel_1',
      campaignId: 'campaign_2',
    })).rejects.toThrow('іншому каналу');
  });

  it('S2-05: перехід в особистий акаунт вимагає адресу https://t.me/username', async () => {
    const prisma = linkPrisma();
    await expect(linkService(prisma).createLink('ws_1', {
      channelId: 'channel_1',
      destinationMode: 'PERSONAL_CHAT',
      destinationUrl: 'https://example.com/me',
    })).rejects.toThrow('t.me/username');

    await linkService(prisma).createLink('ws_1', {
      channelId: 'channel_1',
      destinationMode: 'PERSONAL_CHAT',
      destinationUrl: 'https://t.me/manager_anna',
    });
    expect(prisma.trackingLink.create).toHaveBeenCalledTimes(1);
  });

  it('S2-03: посилання на бота вимагає підключеного активного бота', async () => {
    const prisma = linkPrisma();
    await expect(linkService(prisma).createLink('ws_1', {
      channelId: 'channel_1',
      destinationMode: 'CLIENT_BOT_START',
    })).rejects.toThrow('Оберіть підключеного бота');

    const disabled = linkPrisma({
      telegramBotConnection: { findFirst: vi.fn().mockResolvedValue({ isActive: false }) },
    });
    await expect(linkService(disabled).createLink('ws_1', {
      channelId: 'channel_1',
      destinationMode: 'CLIENT_BOT_START',
      botConnectionId: 'bot_1',
    })).rejects.toThrow('відключений');
  });
});

describe('TrackingService.createLinksBulk (S2-09)', () => {
  it('створює всі посилання однією транзакцією зі спільними налаштуваннями', async () => {
    const prisma = linkPrisma();
    const result = await linkService(prisma).createLinksBulk('ws_1', {
      base: { channelId: 'channel_1', campaignId: 'campaign_1', utmSource: 'meta' },
      items: [
        { name: 'Відео 1', creativeTag: 'video_1' },
        { name: 'Відео 2', creativeTag: 'video_2' },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.trackingLink.create).toHaveBeenCalledTimes(2);
    expect(prisma.trackingLink.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ name: 'Відео 2', creativeTag: 'video_2', utmSource: 'meta' }),
    }));
    expect(result).toHaveLength(2);
    expect(new Set(result.map((l) => l.slug)).size).toBe(2);
  });

  it('відмовляє, якщо назви в пачці повторюються', async () => {
    const prisma = linkPrisma();
    await expect(linkService(prisma).createLinksBulk('ws_1', {
      base: { channelId: 'channel_1' },
      items: [{ name: 'Відео' }, { name: 'відео ' }],
    })).rejects.toThrow('повторюються');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('TrackingService.updateLink (S2-07 / S2-18)', () => {
  const existing = {
    id: 'tracking_1',
    workspaceId: 'ws_1',
    channelId: 'channel_1',
    campaignId: null,
    botConnectionId: null,
    linkMode: 'SHORTLINK',
    destinationMode: 'INVITE_LINK',
    landingPostUrl: null,
    destinationUrl: null,
    postNumber: null,
  };

  it('змінює назву й мітки, очищає порожні значення і не чіпає адресу та канал', async () => {
    const prisma = linkPrisma();
    prisma.trackingLink.findFirst.mockResolvedValue(existing);

    await linkService(prisma).updateLink('ws_1', 'tracking_1', {
      name: '  Нова назва ',
      utmContent: '',
      autoRedirect: false,
    });

    const { data } = prisma.trackingLink.update.mock.calls[0][0];
    expect(data).toEqual({ name: 'Нова назва', utmContent: null, autoRedirect: false });
    expect(data).not.toHaveProperty('channelId');
    expect(data).not.toHaveProperty('slug');
    expect(data).not.toHaveProperty('linkMode');
  });

  it('не дозволяє кампанію, несумісну з уже виданою адресою', async () => {
    const prisma = linkPrisma({
      campaign: {
        // Коротке посилання (/r/) не можна віддати під платну кампанію.
        findFirst: vi.fn().mockResolvedValue({ adPlatform: 'META', channelId: 'channel_1' }),
      },
    });
    prisma.trackingLink.findFirst.mockResolvedValue({ ...existing, linkMode: 'SHORTLINK' });

    await expect(linkService(prisma).updateLink('ws_1', 'tracking_1', { campaignId: 'campaign_meta' }))
      .rejects.toThrow('Створіть нове посилання');
    expect(prisma.trackingLink.update).not.toHaveBeenCalled();
  });

  it('повертає 404 для посилання з чужого кабінету', async () => {
    const prisma = linkPrisma();
    prisma.trackingLink.findFirst.mockResolvedValue(null);
    await expect(linkService(prisma).updateLink('ws_1', 'foreign', { name: 'x' }))
      .rejects.toThrow('не знайдено');
  });
});

describe('TrackingService.recordClick', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
  });

  it('S2-10: миттєвий редирект не вимірює перехід і не ставить фіктивне «дійшов»', async () => {
    const link = buildFakeLink();
    const { service, prisma, clickEventUpdate } = buildService(link);

    const result = await service.recordClick('test-slug', {}, {}, 'shortlink_page', 'SHORTLINK');

    expect(result.channelUnavailable).toBe(false);
    expect(prisma.clickEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reachTracked: false }),
    }));
    expect(clickEventUpdate).not.toHaveBeenCalled();
  });

  it('редирект із затримкою теж не вимірюється (маячок спрацьовує лише на кнопці)', async () => {
    const link = buildFakeLink({ redirectDelayMs: 3000 });
    const { service, prisma, clickEventUpdate } = buildService(link);

    await service.recordClick('test-slug', {}, {}, 'shortlink_page', 'SHORTLINK');

    expect(prisma.clickEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reachTracked: false }),
    }));
    expect(clickEventUpdate).not.toHaveBeenCalled();
  });

  it('S2-11: сторінка з кнопкою (autoRedirect=false) вимірює перехід', async () => {
    const link = buildFakeLink({ autoRedirect: false });
    const { service, prisma, clickEventUpdate } = buildService(link);

    await service.recordClick('test-slug', {}, {}, 'shortlink_page', 'SHORTLINK');

    expect(prisma.clickEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reachTracked: true }),
    }));
    expect(clickEventUpdate).not.toHaveBeenCalled();
  });

  it('канал недоступний — клік рахується як точно «не дійшов»', async () => {
    const link = buildFakeLink({
      destinationMode: 'INVITE_LINK',
      destinationUrl: null,
      channel: {
        title: 'Private Channel',
        username: null,
        telegramChatId: '-1000000000002',
        botIsAdmin: false,
        joinRequestsEnabled: false,
      },
    });
    const { service, clickEventUpdate } = buildService(link);

    const result = await service.recordClick('test-slug', {}, {}, 'shortlink_page', 'SHORTLINK');

    expect(result.channelUnavailable).toBe(true);
    expect(clickEventUpdate).toHaveBeenCalledWith({
      where: { id: 'click_1' },
      data: { reachTracked: true },
    });
  });

  it('S2-15: у каналі з заявками per-click invite створюється із заявкою', async () => {
    const link = buildFakeLink({
      usePerClickInvite: true,
      channel: {
        title: 'Closed',
        username: null,
        telegramChatId: '-1000000000003',
        botIsAdmin: true,
        joinRequestsEnabled: true,
      },
    });
    const { service, inviteLinks } = buildService(link);
    inviteLinks.createForClick.mockResolvedValue({ telegramInviteLink: 'https://t.me/+abc' });

    await service.recordClick('test-slug', {}, {}, 'shortlink_page', 'SHORTLINK');

    expect(inviteLinks.createForClick).toHaveBeenCalledWith(
      expect.objectContaining({ createsJoinRequest: true }),
    );
  });
});

describe('TrackingService embed script', () => {
  it('передає початкову t.me-адресу як fallback і відстежує динамічні посилання', () => {
    const { service } = buildService(buildFakeLink());
    const script = service.getEmbedScript();

    expect(script).toContain('ctg_fallback');
    expect(script).toContain('MutationObserver');
    expect(script).toContain('data-path');
  });

  it('використовує фактичний /r шлях для shortlink у snippet', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
    const prisma = {
      trackingLink: {
        findFirst: vi.fn().mockResolvedValue({
          slug: 'organic-link',
          linkMode: 'SHORTLINK',
          channel: { title: 'Channel' },
        }),
      },
    };
    const service = new TrackingService(
      prisma as never,
      { getHashSalt: vi.fn() } as never,
      {} as never,
    );

    const snippet = await service.getEmbedSnippet('ws_1', 'organic-link');

    expect(snippet.directLink).toBe('https://app.example.com/r/organic-link');
    expect(snippet.scriptTag).toContain('data-path="/r/organic-link"');
  });
});
