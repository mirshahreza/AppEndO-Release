import { describe, expect, it } from 'vitest';
import { isComponentVisibleAtTier } from '../viewportVisibility';

describe('isComponentVisibleAtTier', () => {
  it('hide-phone hides only phone tier', () => {
    expect(isComponentVisibleAtTier('hide-phone', 'phone')).toBe(false);
    expect(isComponentVisibleAtTier('hide-phone', 'tablet')).toBe(true);
    expect(isComponentVisibleAtTier('hide-phone', 'desktop')).toBe(true);
  });

  it('hide-compact hides phone and tablet', () => {
    expect(isComponentVisibleAtTier('hide-compact', 'phone')).toBe(false);
    expect(isComponentVisibleAtTier('hide-compact', 'tablet')).toBe(false);
    expect(isComponentVisibleAtTier('hide-compact', 'desktop')).toBe(true);
  });

  it('wide-only is wide tier only', () => {
    expect(isComponentVisibleAtTier('wide-only', 'desktop')).toBe(false);
    expect(isComponentVisibleAtTier('wide-only', 'wide')).toBe(true);
  });
});
