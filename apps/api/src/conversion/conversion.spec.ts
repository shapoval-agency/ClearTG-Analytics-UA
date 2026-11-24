import { describe, it, expect, vi } from 'vitest';
import { ConversionService } from './conversion.service';
import { ConversionDeliveryProcessor } from './conversion.processor';

const granted = {
  analytics_storage: 'granted', marketing_storage: 'granted', ad_user_data: 'granted',
  ad_personalization: 'granted', meta_allowed: true, google_allowed: true, tiktok_allowed: true, ga4_allowed: true,
};

function servicePrisma(opts: { meta?: number; googleAds?: number; ga4?: number; click?: Record<string, unknown> | null } = {}) {
  const click = opts.click === undefined
    ? { id: 'click_1', gclid: 'g1', fbclid: null, consentSnapshot: granted }
    : opts.click;
  return {
    metaIntegration: { count: vi.fn().mockResolvedValue(opts.meta ?? 0) },
    googleAdsIntegration: { count: vi.fn().mockResolvedValue(opts.googleAds ?? 0) },
    gA4Integration: { count: vi.fn().mockResolvedValue(opts.ga4 ?? 0) },
    tikTokIntegration: { count: vi.fn().mockResolvedValue(0) },
    membershipEvent: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'm1', workspaceId: 'ws', channelId: 'ch', occurredAt: new Date('2026-11-01T10:00:00Z'),
        attribution: click ? { id: 'a1', campaignId: 'k1', clickEvent: click, campaign: { conversionDelayMinutes: 0 } } : null,
        subscriberProfile: { id: 'p1' },
        workspace: { conversionDelayHours: 24 },
      }),
    },
    conversionEvent: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'conv_1', ...data })),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    clickEvent: { findUnique: vi.fn() },
  };
}

function build(prisma: ReturnType<typeof servicePrisma>) {
  const queue = { add: vi.fn().mockResolvedValue(undefined) };
  return { service: new ConversionService(prisma as never, queue as never), queue };
}

