import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENT_HEX } from '../../../../theme/accentColorUtils';
import { getAccentMatrixSwatch } from '../../../../theme/accentPalettes';
import {
  APPENDOO_CHARACTER_GEL,
  APPENDOO_DEFAULT_COLOR_MODE,
  gelPaletteFromHex,
  mixAppendooGelPalette,
  resolveAppendooGelPalette,
  resolveAppendooPaletteHex,
} from '../appendooColor';

describe('appendooColor', () => {
  it('keeps peach as fruit flesh and barbapapa as cotton-candy pink', () => {
    expect(APPENDOO_CHARACTER_GEL.peach.lo).toBe('#f0b396');
    expect(APPENDOO_CHARACTER_GEL.peach.hi).toBe('#fff8f3');
    expect(APPENDOO_CHARACTER_GEL.barbapapa.mid).toBe('#f3b0cf');
    expect(APPENDOO_CHARACTER_GEL.sponge.mid).toBe('#ffe66d');
    expect(APPENDOO_CHARACTER_GEL.crab.lo).toBe('#d4452e');
    expect(APPENDOO_CHARACTER_GEL.bacteria.lo).toBe('#7cb342');
  });

  it('uses the original character gel by default', () => {
    const peach = resolveAppendooGelPalette({ mode: APPENDOO_DEFAULT_COLOR_MODE, shape: 'peach' });
    const crab = resolveAppendooGelPalette({ mode: 'character', shape: 'crab' });
    expect(peach.lo).toBe('#f0b396');
    expect(crab.lo).not.toBe(peach.lo);
  });

  it('tints the gel from the current theme hex', () => {
    const theme = resolveAppendooGelPalette({
      mode: 'theme',
      shape: 'peach',
      themeHex: '#0078D4',
    });
    expect(theme.lo).not.toBe(APPENDOO_CHARACTER_GEL.peach.lo);
    expect(theme.hi).not.toBe('#000000');
  });

  it('tints the gel from an accent palette swatch', () => {
    const cranberry = getAccentMatrixSwatch('cranberry-core');
    expect(cranberry).toBeTruthy();
    const palette = resolveAppendooGelPalette({
      mode: 'palette',
      shape: 'peach',
      paletteSwatchId: 'cranberry-core',
    });
    expect(resolveAppendooPaletteHex('cranberry-core').toUpperCase()).toBe(cranberry?.hex.toUpperCase());
    expect(palette.lo).not.toBe(APPENDOO_CHARACTER_GEL.peach.lo);
  });

  it('lifts near-black palette colors so the gel never collapses to a silhouette', () => {
    const dark = gelPaletteFromHex('#111111');
    expect(dark.hi).not.toBe('#000000');
    expect(dark.hi.toLowerCase()).not.toBe('#111111');
    expect(dark.lo).not.toBe('#000000');
    expect(gelPaletteFromHex(DEFAULT_ACCENT_HEX).mid).not.toBe(APPENDOO_CHARACTER_GEL.peach.mid);
  });

  it('mixes character gels so a morph can tint from sponge yellow into barbapapa pink', () => {
    const from = APPENDOO_CHARACTER_GEL.sponge;
    const to = APPENDOO_CHARACTER_GEL.barbapapa;
    expect(mixAppendooGelPalette(from, to, 0).mid).toBe(from.mid);
    expect(mixAppendooGelPalette(from, to, 1).mid).toBe(to.mid);
    expect(mixAppendooGelPalette(from, to, 0.5).mid).not.toBe(from.mid);
    expect(mixAppendooGelPalette(from, to, 0.5).mid).not.toBe(to.mid);
  });
});
