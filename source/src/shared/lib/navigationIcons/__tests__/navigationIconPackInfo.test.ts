import { describe, expect, it } from 'vitest';
import { NAVIGATION_ICON_PACK_IDS } from '../navigationIconRef';
import { NAVIGATION_ICON_PACK_INFO } from '../navigationIconPackInfo';

describe('navigationIconPackInfo', () => {
  it('defines info for every navigation icon pack', () => {
    for (const packId of NAVIGATION_ICON_PACK_IDS) {
      expect(NAVIGATION_ICON_PACK_INFO[packId]).toBeDefined();
      expect(NAVIGATION_ICON_PACK_INFO[packId].summary.length).toBeGreaterThan(0);
      expect(NAVIGATION_ICON_PACK_INFO[packId].license.length).toBeGreaterThan(0);
    }
  });
});
