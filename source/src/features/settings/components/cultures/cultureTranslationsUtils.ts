import type {
  CultureTranslationCultureColumn,
  PlatformCultureTranslationsConfig,
  PlatformCultureTranslationsResponse,
} from '../../../../shared/api/contracts/platform/cultureTranslations';
import type { PlatformCulturePack } from '../../../../shared/api/contracts/platform/cultures';
import { buildCultureTranslationsSavePayload } from '../../../../core/culture/CultureTranslationOverrides';

export type CultureTranslationsDraft = Record<string, Record<string, string>>;

const RTL_TRANSLATION_BUNDLE_IDS = new Set(['ir', 'iq']);

export function isRtlCultureTranslationColumn(
  culture: Pick<CultureTranslationCultureColumn, 'direction' | 'translationBundleId'>,
): boolean {
  return culture.direction === 'rtl'
    || RTL_TRANSLATION_BUNDLE_IDS.has(culture.translationBundleId);
}

export function cultureTranslationColumnDir(
  culture: Pick<CultureTranslationCultureColumn, 'direction' | 'translationBundleId'>,
): 'ltr' | 'rtl' {
  return isRtlCultureTranslationColumn(culture) ? 'rtl' : 'ltr';
}

export function toCultureTranslationColumn(
  pack: Pick<PlatformCulturePack, 'id' | 'label' | 'locale' | 'translationBundleId' | 'direction'>,
): CultureTranslationCultureColumn {
  return {
    id: pack.id,
    label: pack.label,
    locale: pack.locale,
    translationBundleId: pack.translationBundleId,
    direction: pack.direction,
  };
}

/** Merge API columns with configured packs so new custom cultures are editable immediately. */
export function mergeCultureTranslationColumns(
  apiCultures: CultureTranslationCultureColumn[],
  packs: PlatformCulturePack[],
): CultureTranslationCultureColumn[] {
  const byId = new Map(apiCultures.map((culture) => [culture.id, culture]));

  for (const pack of packs) {
    const id = pack.id.trim();
    if (!id) {
      continue;
    }
    if (!byId.has(id)) {
      byId.set(id, toCultureTranslationColumn(pack));
    }
  }

  return [...byId.values()];
}

export function buildEffectiveTranslationsDraft(
  data: PlatformCultureTranslationsResponse,
  cultureIds: string[],
): CultureTranslationsDraft {
  const draft: CultureTranslationsDraft = {};

  for (const cultureId of cultureIds) {
    const culture = data.cultures.find((entry) => entry.id === cultureId);
    if (!culture) {
      continue;
    }

    const defaults = data.defaultBundles[culture.translationBundleId]
      ?? data.defaultBundles[culture.id]
      ?? {};
    const overrides = data.cultureOverrides[cultureId] ?? {};
    draft[cultureId] = { ...defaults, ...overrides };
  }

  return draft;
}

export function buildTranslationsSavePayload(
  data: PlatformCultureTranslationsResponse,
  draft: CultureTranslationsDraft,
): PlatformCultureTranslationsConfig {
  const current: PlatformCultureTranslationsConfig = {
    revision: data.revision,
    bundles: Object.fromEntries(
      Object.entries(data.defaultBundles).map(([bundleId, bundle]) => [bundleId, { ...bundle }]),
    ),
    cultureOverrides: { ...data.cultureOverrides },
  };

  return buildCultureTranslationsSavePayload(current, draft, data.cultures);
}

export function filterTranslationKeys(keys: string[], query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return keys;
  }

  return keys.filter((key) => key.toLowerCase().includes(normalized));
}

export type CultureTranslationSortField = 'key' | 'native';

export function sortTranslationKeys(
  keys: readonly string[],
  sortBy: CultureTranslationSortField,
  sortDirection: 'asc' | 'desc',
  masterBundle: Record<string, string>,
): string[] {
  const direction = sortDirection === 'desc' ? -1 : 1;
  return [...keys].sort((left, right) => {
    if (sortBy === 'native') {
      const leftNative = (masterBundle[left] ?? left).toLowerCase();
      const rightNative = (masterBundle[right] ?? right).toLowerCase();
      const nativeCompare = leftNative.localeCompare(rightNative);
      if (nativeCompare !== 0) {
        return nativeCompare * direction;
      }
    }

    return left.localeCompare(right) * direction;
  });
}
