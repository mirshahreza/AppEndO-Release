import { describe, expect, it } from 'vitest';
import { resolveGeoPlaceholderDisplayTitle } from '../baseInfoGeoPlaceholderTitle';

describe('resolveGeoPlaceholderDisplayTitle', () => {
  it('formats region placeholders for iq', () => {
    expect(resolveGeoPlaceholderDisplayTitle('iq', 'hwy-region-100650')).toBe('منطقة 100650');
  });

  it('returns null for normal titles', () => {
    expect(resolveGeoPlaceholderDisplayTitle('iq', 'Gender')).toBeNull();
  });
});
