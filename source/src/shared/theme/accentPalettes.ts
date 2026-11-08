import type { AccentPaletteSource } from './accentColorUtils';

export type AccentSwatch = {
  id: string;
  name: string;
  hex: string;
};

export type AccentMatrixSwatch = AccentSwatch & {
  source: Extract<AccentPaletteSource, 'fluent' | 'material'>;
  intensity: 1 | 2 | 3 | 4 | 5;
};

export type AccentColorRow = {
  id: string;
  name: string;
  swatches: [AccentMatrixSwatch, AccentMatrixSwatch, AccentMatrixSwatch, AccentMatrixSwatch, AccentMatrixSwatch];
};

/** Column labels — Fluent tint40 → shade40 within one sharedColors family per row. */
export const ACCENT_INTENSITY_LABELS = ['Light', 'Soft', 'Core', 'Rich', 'Deep'] as const;

/**
 * One Fluent ColorVariants family per row (no Material mix — Soft/Rich used to drift hue).
 * Stops: tint40, tint20, primary, shade20, shade40.
 * Spread is intentional: Light is a clear pastel, Deep is near-shade — theme tokens scale
 * shell wash / nav chrome / glow with accent depth so the step feels proportional in-app.
 * @see https://github.com/microsoft/fluentui/blob/master/packages/tokens/src/global/colors.ts
 */
const buildRow = (
  id: string,
  name: string,
  stops: [string, string, string, string, string],
): AccentColorRow => ({
  id,
  name,
  swatches: [
    { id: `${id}-light`, name, hex: stops[0], source: 'fluent', intensity: 1 },
    { id: `${id}-soft`, name, hex: stops[1], source: 'fluent', intensity: 2 },
    { id: `${id}-core`, name, hex: stops[2], source: 'fluent', intensity: 3 },
    { id: `${id}-rich`, name, hex: stops[3], source: 'fluent', intensity: 4 },
    { id: `${id}-deep`, name, hex: stops[4], source: 'fluent', intensity: 5 },
  ],
});

export const ACCENT_COLOR_MATRIX: AccentColorRow[] = [
  // teal
  buildRow('teal', 'Teal',
    ['#9BD9DB', '#2AA0A4', '#038387', '#026467', '#012728']),
  // lightTeal (labeled Cyan — brighter teal family, still one Fluent ramp)
  buildRow('cyan', 'Cyan',
    ['#A6E9ED', '#32C8D1', '#00B7C3', '#008B94', '#00373A']),
  // green
  buildRow('green', 'Green',
    ['#9FD89F', '#359B35', '#107C10', '#0C5E0C', '#052505']),
  // blue
  buildRow('blue', 'Blue',
    ['#A9D3F2', '#3595DE', '#0078D4', '#005BA1', '#002440']),
  // navy
  buildRow('navy', 'Navy',
    ['#A3B2E8', '#3050C6', '#0027B4', '#001E89', '#000C36']),
  // purple
  buildRow('purple', 'Purple',
    ['#C6B1DE', '#7C52AB', '#5C2E91', '#46236E', '#1C0E2B']),
  // lavender (labeled Lilac)
  buildRow('lilac', 'Lilac',
    ['#D2CCF8', '#9184EE', '#7160E8', '#5649B0', '#221D46']),
  // cranberry
  buildRow('cranberry', 'Cranberry',
    ['#EEACB2', '#D33F4C', '#C50F1F', '#960B18', '#3B0509']),
  // orange
  buildRow('orange', 'Orange',
    ['#FDCFB4', '#F98845', '#F7630C', '#BC4B09', '#4A1E04']),
  // charcoal (labeled Gray)
  buildRow('gray', 'Gray',
    ['#C4C4C4', '#686868', '#393939', '#2B2B2B', '#111111']),
];

export const ACCENT_MATRIX_SWATCHES: AccentMatrixSwatch[] = ACCENT_COLOR_MATRIX.flatMap((row) => row.swatches);

export const DEFAULT_APPEARANCE_SWATCH_ID = 'teal-core';

export const ACCENT_MATRIX_SWATCH_BY_ID: Record<string, AccentMatrixSwatch> = Object.fromEntries(
  ACCENT_MATRIX_SWATCHES.map((swatch) => [swatch.id, swatch]),
);

export function isAccentMatrixSwatchId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ACCENT_MATRIX_SWATCH_BY_ID, id);
}

export function getAccentMatrixSwatch(id: string): AccentMatrixSwatch | null {
  return ACCENT_MATRIX_SWATCH_BY_ID[id] ?? null;
}

export function findAccentMatrixSwatchByHex(hex: string): AccentMatrixSwatch | null {
  const normalized = hex.trim().toUpperCase();
  return ACCENT_MATRIX_SWATCHES.find((swatch) => swatch.hex.toUpperCase() === normalized) ?? null;
}

export function buildAccentMatrixSwatchLabel(swatch: AccentMatrixSwatch): string {
  return `${swatch.name} — ${ACCENT_INTENSITY_LABELS[swatch.intensity - 1]}`;
}
