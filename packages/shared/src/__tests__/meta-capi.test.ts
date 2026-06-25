import { describe, it, expect } from 'vitest';
import { buildFbcFromFbclid } from '../meta-capi';

describe('Meta CAPI helpers', () => {
  it('prefers existing fbc', () => {
    expect(buildFbcFromFbclid('abc', 'fb.1.1.xyz')).toBe('fb.1.1.xyz');
  });

  it('builds fbc from fbclid', () => {
    const fbc = buildFbcFromFbclid('IwAR123');
    expect(fbc).toMatch(/^fb\.1\.\d+\.IwAR123$/);
  });

  it('returns null without fbclid', () => {
    expect(buildFbcFromFbclid(null)).toBeNull();
  });
});
