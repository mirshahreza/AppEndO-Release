import type {
  PlatformCultureTranslationBundles,
  PlatformCultureTranslationOverrides,
  PlatformCultureTranslationsBootMeta,
  PlatformCultureTranslationsConfig,
} from '../../shared/api/contracts/platform/cultureTranslations';
import { DEFAULT_PLATFORM_CULTURE_TRANSLATIONS_CONFIG } from '../../shared/api/contracts/platform/cultureTranslations';
import { BUILTIN_CULTURE_PACK_IDS } from '../../shared/api/contracts/platform/cultures';
import { loadBuiltinTranslationBundle } from './builtinTranslationLoader';

let cultureOverridesByCultureId: PlatformCultureTranslationOverrides = {};
let translationRuntimeRevision = 0;

export function getCultureTranslationOverridesRevision(): number {
  return translationRuntimeRevision;
}

export function bootstrapCultureTranslationRuntime(
  meta?: PlatformCultureTranslationsBootMeta | null,
): void {
  cultureOverridesByCultureId = normalizeOverrides(meta?.cultureOverrides);
  translationRuntimeRevision = typeof meta?.revision === 'number' && meta.revision > 0
    ? meta.revision
    : translationRuntimeRevision + 1;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('appendo:culture-translations-updated'));
  }
}

/** @deprecated Use bootstrapCultureTranslationRuntime */
export const bootstrapCultureTranslationOverrides = bootstrapCultureTranslationRuntime;

export function getCultureTranslationOverrides(cultureId: string): Record<string, string> {
  const normalized = cultureId.trim();
  if (!normalized) {
    return {};
  }

  return { ...(cultureOverridesByCultureId[normalized] ?? {}) };
}

export function mergeTranslationBundle(
  baseBundle: Record<string, string>,
  cultureId: string,
): Record<string, string> {
  const overrides = getCultureTranslationOverrides(cultureId);
  if (Object.keys(overrides).length === 0) {
    return baseBundle;
  }

  return { ...baseBundle, ...overrides };
}

export async function resolveDefaultBundleForCulture(
  _cultureId: string,
  translationBundleId: string,
): Promise<Record<string, string>> {
  return loadBuiltinTranslationBundle(translationBundleId);
}

export function diffTranslationOverrides(
  defaults: Record<string, string>,
  effective: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {};

  for (const [key, value] of Object.entries(effective)) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const defaultValue = defaults[key];
    if (defaultValue !== trimmed) {
      next[key] = trimmed;
    }
  }

  return next;
}

export async function computeTranslationOverridesFromEffective(
  cultureId: string,
  translationBundleId: string,
  effective: Record<string, string>,
): Promise<Record<string, string>> {
  const defaults = await resolveDefaultBundleForCulture(cultureId, translationBundleId);
  return diffTranslationOverrides(defaults, effective);
}

export async function buildEffectiveTranslationBundle(
  cultureId: string,
  translationBundleId: string,
): Promise<Record<string, string>> {
  const base = await resolveDefaultBundleForCulture(cultureId, translationBundleId);
  return mergeTranslationBundle(base, cultureId);
}

function normalizeBundleMap(
  raw: PlatformCultureTranslationBundles | undefined,
): PlatformCultureTranslationBundles {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const next: PlatformCultureTranslationBundles = {};
  for (const [bundleId, entries] of Object.entries(raw)) {
    const normalizedBundleId = bundleId.trim();
    if (!normalizedBundleId || !entries || typeof entries !== 'object') {
      continue;
    }

    const bundle: Record<string, string> = {};
    for (const [key, value] of Object.entries(entries)) {
      const normalizedKey = key.trim();
      const normalizedValue = typeof value === 'string' ? value.trim() : '';
      if (!normalizedKey || !normalizedValue) {
        continue;
      }
      bundle[normalizedKey] = normalizedValue;
    }

    if (Object.keys(bundle).length > 0) {
      next[normalizedBundleId] = bundle;
    }
  }

  return next;
}

