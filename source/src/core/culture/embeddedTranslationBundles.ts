import { BUILTIN_CULTURE_PACK_IDS } from '../../shared/api/contracts/platform/cultures';
import { MASTER_TRANSLATION_BUNDLE_ID } from '../../shared/api/contracts/platform/cultureTranslations';
import { createTranslationRuntime } from './TranslationRuntime';
import { BUILTIN_TRANSLATION_MASTER_EN } from './translations/masterEn';
import hawietyIqOverlay from '../system-extensions/culture-packs/overlays/hawiety.iq.json';
import hawietyIrOverlay from '../system-extensions/culture-packs/overlays/hawiety.ir.json';
import hawietyUsOverlay from '../system-extensions/culture-packs/overlays/hawiety.us.json';
import {
  MEMBER_DOSSIER_CHANGE_LOG_TRANSLATIONS_IQ,
  MEMBER_DOSSIER_CHANGE_LOG_TRANSLATIONS_IR,
  MEMBER_DOSSIER_CHANGE_LOG_TRANSLATIONS_US,
} from '../../../scripts/hwy-phase3/culture/memberDossierChangeLogTranslations';
import { buildHwyMemberDirectoryLegacyFilterCultureKeysEn, buildHwyMemberDirectoryLegacyFilterCultureKeysIq } from '../../domain/hwy/hwyMemberDirectoryLegacyFilterLabels';
import { buildHwyMemberListScopedEditCultureKeysEn, buildHwyMemberListScopedEditCultureKeysIq } from '../../domain/hwy/hwyMemberListScopedEditLabels';

/**
 * Built-in English catalog shipped with the client bundle.
 * Used before API/DB translations load and whenever remote bundles are unavailable.
 * Hawiety package copy is merged from shipped `hawiety.*.json` overlays (synced by `hwyCultureKeysInstall`).
 */
export const EMBEDDED_ENGLISH_BUNDLE: Readonly<Record<string, string>> = {
  ...BUILTIN_TRANSLATION_MASTER_EN,
};

const PACKAGE_CULTURE_OVERLAYS: Partial<Record<string, Record<string, string>>> = {
  iq: hawietyIqOverlay as Record<string, string>,
  ir: hawietyIrOverlay as Record<string, string>,
  us: hawietyUsOverlay as Record<string, string>,
};

const MEMBER_DOSSIER_CHANGE_LOG_BY_BUNDLE: Partial<Record<string, Record<string, string>>> = {
  iq: MEMBER_DOSSIER_CHANGE_LOG_TRANSLATIONS_IQ,
  ir: MEMBER_DOSSIER_CHANGE_LOG_TRANSLATIONS_IR,
  us: MEMBER_DOSSIER_CHANGE_LOG_TRANSLATIONS_US,
};

const HWY_MEMBER_DIRECTORY_LEGACY_FILTER_BY_BUNDLE: Partial<Record<string, Record<string, string>>> = {
  iq: buildHwyMemberDirectoryLegacyFilterCultureKeysIq(),
  us: buildHwyMemberDirectoryLegacyFilterCultureKeysEn(),
};

const HWY_MEMBER_LIST_SCOPED_EDIT_BY_BUNDLE: Partial<Record<string, Record<string, string>>> = {
  iq: buildHwyMemberListScopedEditCultureKeysIq(),
  us: buildHwyMemberListScopedEditCultureKeysEn(),
};

/** Merges shipped package overlays (e.g. Hawiety) onto API or builtin culture bundles. */
export function mergePackageCultureOverlay(
  bundleId: string,
  base: Record<string, string>,
): Record<string, string> {
  const changeLog = MEMBER_DOSSIER_CHANGE_LOG_BY_BUNDLE[bundleId];
  let merged = changeLog ? { ...base, ...changeLog } : base;
  const legacyFilters = HWY_MEMBER_DIRECTORY_LEGACY_FILTER_BY_BUNDLE[bundleId];
  if (legacyFilters) {
    merged = { ...merged, ...legacyFilters };
  }
  const listScopedEdit = HWY_MEMBER_LIST_SCOPED_EDIT_BY_BUNDLE[bundleId];
  if (listScopedEdit) {
    merged = { ...merged, ...listScopedEdit };
  }
  const overlay = PACKAGE_CULTURE_OVERLAYS[bundleId];
  return overlay ? { ...merged, ...overlay } : merged;
}

const mergeEmbeddedPackageCultureOverlay = mergePackageCultureOverlay;

const embeddedCultureBundleLoaders: Record<string, () => Promise<Record<string, string>>> = {
  us: async () => mergeEmbeddedPackageCultureOverlay('us', { ...EMBEDDED_ENGLISH_BUNDLE }),
  ir: async () => {
    const module = await import('../system-extensions/culture-packs/ir/bundle.ts');
    return mergeEmbeddedPackageCultureOverlay('ir', { ...module.default });
  },
  iq: async () => {
    const module = await import('../system-extensions/culture-packs/iq/bundle.ts');
    return mergeEmbeddedPackageCultureOverlay('iq', { ...module.default });
  },
};

export function lookupEmbeddedEnglish(key: string): string {
  const value = EMBEDDED_ENGLISH_BUNDLE[key];
  return value != null && value !== '' ? value : key;
}

export async function loadEmbeddedCultureBundle(bundleId: string): Promise<Record<string, string>> {
  const normalized = bundleId.trim() || MASTER_TRANSLATION_BUNDLE_ID;
  const loader = embeddedCultureBundleLoaders[normalized];
  if (loader) {
    return loader();
  }

  if (BUILTIN_CULTURE_PACK_IDS.includes(normalized)) {
    return { ...EMBEDDED_ENGLISH_BUNDLE };
  }

  return { ...EMBEDDED_ENGLISH_BUNDLE };
}

export function createEmbeddedEnglishTranslationRuntime() {
  const bundle = { ...EMBEDDED_ENGLISH_BUNDLE };
  return createTranslationRuntime(bundle, bundle);
}

/** Sync bundle for public routes — merges shipped culture overlay before async pack load. */
export function createEmbeddedPublicCultureTranslationRuntime(cultureId: string) {
  const normalized = cultureId.trim() || MASTER_TRANSLATION_BUNDLE_ID;
  const bundle = mergePackageCultureOverlay(normalized, { ...EMBEDDED_ENGLISH_BUNDLE });
  const fallback = normalized === MASTER_TRANSLATION_BUNDLE_ID
    ? bundle
    : { ...EMBEDDED_ENGLISH_BUNDLE };
  return createTranslationRuntime(bundle, fallback);
}
