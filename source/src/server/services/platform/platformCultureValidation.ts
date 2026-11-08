import {
  BUILTIN_CULTURE_PACK_IDS,
  CULTURE_PACK_ID_PATTERN,
  type PlatformCulturePack,
  type PlatformCulturesConfig,
} from '../../../shared/api/contracts/platform/cultures';
import { validateCultureTypographyOverride } from '../../../core/culture/cultureTypographyMerge';
import { HttpError } from '../../errors/HttpError';
import { applyPlatformWebFontsRuntime } from './platformWebFontsRuntime';

const BUILTIN_ID_SET = new Set<string>(BUILTIN_CULTURE_PACK_IDS);

function normalizePack(input: PlatformCulturePack): PlatformCulturePack {
  const id = input.id.trim();
  const label = input.label.trim();
  const language = input.language.trim();
  const locale = input.locale.trim();
  const translationBundleId = input.translationBundleId.trim();
  const defaultTimezone = input.defaultTimezone?.trim();
  const typography = input.typography
    ? {
      defaultFontId: input.typography.defaultFontId.trim(),
      fonts: input.typography.fonts,
    }
    : undefined;

  return {
    id,
    label,
    language,
    locale,
    calendar: input.calendar,
    direction: input.direction,
    translationBundleId,
    ...(defaultTimezone ? { defaultTimezone } : {}),
    ...(typography ? { typography } : {}),
  };
}

function validatePack(pack: PlatformCulturePack, index: number): PlatformCulturePack {
  const normalized = normalizePack(pack);

  if (!normalized.id) {
    throw new HttpError(400, `packs[${index}].id is required.`);
  }

  if (!CULTURE_PACK_ID_PATTERN.test(normalized.id)) {
    throw new HttpError(400, `packs[${index}].id must be 2-32 lowercase letters, numbers, or hyphens.`);
  }

  if (!normalized.label) {
    throw new HttpError(400, `packs[${index}].label is required.`);
  }

  if (!normalized.language) {
    throw new HttpError(400, `packs[${index}].language is required.`);
  }

  if (!normalized.locale) {
    throw new HttpError(400, `packs[${index}].locale is required.`);
  }

  if (!BUILTIN_ID_SET.has(normalized.translationBundleId)) {
    throw new HttpError(400, `packs[${index}].translationBundleId must reference a builtin bundle (${BUILTIN_CULTURE_PACK_IDS.join(', ')}).`);
  }

  const typographyError = validateCultureTypographyOverride(
    normalized.translationBundleId,
    normalized.typography,
  );
  if (typographyError) {
    throw new HttpError(400, `packs[${index}].typography: ${typographyError}`);
  }

  return normalized;
}

export function validatePlatformCulturesConfig(
  input: PlatformCulturesConfig,
  resolvePackId: (cultureId: string) => boolean,
  settingsPath?: string,
): PlatformCulturesConfig {
  applyPlatformWebFontsRuntime(settingsPath);
  const packs: PlatformCulturePack[] = [];
  const seenPackIds = new Set<string>();

  if (input.packs.length === 0) {
    throw new HttpError(400, 'At least one culture pack must be configured.');
  }

  for (let index = 0; index < input.packs.length; index += 1) {
    const pack = validatePack(input.packs[index], index);
    if (seenPackIds.has(pack.id)) {
      throw new HttpError(400, `Duplicate culture pack id: ${pack.id}`);
    }
    seenPackIds.add(pack.id);
    packs.push(pack);
  }

  const enabledCulturePackIds = [...new Set(
    input.enabledCulturePackIds
      .map((id) => id.trim())
      .filter(Boolean),
  )];

  if (enabledCulturePackIds.length === 0) {
    throw new HttpError(400, 'At least one culture pack must be enabled.');
  }

  for (const cultureId of enabledCulturePackIds) {
    if (!resolvePackId(cultureId)) {
      throw new HttpError(400, `Unknown culture pack id: ${cultureId}`);
    }
  }

  const defaultCultureId = input.defaultCultureId.trim();
  if (!resolvePackId(defaultCultureId)) {
    throw new HttpError(400, `Unknown default culture id: ${defaultCultureId}`);
  }

  if (!enabledCulturePackIds.includes(defaultCultureId)) {
    throw new HttpError(400, 'defaultCultureId must be included in enabledCulturePackIds.');
  }

  return {
    packs,
    enabledCulturePackIds,
    defaultCultureId,
  };
}