function normalizeOverrides(
  raw: PlatformCultureTranslationOverrides | undefined,
): PlatformCultureTranslationOverrides {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const next: PlatformCultureTranslationOverrides = {};
  for (const [cultureId, entries] of Object.entries(raw)) {
    const normalizedCultureId = cultureId.trim();
    if (!normalizedCultureId || !entries || typeof entries !== 'object') {
      continue;
    }

    const cultureOverrides: Record<string, string> = {};
    for (const [key, value] of Object.entries(entries)) {
      const normalizedKey = key.trim();
      const normalizedValue = typeof value === 'string' ? value.trim() : '';
      if (!normalizedKey || !normalizedValue) {
        continue;
      }
      cultureOverrides[normalizedKey] = normalizedValue;
    }

    if (Object.keys(cultureOverrides).length > 0) {
      next[normalizedCultureId] = cultureOverrides;
    }
  }

  return next;
}

export function normalizePlatformCultureTranslationsConfig(
  raw: unknown,
): PlatformCultureTranslationsConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PLATFORM_CULTURE_TRANSLATIONS_CONFIG };
  }

  const input = raw as Record<string, unknown>;
  const legacyOverrides = input.overrides as PlatformCultureTranslationOverrides | undefined;
  const cultureOverrides = normalizeOverrides(
    (input.cultureOverrides as PlatformCultureTranslationOverrides | undefined) ?? legacyOverrides,
  );

  return {
    revision: typeof input.revision === 'number' && Number.isFinite(input.revision) && input.revision >= 0
      ? Math.floor(input.revision)
      : 0,
    bundles: normalizeBundleMap(input.bundles as PlatformCultureTranslationBundles | undefined),
    cultureOverrides,
  };
}

export function toCultureTranslationsBootMeta(
  config: PlatformCultureTranslationsConfig,
): PlatformCultureTranslationsBootMeta {
  return {
    revision: config.revision,
    cultureOverrides: config.cultureOverrides,
  };
}

function isSeededBuiltinCultureBundle(cultureId: string, bundleId: string): boolean {
  return cultureId === bundleId
    && (BUILTIN_CULTURE_PACK_IDS as readonly string[]).includes(bundleId);
}

function mergeCultureTranslationOverrideDraft(
  baseBundle: Record<string, string>,
  effective: Record<string, string>,
  previousOverrides: Record<string, string>,
): Record<string, string> {
  const overrides = diffTranslationOverrides(baseBundle, effective);
  const next: Record<string, string> = { ...previousOverrides, ...overrides };

  for (const key of Object.keys(previousOverrides)) {
    if (overrides[key] !== undefined) {
      continue;
    }
    const effectiveValue = typeof effective[key] === 'string' ? effective[key].trim() : '';
    if (!effectiveValue || effectiveValue === baseBundle[key]) {
      delete next[key];
    }
  }

  return next;
}

export function buildCultureTranslationsSavePayload(
  current: PlatformCultureTranslationsConfig,
  draftByCultureId: Record<string, Record<string, string>>,
  cultures: Array<{ id: string; translationBundleId: string }>,
): PlatformCultureTranslationsConfig {
  const bundles: PlatformCultureTranslationBundles = Object.fromEntries(
    Object.entries(current.bundles).map(([bundleId, bundle]) => [bundleId, { ...bundle }]),
  );
  const cultureOverrides: PlatformCultureTranslationOverrides = Object.fromEntries(
    Object.entries(current.cultureOverrides).map(([cultureId, entries]) => [cultureId, { ...entries }]),
  );

  for (const culture of cultures) {
    const cultureId = culture.id.trim();
    const bundleId = culture.translationBundleId.trim() || cultureId;
    const effective = draftByCultureId[cultureId];
    if (!cultureId || !effective) {
      continue;
    }

    const baseBundle = bundles[bundleId] ?? {};
    if (cultureId === bundleId && !isSeededBuiltinCultureBundle(cultureId, bundleId)) {
      bundles[bundleId] = { ...baseBundle, ...effective };
      continue;
    }

    const mergedOverrides = mergeCultureTranslationOverrideDraft(
      baseBundle,
      effective,
      cultureOverrides[cultureId] ?? {},
    );
    if (Object.keys(mergedOverrides).length > 0) {
      cultureOverrides[cultureId] = mergedOverrides;
    } else {
      delete cultureOverrides[cultureId];
    }
  }

  return normalizePlatformCultureTranslationsConfig({
    revision: current.revision + 1,
    bundles,
    cultureOverrides,
  });
}
