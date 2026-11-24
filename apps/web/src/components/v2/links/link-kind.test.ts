import { describe, expect, it } from 'vitest';
import {
  filterLinkRows,
  isTelegramPersonalUrl,
  normalizePersonalUrl,
  normalizeTrackingLink,
  openModeOf,
  openModeSettings,
  parseBulkLines,
  type TrackingLinkApi,
} from './link-kind';

function api(overrides: Partial<TrackingLinkApi> = {}): TrackingLinkApi {
  return {
    id: 't1', slug: 'abc', name: 'Відео', publicPath: '/l/abc', isActive: true,
    createdAt: '2026-11-01T10:00:00Z', utmSource: 'meta', utmMedium: null, utmCampaign: null,
    utmContent: null, utmTerm: null, creativeTag: 'v1', postNumber: null, landingPostUrl: null,
    destinationMode: 'INVITE_LINK', destinationUrl: null, botConnectionId: null, autoRedirect: true,
    channel: { id: 'c1', title: 'Канал' }, campaign: { id: 'k1', name: 'Осінь', adPlatform: 'META' },
    _count: { clickEvents: 4 },
    ...overrides,
  };
}

describe('link-kind', () => {
  it('S2-07: готує дані для редагування й дублювання', () => {
    const row = normalizeTrackingLink(api({ autoRedirect: false }), 'https://app');
    expect(row.editable).toMatchObject({
      channelId: 'c1', campaignId: 'k1', source: 'META', destination: 'channel',
      openMode: 'button', creativeTag: 'v1',
    });
    expect(row.marks).toContain('перехід у Telegram вимірюється');
  });

  it('S3-13: розпізнає швидку сторінку й переводить режим у налаштування', () => {
    const row = normalizeTrackingLink(api({ autoRedirect: true, redirectDelayMs: 1000 }), 'x');
    expect(row.editable?.openMode).toBe('fast');
    expect(row.marks).toContain('швидка сторінка переходу');
    expect(openModeSettings('fast')).toEqual({ autoRedirect: true, redirectDelayMs: 1000 });
    expect(openModeSettings('button')).toEqual({ autoRedirect: false, redirectDelayMs: 0 });
    expect(openModeOf({ autoRedirect: true, redirectDelayMs: 0 })).toBe('instant');
  });

  it('S2-03/S2-05: розпізнає посилання в бота та в особистий акаунт', () => {
    expect(normalizeTrackingLink(api({ destinationMode: 'CLIENT_BOT_START', botConnectionId: 'b1' }), 'x').editable)
      .toMatchObject({ destination: 'bot', botConnectionId: 'b1' });
    const personal = normalizeTrackingLink(
      api({ destinationMode: 'PERSONAL_CHAT', destinationUrl: 'https://t.me/manager_anna' }), 'x');
    expect(personal.editable?.destination).toBe('personal');
    expect(personal.marks).toContain('особистий акаунт: @manager_anna');
  });

  it('S2-01: фільтрує за каналом і станом', () => {
    const rows = [
      normalizeTrackingLink(api({ id: 'a' }), 'x'),
      normalizeTrackingLink(api({ id: 'b', isActive: false }), 'x'),
      normalizeTrackingLink(api({ id: 'c', channel: { id: 'c2', title: 'Інший' } }), 'x'),
    ];
    expect(filterLinkRows(rows, { status: 'all' })).toHaveLength(3);
    expect(filterLinkRows(rows, { status: 'active' }).map((r) => r.id)).toEqual(['a', 'c']);
    expect(filterLinkRows(rows, { status: 'archived' }).map((r) => r.id)).toEqual(['b']);
    expect(filterLinkRows(rows, { status: 'all', channelId: 'c2' }).map((r) => r.id)).toEqual(['c']);
  });

  it('S2-09: розбирає «назва; креатив» по рядках', () => {
    expect(parseBulkLines('Відео 1; video_1\n\n  Банер  \n; без назви')).toEqual([
      { name: 'Відео 1', creativeTag: 'video_1' },
      { name: 'Банер' },
    ]);
  });

  it('S2-05: приймає @username або повну адресу', () => {
    expect(normalizePersonalUrl('@manager_anna')).toBe('https://t.me/manager_anna');
    expect(isTelegramPersonalUrl(normalizePersonalUrl('https://t.me/manager_anna'))).toBe(true);
    expect(isTelegramPersonalUrl('https://example.com/manager')).toBe(false);
    expect(isTelegramPersonalUrl('https://t.me/+invite')).toBe(false);
  });
});
