import { describe, expect, it } from 'vitest';
import { safeTelegramFallback } from './tracking.controller';

describe('safeTelegramFallback', () => {
  it('дозволяє лише HTTPS-посилання на t.me', () => {
    expect(safeTelegramFallback('https://t.me/test_channel')).toBe('https://t.me/test_channel');
    expect(safeTelegramFallback('http://t.me/test_channel')).toBeNull();
    expect(safeTelegramFallback('https://evil.example/t.me/test_channel')).toBeNull();
    expect(safeTelegramFallback('not-a-url')).toBeNull();
  });
});
