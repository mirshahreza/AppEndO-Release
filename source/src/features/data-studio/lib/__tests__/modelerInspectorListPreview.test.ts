import { describe, expect, it } from 'vitest';
import {
  modelerInspectorMoreLinkAriaLabel,
  modelerInspectorMoreLinkLabel,
  sliceModelerInspectorList,
} from '../modelerInspectorListPreview';

describe('sliceModelerInspectorList', () => {
  it('shows every item when the list has at most five entries', () => {
    expect(sliceModelerInspectorList([1, 2, 3, 4, 5], false)).toEqual({
      visible: [1, 2, 3, 4, 5],
      hiddenCount: 0,
    });
  });

  it('hides the remainder until expanded', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect(sliceModelerInspectorList(items, false)).toEqual({
      visible: [1, 2, 3, 4, 5],
      hiddenCount: 2,
    });
    expect(sliceModelerInspectorList(items, true)).toEqual({
      visible: items,
      hiddenCount: 2,
    });
  });
});

describe('modelerInspectorMoreLinkLabel', () => {
  it('uses and N more until the list is expanded', () => {
    expect(modelerInspectorMoreLinkLabel(25, false)).toBe('and 25 more');
    expect(modelerInspectorMoreLinkAriaLabel(25, false)).toBe('Show 25 more');
    expect(modelerInspectorMoreLinkLabel(25, true)).toBe('Show less');
  });
});
