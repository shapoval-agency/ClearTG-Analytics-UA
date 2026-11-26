import { describe, expect, it } from 'vitest';
import { DEFAULT_GIFT_BUTTON, DEFAULT_GIFT_CONSENT, defaultPostText, formatRate, validateGiftForm, type GiftFormValues } from './gift-form';

const base: GiftFormValues = {
  channelId: 'ch1',
  name: 'Чекліст',
  description: '',
  contentUrl: 'https://example.com/file.pdf',
  contentText: '',
  buttonText: DEFAULT_GIFT_BUTTON,
  consentText: DEFAULT_GIFT_CONSENT,
};

describe('validateGiftForm', () => {
  it('accepts link-only and text-only materials', () => {
    expect(validateGiftForm(base)).toBeNull();
    expect(validateGiftForm({ ...base, contentUrl: '', contentText: 'Промокод TG10' })).toBeNull();
  });

  it('requires some material', () => {
    expect(validateGiftForm({ ...base, contentUrl: '', contentText: '  ' })).toMatch(/посилання або текст/);
  });

  it('rejects a link without protocol', () => {
    expect(validateGiftForm({ ...base, contentUrl: 'example.com/file' })).toMatch(/https/);
  });

  it('requires name, channel and consent', () => {
    expect(validateGiftForm({ ...base, name: ' ' })).toMatch(/назву/);
    expect(validateGiftForm({ ...base, channelId: '' })).toMatch(/канал/);
    expect(validateGiftForm({ ...base, consentText: 'коротко' })).toMatch(/10 символів/);
  });
});

describe('helpers', () => {
  it('formats rates', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(0.333)).toBe('33%');
  });

  it('builds the default post text', () => {
    expect(defaultPostText({ name: 'Чекліст', description: 'Для старту' })).toBe('🎁 Чекліст\n\nДля старту');
    expect(defaultPostText({ name: 'Чекліст', description: null })).toBe('🎁 Чекліст');
  });
});
