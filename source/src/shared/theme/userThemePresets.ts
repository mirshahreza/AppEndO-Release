import { THEME_PRESETS_CONTEXT_KEY } from '../api/contracts/attributes/builtInAttributes';
import { isAccentMatrixSwatchId } from './accentPalettes';
import { sanitizeThemeTokenMap, type ThemeTokenMap } from './themePresetUtils';

export { THEME_PRESETS_CONTEXT_KEY };

export type UserThemePresetMap = Record<string, ThemeTokenMap>;

export const parseUserThemePresets = (value: unknown): UserThemePresetMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const parsed: UserThemePresetMap = {};
  for (const [swatchId, tokens] of Object.entries(value as Record<string, unknown>)) {
    if (!isAccentMatrixSwatchId(swatchId)) {
      continue;
    }
    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
      continue;
    }
    const sanitized = sanitizeThemeTokenMap(tokens as ThemeTokenMap);
    if (Object.keys(sanitized).length === 0) {
      continue;
    }
    parsed[swatchId] = sanitized;
  }
  return parsed;
};

export const getUserThemePresetTokens = (
  value: unknown,
  swatchId: string,
): ThemeTokenMap | null => {
  const tokens = parseUserThemePresets(value)[swatchId];
  return tokens ?? null;
};

export const upsertUserThemePresetTokens = (
  value: unknown,
  swatchId: string,
  tokens: ThemeTokenMap | null,
): UserThemePresetMap => {
  const next = parseUserThemePresets(value);
  if (!isAccentMatrixSwatchId(swatchId)) {
    return next;
  }
  if (!tokens) {
    delete next[swatchId];
    return next;
  }
  const sanitized = sanitizeThemeTokenMap(tokens);
  if (Object.keys(sanitized).length === 0) {
    delete next[swatchId];
    return next;
  }
  next[swatchId] = sanitized;
  return next;
};
