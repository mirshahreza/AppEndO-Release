import { describe, expect, it } from 'vitest';
import {
  APP_TABLE_GRID_CARD_VARIANTS,
  APP_TABLE_GRID_STANDARD_CARD_VARIANT,
  isAppTableGridCardVariant,
  resolveAppTableGridDefaultCardActionsPlacement,
} from '../appTableGridCardView';

describe('appTableGridCardView', () => {
  it('exposes only the standard card variant', () => {
    expect(APP_TABLE_GRID_CARD_VARIANTS).toEqual(['standard']);
    expect(APP_TABLE_GRID_STANDARD_CARD_VARIANT).toBe('standard');
  });

  it('locks card actions to the footer', () => {
    expect(resolveAppTableGridDefaultCardActionsPlacement('standard')).toBe('footer');
  });

  it('type guards the standard variant only', () => {
    expect(isAppTableGridCardVariant('standard')).toBe(true);
    expect(isAppTableGridCardVariant('list')).toBe(false);
  });
});
