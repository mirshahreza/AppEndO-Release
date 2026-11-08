import { hexToHsl, hexToRgb, hslToHex, rgbToHex } from '../../../lib/colorMath';
import { DEFAULT_ACCENT_HEX } from '../../../theme/accentColorUtils';
import {
  ACCENT_MATRIX_SWATCHES,
  DEFAULT_APPEARANCE_SWATCH_ID,
  getAccentMatrixSwatch,
} from '../../../theme/accentPalettes';
import type { AppendooShapeId } from './appendooBodyShape';

export const APPENDOO_COLOR_MODE_IDS = ['character', 'theme', 'palette'] as const;
export type AppendooColorMode = (typeof APPENDOO_COLOR_MODE_IDS)[number];

export const APPENDOO_DEFAULT_COLOR_MODE: AppendooColorMode = 'character';
export const APPENDOO_DEFAULT_PALETTE_SWATCH_ID = DEFAULT_APPEARANCE_SWATCH_ID;
export const APPENDOO_PALETTE_SWATCH_IDS = ACCENT_MATRIX_SWATCHES.map((swatch) => swatch.id);

export const APPENDOO_COLOR_MODE_META: Record<AppendooColorMode, { id: AppendooColorMode; label: string; note: string }> = {
  character: { id: 'character', label: 'Character', note: 'Original colors for this silhouette.' },
  theme: { id: 'theme', label: 'Theme', note: 'Follows the current accent theme.' },
  palette: { id: 'palette', label: 'Palette', note: 'A swatch from the accent color palette.' },
};

export type AppendooGelPalette = {
  hi: string;
  mid: string;
  lo: string;
  glow: string;
  rim: string;
  blush: string;
  ink: string;
  spark: string;
  leaf: string;
  stem: string;
  shadow: string;
};

const INK = '#2a221c';
const SPARK = '#ffd38a';
const LEAF = '#6faf62';
const STEM = '#6a4b32';

const withSharedTrim = (gel: Omit<AppendooGelPalette, 'ink' | 'spark' | 'leaf' | 'stem'>): AppendooGelPalette => ({
  ...gel,
  ink: INK,
  spark: SPARK,
  leaf: LEAF,
  stem: STEM,
});

const toHex = (hex: string): string => {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(rgb.r, rgb.g, rgb.b).toLowerCase() : '#f0b396';
};

const mixHex = (from: string, to: string, amount: number): string => {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  if (!start || !end) return toHex(from);
  const t = Math.min(1, Math.max(0, amount));
  return toHex(rgbToHex(
    start.r + (end.r - start.r) * t,
    start.g + (end.g - start.g) * t,
    start.b + (end.b - start.b) * t,
  ));
};

const luminance = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
};

const shadowFrom = (hex: string): string => {
  const rgb = hexToRgb(mixHex(hex, '#1a120e', 0.52));
  if (!rgb) return 'rgb(72 36 24)';
  return `rgb(${Math.round(rgb.r)} ${Math.round(rgb.g)} ${Math.round(rgb.b)})`;
};

/**
 * Hand-tuned gels for the original characters. Peach keeps the current fruit flesh.
 * Barbapapa is cotton-candy pink; sponge is kitchen-sponge yellow; crab is cartoon red;
 * bacteria is textbook germ lime; blot is wet indigo ink.
 */
export const APPENDOO_CHARACTER_GEL: Record<AppendooShapeId, AppendooGelPalette> = {
  none: withSharedTrim({
    hi: '#fffaf6',
    mid: '#e8ddd4',
    lo: '#c4b4a6',
    glow: '#f4ece4',
    rim: '#efe6dc',
    blush: '#ff9ea0',
    shadow: 'rgb(72 52 40)',
  }),
  peach: withSharedTrim({
    hi: '#fff8f3',
    mid: '#ffdcc9',
    lo: '#f0b396',
    glow: '#ffc4b8',
    rim: '#f3d4c6',
    blush: '#ff9ea0',
    shadow: 'rgb(92 42 28)',
  }),
  blot: withSharedTrim({
    hi: '#f4f0ff',
    mid: '#c4b8f5',
    lo: '#7b6bc9',
    glow: '#d8ccff',
    rim: '#ddd4f7',
    blush: '#e8a0c8',
    shadow: 'rgb(48 36 92)',
  }),
  bacteria: withSharedTrim({
    hi: '#f4ffd8',
    mid: '#c8e86a',
    lo: '#7cb342',
    glow: '#d4f08a',
    rim: '#dce8b8',
    blush: '#e8c070',
    shadow: 'rgb(48 72 20)',
  }),
  barbapapa: withSharedTrim({
    hi: '#fff5fa',
    mid: '#f3b0cf',
    lo: '#e08aab',
    glow: '#ffc4dc',
    rim: '#f6d4e4',
    blush: '#ff9eba',
    shadow: 'rgb(92 36 64)',
  }),
  sponge: withSharedTrim({
    hi: '#fffce8',
    mid: '#ffe66d',
    lo: '#e8c83a',
    glow: '#ffeaa0',
    rim: '#f5e7a8',
    blush: '#ffb070',
    shadow: 'rgb(92 64 12)',
  }),
  crab: withSharedTrim({
    hi: '#ffe8e0',
    mid: '#f07058',
    lo: '#d4452e',
    glow: '#ff8a78',
    rim: '#f4c4b8',
    blush: '#ff7a8a',
    shadow: 'rgb(92 28 20)',
  }),
};

