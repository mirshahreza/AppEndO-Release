import { describe, expect, it } from 'vitest';
import {
  buildPinnedDesignerLoaderRef,
  parsePinnedDesignerLoaderRef,
  stripPinnedDesignerLoaderRef,
} from '../publishLoaderRef';

describe('publishLoaderRef', () => {
  it('round-trips pinned loader refs', () => {
    expect(buildPinnedDesignerLoaderRef('general/my-widget', 3)).toBe('general/my-widget@v3');
    expect(parsePinnedDesignerLoaderRef('general/my-widget@v3')).toEqual({
      componentPath: 'general/my-widget',
      publishedVersion: 3,
    });
    expect(stripPinnedDesignerLoaderRef('general/my-widget@v3')).toBe('general/my-widget');
  });

  it('leaves unpinned paths unchanged', () => {
    expect(parsePinnedDesignerLoaderRef('general/my-widget')).toEqual({
      componentPath: 'general/my-widget',
    });
  });
});
