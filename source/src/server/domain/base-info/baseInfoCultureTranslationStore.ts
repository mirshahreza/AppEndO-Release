import {
  buildCultureTranslationsSavePayload,
  mergeTranslationBundle,
  normalizePlatformCultureTranslationsConfig,
  type PlatformCultureTranslationsConfig,
} from '../../../core/culture/CultureTranslationOverrides';
import { MASTER_TRANSLATION_BUNDLE_ID } from '../../../shared/api/contracts/platform/cultureTranslations';
import {
  baseInfoTranslationKey,
  resolveBaseInfoLocalizedText,
  type BaseInfoCultureTextField,
  type BaseInfoLocaleTexts,
} from '../../../shared/lib/baseInfoCultureTranslations';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { getPlatformCulturesConfig } from '../../db/platformCultureSettingsStore';
import {
  getPlatformCultureTranslationsConfig,
  getPlatformCultureTranslationsConfigFromFile,
  savePlatformCultureTranslationsConfig,
} from '../../db/platformCultureTranslationsStore';
import { bootstrapPlatformCultureTranslationsFromSettings } from '../../services/platform/platformCultureTranslations.service';
import { syncBaseInfoCultureTextFromLocales } from './baseInfoCultureTextSqlSync';

type LocaleFieldPatch = {
  cultureId: string;
  title?: string | null;
  note?: string | null;
};

const listCultureColumns = () => {
  const culturesConfig = getPlatformCulturesConfig(SETTINGS_PATH);
  return culturesConfig.packs.map((pack) => ({
    id: pack.id,
    translationBundleId: pack.translationBundleId,
  }));
};

const buildEffectiveBundleForCulture = (
  config: PlatformCultureTranslationsConfig,
  cultureId: string,
  translationBundleId: string,
): Record<string, string> => {
  const bundleId = (translationBundleId || cultureId).trim();
  const base = { ...(config.bundles[bundleId] ?? {}) };
  return mergeTranslationBundle(base, cultureId);
};

export function readBaseInfoLocaleTexts(
  baseInfoId: string,
  canonical: { title: string | null; note: string | null },
): BaseInfoLocaleTexts {
  const config = getPlatformCultureTranslationsConfig(SETTINGS_PATH);
  const cultures = listCultureColumns();
  const locales: BaseInfoLocaleTexts = {};

  for (const culture of cultures) {
    if (culture.id === 'us') {
      continue;
    }
    const bundle = buildEffectiveBundleForCulture(config, culture.id, culture.translationBundleId);
    const titleKey = baseInfoTranslationKey('title', baseInfoId);
    const noteKey = baseInfoTranslationKey('note', baseInfoId);
    const title = String(bundle[titleKey] ?? '').trim();
    const note = String(bundle[noteKey] ?? '').trim();
    const canonicalTitle = String(canonical.title ?? '').trim();
    const canonicalNote = String(canonical.note ?? '').trim();
    if ((title && title !== titleKey && title !== canonicalTitle) || (note && note !== noteKey && note !== canonicalNote)) {
      locales[culture.id] = {
        title: title && title !== titleKey ? title : undefined,
        note: note && note !== noteKey ? note : undefined,
      };
    }
  }

  return locales;
}

function applyLocalePatchesToDraft(
  draft: Record<string, Record<string, string>>,
  baseInfoId: string,
  patches: LocaleFieldPatch[],
): void {
  for (const patch of patches) {
    const cultureId = patch.cultureId.trim();
    if (!cultureId || cultureId === 'us') {
      continue;
    }
    if (!draft[cultureId]) {
      draft[cultureId] = {};
    }
    const cultureDraft = draft[cultureId];
    if (patch.title !== undefined) {
      const trimmed = String(patch.title ?? '').trim();
      const key = baseInfoTranslationKey('title', baseInfoId);
      if (trimmed) {
        cultureDraft[key] = trimmed;
      } else {
        delete cultureDraft[key];
      }
    }
    if (patch.note !== undefined) {
      const trimmed = String(patch.note ?? '').trim();
      const key = baseInfoTranslationKey('note', baseInfoId);
      if (trimmed) {
        cultureDraft[key] = trimmed;
      } else {
        delete cultureDraft[key];
      }
    }
  }
}

