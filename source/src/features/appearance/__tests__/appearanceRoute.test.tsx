import { describe, expect, it } from 'vitest';
import { buildAccentMatrixSwatchLabel, getAccentMatrixSwatch } from '../../../shared/theme/accentPalettes';
import {
  DEFAULT_APPEARANCE_SWATCH_ID,
  parseAppearanceSwatchId,
  resolveActiveAppearanceSwatchId,
} from '../lib/appearanceRoute';

describe('appearanceRoute', () => {
  it('parses legacy edit paths for redirects', () => {
    expect(parseAppearanceSwatchId('edit/teal-core')).toBe('teal-core');
    expect(parseAppearanceSwatchId('edit/unknown')).toBeNull();
    expect(parseAppearanceSwatchId(undefined)).toBeNull();
  });

  it('resolves the active swatch from the header accent', () => {
    expect(resolveActiveAppearanceSwatchId()).toBe(DEFAULT_APPEARANCE_SWATCH_ID);
    expect(resolveActiveAppearanceSwatchId('#111111')).toBe('gray-deep');
  });
});

describe('accent matrix swatch labels', () => {
  it('builds stable editor labels', () => {
    const swatch = getAccentMatrixSwatch('teal-core');
    expect(swatch).toBeTruthy();
    expect(buildAccentMatrixSwatchLabel(swatch!)).toBe('Teal — Core');
  });
});