describe('ConversionService (stage 03)', () => {
  it('нічого не створює, якщо жодна рекламна система не підключена', async () => {
    const prisma = servicePrisma();
    const { service, queue } = build(prisma);
    expect(await service.createSubscribeEvent('m1')).toBeNull();
    expect(prisma.conversionEvent.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('S3-02 + S3-09: атрибутована підписка з gclid іде в Google Ads із затримкою кабінету', async () => {
    const prisma = servicePrisma({ googleAds: 1, meta: 1 });
    const { service, queue } = build(prisma);
    const event = await service.createSubscribeEvent('m1');
    expect(event?.status).toBe('PENDING');
    const flags = prisma.conversionEvent.create.mock.calls[0][0].data.eligibilityFlags;
    expect(flags.google_ads.eligible).toBe(true);
    expect(flags.meta.eligible).toBe(false); // Meta підключена, але fbclid немає
    expect(queue.add).toHaveBeenCalledWith('deliver', { conversionEventId: 'conv_1' }, { delay: 24 * 60 * 60 * 1000 });
  });

  it('S3-02: підписка без рекламного кліку не відправляється', async () => {
    const prisma = servicePrisma({ googleAds: 1, click: null });
    const { service, queue } = build(prisma);
    const event = await service.createSubscribeEvent('m1');
    expect(event?.status).toBe('SKIPPED_NO_IDENTIFIER');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('S3-12: «дійшов до Telegram» — лише для виміряного кліку, увімкненої цілі й один раз', async () => {
    const prisma = servicePrisma({ meta: 1 });
    const click = {
      id: 'click_1', workspaceId: 'ws', channelId: 'ch', campaignId: null, fbclid: 'f1',
      consentSnapshot: granted, reachTracked: true, telegramOpenedAt: new Date(),
      workspace: { sendReachEvent: true },
    };
    prisma.clickEvent.findUnique.mockResolvedValue(click);
    const { service, queue } = build(prisma);

    expect((await service.createReachEvent('click_1'))?.eventName).toBe('TG_Reached_Telegram');
    expect(queue.add).toHaveBeenCalledTimes(1);

    prisma.conversionEvent.findFirst.mockResolvedValue({ id: 'existing' });
    expect(await service.createReachEvent('click_1')).toBeNull();

    prisma.conversionEvent.findFirst.mockResolvedValue(null);
    prisma.clickEvent.findUnique.mockResolvedValue({ ...click, reachTracked: false });
    expect(await service.createReachEvent('click_1')).toBeNull();

    prisma.clickEvent.findUnique.mockResolvedValue({ ...click, workspace: { sendReachEvent: false } });
    expect(await service.createReachEvent('click_1')).toBeNull();
  });
});

function processorSetup(event: Record<string, unknown>, results: Record<string, unknown> = {}) {
  const prisma = {
    conversionEvent: {
      findUnique: vi.fn().mockResolvedValue(event),
      update: vi.fn().mockResolvedValue({}),
    },
    clickEvent: { findUnique: vi.fn().mockResolvedValue(null) },
    conversionDeliveryLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const sender = (key: string) => ({ sendEvent: vi.fn().mockResolvedValue(results[key] ?? { success: true }) });
  const meta = sender('meta'); const ga4 = sender('ga4'); const ads = sender('google_ads'); const tiktok = sender('tiktok');
  const processor = new ConversionDeliveryProcessor(prisma as never, meta as never, ga4 as never, ads as never, tiktok as never);
  return { processor, prisma, meta, ads };
}

const baseEvent = {
  id: 'conv_1', workspaceId: 'ws', status: 'PENDING', eventName: 'TG_Subscribe', eventTime: new Date(),
  eventId: 'e1', consentSnapshot: granted, clickEventId: null,
  workspace: { skipQuickUnsubscribes: true },
  subscriberProfile: { externalIdHash: 'h', _count: { unsubscribeEvents: 0 } },
  eligibilityFlags: { meta: { eligible: true }, google_ads: { eligible: true }, ga4: { eligible: false }, tiktok: { eligible: false } },
};

describe('ConversionDeliveryProcessor (stage 03)', () => {
  it('S3-10: відсіює підписку, якщо людина вже відписалась', async () => {
    const { processor, prisma, meta } = processorSetup({
      ...baseEvent,
      subscriberProfile: { externalIdHash: 'h', _count: { unsubscribeEvents: 1 } },
    });
    await processor.process({ data: { conversionEventId: 'conv_1' } } as never);
    expect(prisma.conversionEvent.update).toHaveBeenCalledWith({ where: { id: 'conv_1' }, data: { status: 'SKIPPED_UNSUBSCRIBED' } });
    expect(meta.sendEvent).not.toHaveBeenCalled();
  });

  it('S3-10 вимкнено — відписка не заважає відправці', async () => {
    const { processor, meta } = processorSetup({
      ...baseEvent,
      workspace: { skipQuickUnsubscribes: false },
      subscriberProfile: { externalIdHash: 'h', _count: { unsubscribeEvents: 1 } },
    });
    await processor.process({ data: { conversionEventId: 'conv_1' } } as never);
    expect(meta.sendEvent).toHaveBeenCalled();
  });

  it('«пропущено» не вважається помилкою: успіх в одній системі = SENT', async () => {
    const { processor, prisma } = processorSetup(baseEvent, {
      meta: { success: true },
      google_ads: { success: false, skipped: true, error: 'No action' },
    });
    await processor.process({ data: { conversionEventId: 'conv_1' } } as never);
    expect(prisma.conversionEvent.update).toHaveBeenCalledWith({ where: { id: 'conv_1' }, data: { status: 'SENT' } });
  });

  it('усі системи пропустили — це не FAILED', async () => {
    const { processor, prisma } = processorSetup(baseEvent, {
      meta: { success: false, skipped: true },
      google_ads: { success: false, skipped: true },
    });
    await processor.process({ data: { conversionEventId: 'conv_1' } } as never);
    expect(prisma.conversionEvent.update).toHaveBeenCalledWith({ where: { id: 'conv_1' }, data: { status: 'SKIPPED_NO_IDENTIFIER' } });
  });

  it('реальна помилка доставки = FAILED', async () => {
    const { processor, prisma } = processorSetup(baseEvent, {
      meta: { success: false, error: 'bad token' },
      google_ads: { success: false, error: 'denied' },
    });
    await processor.process({ data: { conversionEventId: 'conv_1' } } as never);
    expect(prisma.conversionEvent.update).toHaveBeenCalledWith({ where: { id: 'conv_1' }, data: { status: 'FAILED' } });
  });

  it('не відправляє подію повторно, якщо вона вже не PENDING', async () => {
    const { processor, meta } = processorSetup({ ...baseEvent, status: 'SENT' });
    await processor.process({ data: { conversionEventId: 'conv_1' } } as never);
    expect(meta.sendEvent).not.toHaveBeenCalled();
  });
});