export function persistBaseInfoLocaleTexts(
  baseInfoId: string,
  locales: BaseInfoLocaleTexts | undefined,
): void {
  const trimmedId = baseInfoId.trim();
  if (!trimmedId || !locales) {
    return;
  }

  const patches: LocaleFieldPatch[] = Object.entries(locales).map(([cultureId, value]) => ({
    cultureId,
    title: value?.title,
    note: value?.note,
  }));

  if (patches.length === 0) {
    return;
  }

  const current = getPlatformCultureTranslationsConfig(SETTINGS_PATH);
  const draft: Record<string, Record<string, string>> = {};
  applyLocalePatchesToDraft(draft, trimmedId, patches);

  const cultures = listCultureColumns();
  const next = buildCultureTranslationsSavePayload(current, draft, cultures);
  const saved = savePlatformCultureTranslationsConfig(SETTINGS_PATH, next);
  bootstrapPlatformCultureTranslationsFromSettings(SETTINGS_PATH);
  void saved;
}

export function persistBaseInfoLocaleTextsWithSqlMirror(
  baseInfoId: string,
  canonicalTitle: string | null | undefined,
  locales: BaseInfoLocaleTexts | undefined,
): void {
  persistBaseInfoLocaleTexts(baseInfoId, locales);
  syncBaseInfoCultureTextFromLocales(baseInfoId, canonicalTitle, locales);
}

export function persistBaseInfoLocaleTextsBulk(
  entries: Array<{
    baseInfoId: string;
    locales: BaseInfoLocaleTexts;
  }>,
): void {
  if (entries.length === 0) {
    return;
  }

  const current = getPlatformCultureTranslationsConfig(SETTINGS_PATH);
  const draft: Record<string, Record<string, string>> = {};

  for (const entry of entries) {
    const patches: LocaleFieldPatch[] = Object.entries(entry.locales).map(([cultureId, value]) => ({
      cultureId,
      title: value?.title,
      note: value?.note,
    }));
    applyLocalePatchesToDraft(draft, entry.baseInfoId.trim(), patches);
  }

  const cultures = listCultureColumns();
  const next = buildCultureTranslationsSavePayload(current, draft, cultures);
  savePlatformCultureTranslationsConfig(SETTINGS_PATH, normalizePlatformCultureTranslationsConfig(next));
  bootstrapPlatformCultureTranslationsFromSettings(SETTINGS_PATH);
}

export function buildMergedCultureBundle(cultureId: string): Record<string, string> {
  // ETL/scripts update settings.json directly; do not rely on in-process platform blob cache.
  const config = getPlatformCultureTranslationsConfigFromFile(SETTINGS_PATH);
  const cultures = listCultureColumns();
  const culture = cultures.find((item) => item.id === cultureId)
    ?? cultures.find((item) => item.id === MASTER_TRANSLATION_BUNDLE_ID);
  if (!culture) {
    return { ...(config.bundles[MASTER_TRANSLATION_BUNDLE_ID] ?? {}) };
  }
  return buildEffectiveBundleForCulture(config, culture.id, culture.translationBundleId);
}

export function resolveBaseInfoFieldFromBundle(options: {
  cultureId: string;
  baseInfoId: string;
  field: BaseInfoCultureTextField;
  canonical: string | null | undefined;
  bundle?: Record<string, string>;
}): string {
  const bundle = options.bundle ?? buildMergedCultureBundle(options.cultureId);
  return resolveBaseInfoLocalizedText({
    cultureId: options.cultureId,
    baseInfoId: options.baseInfoId,
    field: options.field,
    canonical: options.canonical,
    bundle,
  });
}
