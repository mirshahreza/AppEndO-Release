import { describe, expect, it } from 'vitest';
import { gridTabletTierUsesCardGrid } from '../appTableGridPresentation';

describe('gridTabletTierUsesCardGrid', () => {
  it('is true for default list grid (auto + card from tablet)', () => {
    expect(gridTabletTierUsesCardGrid({
      presentation: 'auto',
      cardBelow: 'tablet',
      compactTabletLayout: 'inherit',
    })).toBe(true);
  });

  it('is false when auto cards start at phone only (tablet is table-scroll)', () => {
    expect(gridTabletTierUsesCardGrid({
      presentation: 'auto',
      cardBelow: 'phone',
      compactTabletLayout: 'inherit',
    })).toBe(false);
  });

  it('is false when tablet compact layout forces table-scroll', () => {
    expect(gridTabletTierUsesCardGrid({
      presentation: 'auto',
      cardBelow: 'tablet',
      compactTabletLayout: 'table-scroll',
    })).toBe(false);
  });

  it('is true when tablet compact layout is cards', () => {
    expect(gridTabletTierUsesCardGrid({
      presentation: 'table',
      compactTabletLayout: 'cards',
    })).toBe(true);
  });
});