export const gelPaletteFromHex = (hex: string): AppendooGelPalette => {
  const seed = toHex(hex || DEFAULT_ACCENT_HEX);
  const lifted = luminance(seed) < 0.28 ? mixHex(seed, '#ffffff', 0.48) : seed;
  const hsl = hexToHsl(lifted) ?? { h: 174, s: 45, l: 58 };
  const sat = Math.min(62, Math.max(16, hsl.s * 0.82));
  const light = Math.min(68, Math.max(46, hsl.l < 36 ? 56 : hsl.l));
  const hi = toHex(hslToHex({ h: hsl.h, s: Math.max(10, sat * 0.28), l: 95 }));
  const mid = toHex(hslToHex({ h: hsl.h, s: sat * 0.72, l: Math.min(84, light + 16) }));
  const lo = toHex(hslToHex({ h: hsl.h, s: Math.min(68, sat + 6), l: Math.max(42, light - 6) }));
  const glow = mixHex(mid, '#ffffff', 0.22);
  const rim = mixHex(hi, mid, 0.28);
  const blush = toHex(hslToHex({
    h: Math.round((hsl.h * 0.55 + 8 * 0.45 + 360) % 360),
    s: Math.min(70, sat + 12),
    l: 72,
  }));
  return withSharedTrim({
    hi,
    mid,
    lo,
    glow,
    rim,
    blush,
    shadow: shadowFrom(lo),
  });
};

export type AppendooColorRequest = {
  mode: AppendooColorMode;
  shape: AppendooShapeId;
  themeHex?: string;
  paletteHex?: string;
  paletteSwatchId?: string;
};

export const isAppendooColorMode = (value: string): value is AppendooColorMode => (
  (APPENDOO_COLOR_MODE_IDS as readonly string[]).includes(value)
);

export const resolveAppendooPaletteHex = (swatchId: string | undefined): string => (
  getAccentMatrixSwatch(swatchId ?? APPENDOO_DEFAULT_PALETTE_SWATCH_ID)?.hex
  ?? DEFAULT_ACCENT_HEX
);

export const resolveAppendooGelPalette = (request: AppendooColorRequest): AppendooGelPalette => {
  if (request.mode === 'theme') {
    return gelPaletteFromHex(request.themeHex || DEFAULT_ACCENT_HEX);
  }
  if (request.mode === 'palette') {
    return gelPaletteFromHex(request.paletteHex || resolveAppendooPaletteHex(request.paletteSwatchId));
  }
  return APPENDOO_CHARACTER_GEL[request.shape] ?? APPENDOO_CHARACTER_GEL.peach;
};

export const mixAppendooGelPalette = (
  from: AppendooGelPalette,
  to: AppendooGelPalette,
  t: number,
): AppendooGelPalette => {
  const mix = Math.min(1, Math.max(0, t));
  return {
    hi: mixHex(from.hi, to.hi, mix),
    mid: mixHex(from.mid, to.mid, mix),
    lo: mixHex(from.lo, to.lo, mix),
    glow: mixHex(from.glow, to.glow, mix),
    rim: mixHex(from.rim, to.rim, mix),
    blush: mixHex(from.blush, to.blush, mix),
    ink: mix < 0.5 ? from.ink : to.ink,
    spark: mix < 0.5 ? from.spark : to.spark,
    leaf: mixHex(from.leaf, to.leaf, mix),
    stem: mixHex(from.stem, to.stem, mix),
    shadow: mix < 0.5 ? from.shadow : to.shadow,
  };
};

export const appendooGelCssVars = (gel: AppendooGelPalette): Record<string, string> => ({
  '--appendoo-glass-hi': gel.hi,
  '--appendoo-glass-mid': gel.mid,
  '--appendoo-glass-lo': gel.lo,
  '--appendoo-glass-glow': gel.glow,
  '--appendoo-glass-rim': gel.rim,
  '--appendoo-blush': gel.blush,
  '--appendoo-ink': gel.ink,
  '--appendoo-spark': gel.spark,
  '--appendoo-leaf': gel.leaf,
  '--appendoo-stem': gel.stem,
  '--appendoo-shadow': gel.shadow,
});
