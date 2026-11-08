import { BUILTIN_USER_ATTRIBUTE_KEYS } from '../../../shared/api/contracts/attributes/builtInAttributes';
import type {
  ThemePresetDocument,
  UpdateThemePresetInput,
} from '../../../shared/api/contracts/appearance-presets/types';
import {
  reconcileNeutralChromeTokens,
  sanitizeThemeTokenMap,
} from '../../../shared/theme/themePresetUtils';
import {
  parseUserThemePresets,
  upsertUserThemePresetTokens,
  type UserThemePresetMap,
} from '../../../shared/theme/userThemePresets';
import { findSettingsAttributeByScopeAndKey } from '../../domain/attributes/settingsAttributesRepository';
import {
  listUserAttributeRows,
  upsertUserAttributeValue,
} from '../../domain/attributes/valueRepository';
import { invalidateSessionContext } from '../attributes/sessionContextCache';
import { parseStoredAttributeValue, serializeAttributeValue } from '../attributes/valueValidation';
import { getThemePresetById } from './themePresetStore';

type MutationResult =
  | { ok: true; preset: ThemePresetDocument }
  | { ok: false; statusCode: number; error: string };

const readUserThemePresetMap = async (userId: number): Promise<UserThemePresetMap> => {
  const rows = await listUserAttributeRows(userId);
  const row = rows.find((entry) => entry.key === BUILTIN_USER_ATTRIBUTE_KEYS.themePresets);
  if (!row) {
    return {};
  }
  return parseUserThemePresets(parseStoredAttributeValue(row.value_text));
};

const persistUserThemePresetMap = async (
  userId: number,
  actorUserId: number,
  nextMap: UserThemePresetMap,
): Promise<boolean> => {
  const definition = await findSettingsAttributeByScopeAndKey(
    'USER',
    BUILTIN_USER_ATTRIBUTE_KEYS.themePresets,
  );
  if (!definition?.id) {
    return false;
  }

  await upsertUserAttributeValue(
    definition.id,
    userId,
    serializeAttributeValue(nextMap),
    actorUserId,
  );
  await invalidateSessionContext(userId);
  return true;
};

const applyUserOverlay = (
  catalog: ThemePresetDocument,
  overlay: UserThemePresetMap[string] | undefined,
): ThemePresetDocument => {
  if (!overlay) {
    return catalog;
  }
  return {
    ...catalog,
    tokens: reconcileNeutralChromeTokens(overlay, catalog.baseHex, catalog.source),
  };
};

export const resolveUserThemePreset = async (
  userId: number,
  swatchId: string,
): Promise<ThemePresetDocument | null> => {
  const catalog = getThemePresetById(swatchId);
  if (!catalog) {
    return null;
  }
  const userMap = await readUserThemePresetMap(userId);
  return applyUserOverlay(catalog, userMap[swatchId]);
};

export const updateUserThemePreset = async (
  userId: number,
  actorUserId: number,
  swatchId: string,
  input: UpdateThemePresetInput,
): Promise<MutationResult> => {
  const catalog = getThemePresetById(swatchId);
  if (!catalog) {
    return { ok: false, statusCode: 404, error: `Accent swatch "${swatchId}" not found.` };
  }

  const existingMap = await readUserThemePresetMap(userId);
  const nextMap = input.resetToDefaults
    ? upsertUserThemePresetTokens(existingMap, swatchId, null)
    : upsertUserThemePresetTokens(
      existingMap,
      swatchId,
      sanitizeThemeTokenMap(input.tokens ?? existingMap[swatchId] ?? catalog.tokens),
    );

  const saved = await persistUserThemePresetMap(userId, actorUserId, nextMap);
  if (!saved) {
    return { ok: false, statusCode: 503, error: 'Theme preset store is not available.' };
  }

  const preset = applyUserOverlay(catalog, nextMap[swatchId]);
  return {
    ok: true,
    preset: {
      ...preset,
      updatedAt: new Date().toISOString(),
    },
  };
};
