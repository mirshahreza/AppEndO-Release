import { describe, expect, it } from 'vitest';
import { resolveGeoNodeKind, resolveGeoNodeTypeLabel } from '../orgGeoNodeKind';

describe('orgGeoNodeKind', () => {
  it('reads kind from short_name prefix', () => {
    expect(resolveGeoNodeKind({ short_name: 'vx-maktab-12', metadata: null })).toBe('maktab');
    expect(resolveGeoNodeTypeLabel({ short_name: 'vx-region-9', metadata: null })).toBe('Region');
  });

  it('prefers metadata vxGeoKind', () => {
    expect(resolveGeoNodeKind({
      short_name: 'custom',
      metadata: JSON.stringify({ vxGeoKind: 'ghavateh' }),
    })).toBe('ghavateh');
  });
});
