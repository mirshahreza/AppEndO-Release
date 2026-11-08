import { describe, expect, it, beforeEach } from 'vitest';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import { resolvePublishedDesignerNavigateTarget } from '../resolvePublishedDesignerNavigateTarget';

describe('resolvePublishedDesignerNavigateTarget', () => {
  beforeEach(() => {
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  it('prepends culture when navigating from a culture-prefixed URL', () => {
    expect(resolvePublishedDesignerNavigateTarget(
      '/studio/cms/contents',
      '/us/studio/cms/contents/edit/1',
      '/us',
    )).toBe('/us/studio/cms/contents');
  });

  it('keeps bare studio paths on the studio mount', () => {
    expect(resolvePublishedDesignerNavigateTarget(
      '/studio/cms/contents',
      '/studio/cms/contents/edit/1',
      '/studio',
    )).toBe('/studio/cms/contents');
  });

  it('does not double-prefix culture targets', () => {
    expect(resolvePublishedDesignerNavigateTarget(
      '/us/studio/cms/contents',
      '/us/studio/cms/contents/edit/1',
      '/us',
    )).toBe('/us/studio/cms/contents');
  });

  it('uses default culture when pathname has a mistyped culture prefix', () => {
    expect(resolvePublishedDesignerNavigateTarget(
      '/studio/cms/contents',
      '/ui/studio/cms/contents/edit/1',
      null,
    )).toBe('/us/studio/cms/contents');
  });
});
