// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TOOLBOX_DEFAULT_EXPANDED_SECTIONS,
  TOOLBOX_RECENTLY_USED_ID,
  TOOLBOX_RECENTLY_USED_MAX,
  getDesignerToolboxPrefsStorageKey,
  normalizeDesignerToolboxPrefs,
  pushRecentlyUsedItemId,
  readDesignerToolboxPrefs,
  resolveDesignerToolboxPrefs,
  resolveRecentlyUsedPaletteItems,
  writeDesignerToolboxPrefs,
} from '../designerToolboxPrefs';

describe('designerToolboxPrefs', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('writes and reads prefs per user key', () => {
    writeDesignerToolboxPrefs('u1', {
      expandedSections: [TOOLBOX_RECENTLY_USED_ID, 'layout'],
      recentlyUsedItemIds: ['a', 'b'],
    });
    expect(window.localStorage.getItem(getDesignerToolboxPrefsStorageKey('u1'))).toBeTruthy();
    expect(readDesignerToolboxPrefs('u1')).toEqual({
      expandedSections: [TOOLBOX_RECENTLY_USED_ID, 'layout'],
      recentlyUsedItemIds: ['a', 'b'],
    });
    expect(readDesignerToolboxPrefs('u2')).toBeNull();
  });

  it('falls back to Phase 10 defaults when missing', () => {
    expect(resolveDesignerToolboxPrefs('missing')).toEqual({
      expandedSections: [...TOOLBOX_DEFAULT_EXPANDED_SECTIONS],
      recentlyUsedItemIds: [],
    });
  });

  it('normalizes unknown expand ids and caps recent list', () => {
    const normalized = normalizeDesignerToolboxPrefs({
      expandedSections: ['layout', 'not-a-group', TOOLBOX_RECENTLY_USED_ID, 'layout'],
      recentlyUsedItemIds: Array.from({ length: TOOLBOX_RECENTLY_USED_MAX + 3 }, (_, i) => `id-${i}`),
    });
    expect(normalized?.expandedSections).toEqual(['layout', TOOLBOX_RECENTLY_USED_ID]);
    expect(normalized?.recentlyUsedItemIds).toHaveLength(TOOLBOX_RECENTLY_USED_MAX);
  });

  it('pushRecentlyUsedItemId moves existing id to front', () => {
    expect(pushRecentlyUsedItemId(['x', 'y'], 'y')).toEqual(['y', 'x']);
  });

  it('resolveRecentlyUsedPaletteItems skips missing catalog entries', () => {
    const map = new Map([['keep', { id: 'keep', label: 'Keep' }]]);
    expect(resolveRecentlyUsedPaletteItems(['gone', 'keep', 'also-gone'], map)).toEqual([
      { id: 'keep', label: 'Keep' },
    ]);
  });
});
