import { describe, expect, it } from 'vitest';
import { resolveGeoNodeKind, resolveGeoNodeTypeLabel } from '../orgGeoNodeKind';

describe('orgGeoNodeKind', () => {
  it('reads kind from short_name prefix', () => {
    expect(resolveGeoNodeKind({ short_name: 'hwy-maktab-12', metadata: null })).toBe('maktab');
    expect(resolveGeoNodeTypeLabel({ short_name: 'hwy-region-9', metadata: null })).toBe('Region');
  });

  it('prefers metadata hwyGeoKind', () => {
    expect(resolveGeoNodeKind({
      short_name: 'custom',
      metadata: JSON.stringify({ hwyGeoKind: 'ghavateh' }),
    })).toBe('ghavateh');
  });
});
