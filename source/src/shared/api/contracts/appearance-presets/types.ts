import type { AccentPaletteSource } from '../../../theme/accentColorUtils';
import type { ThemeTokenMap } from '../../../theme/themePresetUtils';
import { buildThemePresetPreviewSwatches } from '../../../theme/themePresetUtils';

export const THEME_PRESET_SCHEMA = 'append-theme-preset' as const;
export const THEME_PRESET_SCHEMA_VERSION = '1.1.0' as const;

/** One persisted token map per accent matrix swatch (`teal-core`, `gray-deep`, …). */
export type ThemePresetDocument = {
  schema: typeof THEME_PRESET_SCHEMA;
  schemaVersion: string;
  id: string;
  name: string;
  baseHex: string;
  source: AccentPaletteSource;
  tokens: ThemeTokenMap;
  createdAt: string;
  updatedAt: string;
};

export type ThemePresetSummary = {
  id: string;
  name: string;
  baseHex: string;
  source: AccentPaletteSource;
  previewSwatches: Array<{ key: string; value: string }>;
  updatedAt: string;
};

export type UpdateThemePresetInput = {
  tokens?: ThemeTokenMap;
  resetToDefaults?: boolean;
};

export function toThemePresetSummary(document: ThemePresetDocument): ThemePresetSummary {
  return {
    id: document.id,
    name: document.name,
    baseHex: document.baseHex,
    source: document.source,
    previewSwatches: buildThemePresetPreviewSwatches(document.tokens),
    updatedAt: document.updatedAt,
  };
}
