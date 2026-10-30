import { describe, expect, it, vi } from 'vitest';
import {
  isAutomatedPreviewRequest,
  safeTelegramFallback,
  ShortlinkController,
} from './tracking.controller';

describe('safeTelegramFallback', () => {
  it('дозволяє лише HTTPS-посилання на t.me', () => {
    expect(safeTelegramFallback('https://t.me/test_channel')).toBe('https://t.me/test_channel');
    expect(safeTelegramFallback('http://t.me/test_channel')).toBeNull();
    expect(safeTelegramFallback('https://evil.example/t.me/test_channel')).toBeNull();
    expect(safeTelegramFallback('not-a-url')).toBeNull();
  });
});

describe('isAutomatedPreviewRequest', () => {
  it.each([
    'TelegramBot (like TwitterBot)',
    'facebookexternalhit/1.1',
    'Slackbot-LinkExpanding 1.0',
    'WhatsApp/2.0',
  ])('не рахує link-preview user-agent як клік: %s', (userAgent) => {
    expect(isAutomatedPreviewRequest({ 'user-agent': userAgent })).toBe(true);
  });

  it('не рахує явний browser prefetch як клік', () => {
    expect(isAutomatedPreviewRequest({
      'user-agent': 'Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36',
      'sec-purpose': 'prefetch',
    })).toBe(true);
  });

  it('не рахує HEAD-перевірку посилання як клік', () => {
    expect(isAutomatedPreviewRequest({ 'user-agent': 'Mozilla/5.0 Chrome/149.0.0.0' }, 'HEAD')).toBe(true);
  });

  it('не відкидає звичайний браузер або Telegram Desktop як реальний перехід', () => {
    expect(isAutomatedPreviewRequest({ 'user-agent': 'Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36' })).toBe(false);
    expect(isAutomatedPreviewRequest({ 'user-agent': 'TelegramDesktop/6.1' })).toBe(false);
  });
});

describe('ShortlinkController preview', () => {
  it('повертає preview-картку й не створює ClickEvent', async () => {
    const tracking = {
      getLinkBySlug: vi.fn().mockResolvedValue({
        linkMode: 'SHORTLINK',
        slug: 'preview',
        landingTitle: null,
        landingDescription: null,
        channel: { title: 'Test Channel' },
      }),
      assertLinkModeForRoute: vi.fn(),
      recordClick: vi.fn(),
    };
    const headers = vi.fn();
    const reply = { header: headers, redirect: vi.fn() };
    headers.mockReturnValue(reply);
    const controller = new ShortlinkController(tracking as never);

    const html = await controller.shortlinkPage(
      'preview',
      { query: {}, headers: { 'user-agent': 'TelegramBot (like TwitterBot)' } },
      reply,
    );

    expect(html).toContain('Test Channel');
    expect(html).toContain('og:title');
    expect(tracking.recordClick).not.toHaveBeenCalled();
    expect(reply.redirect).not.toHaveBeenCalled();
  });
});
