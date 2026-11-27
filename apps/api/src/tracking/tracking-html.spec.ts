import { describe, expect, it } from 'vitest';
import { renderRedirectPage, telegramAppUrl, type LandingPageContext } from './tracking-html';

describe('telegramAppUrl', () => {
  it('maps invite links to tg://join', () => {
    expect(telegramAppUrl('https://t.me/+AbC_123-x')).toBe('tg://join?invite=AbC_123-x');
    expect(telegramAppUrl('https://t.me/joinchat/AbC123')).toBe('tg://join?invite=AbC123');
  });

  it('maps public channels, posts and bot starts to tg://resolve', () => {
    expect(telegramAppUrl('https://t.me/shapoval_one')).toBe('tg://resolve?domain=shapoval_one');
    expect(telegramAppUrl('https://t.me/shapoval_one/20')).toBe('tg://resolve?domain=shapoval_one&post=20');
    expect(telegramAppUrl('https://t.me/cleartg_bot?start=lm_abc')).toBe('tg://resolve?domain=cleartg_bot&start=lm_abc');
  });

  it('returns null for anything it does not recognise', () => {
    expect(telegramAppUrl('https://example.com/x')).toBeNull();
    expect(telegramAppUrl('http://t.me/channel')).toBeNull();
    expect(telegramAppUrl('https://t.me/')).toBeNull();
    expect(telegramAppUrl('not a url')).toBeNull();
    expect(telegramAppUrl('https://t.me/a"b')).toBeNull();
  });
});

describe('renderRedirectPage', () => {
  const ctx: LandingPageContext = {
    channelTitle: 'Канал <script>',
    channelUsername: 'shapoval_one',
    landingTitle: '',
    landingDescription: '',
    telegramUrl: 'https://t.me/+invite123',
    privacyPolicyUrl: 'https://example.com/privacy',
    linkMode: 'SHORTLINK',
    clickId: 'click1',
    apiOrigin: 'https://api.example.com',
  };
  const html = renderRedirectPage(ctx, 1);

  it('hides the fallback until the transition should have happened', () => {
    expect(html).toContain('visibility: hidden');
    expect(html).toContain('animation: reveal 0.2s ease 4s forwards');
    expect(html).not.toContain('Відкриваємо Telegram');
  });

  it('tries the app first on phones and falls back to t.me', () => {
    expect(html).toContain('"tg://join?invite=invite123"');
    expect(html).toContain('location.replace(web)');
  });

  it('keeps a no-JS fallback inside noscript only', () => {
    const noscript = html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'));
    expect(noscript).toContain('http-equiv="refresh"');
    expect(html.replace(noscript, '')).not.toContain('http-equiv="refresh"');
  });

  it('escapes the channel title', () => {
    expect(html).not.toContain('Канал <script>');
    expect(html).toContain('Канал &lt;script&gt;');
  });
});
