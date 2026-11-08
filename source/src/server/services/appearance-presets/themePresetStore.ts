import fs from 'fs';
import path from 'path';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import {
  THEME_PRESET_SCHEMA,
  THEME_PRESET_SCHEMA_VERSION,
  type ThemePresetDocument,
} from '../../../shared/api/contracts/appearance-presets/types';
import {
  buildAccentMatrixSwatchLabel,
  getAccentMatrixSwatch,
  isAccentMatrixSwatchId,
} from '../../../shared/theme/accentPalettes';
import {
  deriveThemeTokensFromBase,
  reconcileNeutralChromeTokens,
} from '../../../shared/theme/themePresetUtils';

const presetFilePath = (swatchId: string): string => (
  path.join(runtimeDirs.appearancePresets, `${swatchId}.json`)
);

const readPresetFile = (swatchId: string): ThemePresetDocument | null => {
  const filePath = presetFilePath(swatchId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ThemePresetDocument;
    if (parsed.schema !== THEME_PRESET_SCHEMA || parsed.id !== swatchId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const buildDefaultThemePresetDocument = (swatchId: string): ThemePresetDocument | null => {
  const swatch = getAccentMatrixSwatch(swatchId);
  if (!swatch) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    schema: THEME_PRESET_SCHEMA,
    schemaVersion: THEME_PRESET_SCHEMA_VERSION,
    id: swatch.id,
    name: buildAccentMatrixSwatchLabel(swatch),
    baseHex: swatch.hex,
    source: swatch.source,
    tokens: deriveThemeTokensFromBase(swatch.hex, swatch.source),
    createdAt: now,
    updatedAt: now,
  };
};

/** Public catalog for one accent swatch. User edits never write here. */
export const getThemePresetById = (swatchId: string): ThemePresetDocument | null => {
  if (!isAccentMatrixSwatchId(swatchId)) {
    return null;
  }
  const stored = readPresetFile(swatchId);
  if (!stored) {
    return buildDefaultThemePresetDocument(swatchId);
  }

  const tokens = reconcileNeutralChromeTokens(stored.tokens, stored.baseHex, stored.source);
  return {
    ...stored,
    schemaVersion: THEME_PRESET_SCHEMA_VERSION,
    tokens,
  };
};
