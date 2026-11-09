import { describe, expect, it } from 'vitest';
import { classifyLoadingLogoShape } from '../appRouteLoadingLogoStage';

describe('classifyLoadingLogoShape', () => {
  it('treats Hawiety marks as square', () => {
    expect(classifyLoadingLogoShape('/assets/hawiety/mark-blue.png')).toBe('square');
  });

  it('treats workspace portal logos as wide', () => {
    expect(classifyLoadingLogoShape('/assets/workspace/portals/shop/logo.png')).toBe('wide');
  });

  it('treats appendo mark-only asset as wide', () => {
    expect(classifyLoadingLogoShape('/assets/appendo/brand/transparent/appendo-mark-currentColor.svg')).toBe(
      'square',
    );
  });
});
