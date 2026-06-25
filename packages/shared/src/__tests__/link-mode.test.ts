import { describe, it, expect } from 'vitest';
import {
  validateLinkModeForPlatform,
  resolveDefaultLinkMode,
  getPublicLinkPath,
  isPaidAdPlatform,
} from '../link-mode';

describe('Link mode rules', () => {
  it('detects paid platforms', () => {
    expect(isPaidAdPlatform('META')).toBe(true);
    expect(isPaidAdPlatform('ORGANIC')).toBe(false);
  });

  it('defaults paid to landing page', () => {
    expect(resolveDefaultLinkMode('GOOGLE')).toBe('LANDING_PAGE');
    expect(resolveDefaultLinkMode('INFLUENCER')).toBe('SHORTLINK');
  });

  it('rejects shortlink for Meta', () => {
    const result = validateLinkModeForPlatform('SHORTLINK', 'META');
    expect(result.valid).toBe(false);
  });

  it('allows shortlink for organic', () => {
    expect(validateLinkModeForPlatform('SHORTLINK', 'ORGANIC').valid).toBe(true);
  });

  it('builds correct public paths', () => {
    expect(getPublicLinkPath('LANDING_PAGE', 'abc')).toBe('/l/abc');
    expect(getPublicLinkPath('SHORTLINK', 'xyz')).toBe('/r/xyz');
  });
});
