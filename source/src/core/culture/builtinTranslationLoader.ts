import { BUILTIN_CULTURE_PACK_IDS } from '../../shared/api/contracts/platform/cultures';
import { MASTER_TRANSLATION_BUNDLE_ID } from '../../shared/api/contracts/platform/cultureTranslations';
import type { PlatformCultureTranslationBundleResponse } from '../../shared/api/contracts/platform/cultureTranslations';
import { getCultureTranslationOverridesRevision } from './CultureTranslationOverrides';
import {
  EMBEDDED_ENGLISH_BUNDLE,
  loadEmbeddedCultureBundle,
  mergePackageCultureOverlay,
} from './embeddedTranslationBundles';

const invokeFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
  globalThis.fetch(input, init);

const bundleCache = new Map<string, Record<string, string>>();
const bundleLoadPromises = new Map<string, Promise<Record<string, string>>>();
let cachedRevision = 0;

export function listBuiltinTranslationBundleIds(): string[] {
  return [...BUILTIN_CULTURE_PACK_IDS];
}

function normalizeBundleId(bundleId: string): string {
  const normalized = bundleId.trim();
  if (listBuiltinTranslationBundleIds().includes(normalized)) {
    return normalized;
  }
  return MASTER_TRANSLATION_BUNDLE_ID;
}

function invalidateClientBundleCacheIfRevisionChanged(): void {
  const revision = getCultureTranslationOverridesRevision();
  if (revision === cachedRevision) {
    return;
  }

  cachedRevision = revision;
  bundleCache.clear();
  bundleLoadPromises.clear();
}

async function fetchTranslationBundleFromApi(bundleId: string): Promise<Record<string, string>> {
  invalidateClientBundleCacheIfRevisionChanged();
  const revision = getCultureTranslationOverridesRevision();
  const path = revision > 0
    ? `/api/platform/culture-translations/bundle/${encodeURIComponent(bundleId)}?revision=${revision}`
    : `/api/platform/culture-translations/bundle/${encodeURIComponent(bundleId)}`;
  const response = await invokeFetch(path, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null) as PlatformCultureTranslationBundleResponse | null;

  if (!response.ok || data?.success !== true || !data.bundle) {
    throw new Error(`Failed to load culture translation bundle "${bundleId}".`);
  }

  const normalized = normalizeBundleId(bundleId);
  const embeddedBase = listBuiltinTranslationBundleIds().includes(normalized)
    ? await loadEmbeddedCultureBundle(normalized)
    : {};
  return mergePackageCultureOverlay(normalized, { ...embeddedBase, ...data.bundle });
}

async function resolveTranslationBundle(bundleId: string): Promise<Record<string, string>> {
  try {
    return await fetchTranslationBundleFromApi(bundleId);
  } catch {
    return loadEmbeddedCultureBundle(bundleId);
  }
}

export async function loadBuiltinTranslationBundle(bundleId: string): Promise<Record<string, string>> {
  const normalized = normalizeBundleId(bundleId);
  invalidateClientBundleCacheIfRevisionChanged();

  const cached = bundleCache.get(normalized);
  if (cached) {
    return cached;
  }

  const inFlight = bundleLoadPromises.get(normalized);
  if (inFlight) {
    return inFlight;
  }

  const loadPromise = resolveTranslationBundle(normalized).then((bundle) => {
    bundleCache.set(normalized, bundle);
    bundleLoadPromises.delete(normalized);
    return bundle;
  });

  bundleLoadPromises.set(normalized, loadPromise);
  return loadPromise;
}

export async function loadMasterTranslationBundle(): Promise<Record<string, string>> {
  try {
    return await loadBuiltinTranslationBundle(MASTER_TRANSLATION_BUNDLE_ID);
  } catch {
    return { ...EMBEDDED_ENGLISH_BUNDLE };
  }
}

export async function listBuiltinTranslationKeys(): Promise<string[]> {
  const keys = new Set<string>();
  await Promise.all(
    listBuiltinTranslationBundleIds().map(async (id) => {
      const bundle = await loadBuiltinTranslationBundle(id);
      for (const key of Object.keys(bundle)) {
        keys.add(key);
      }
    }),
  );
  return [...keys].sort((left, right) => left.localeCompare(right));
}

export async function loadBuiltinTranslationCatalog(): Promise<{
  keys: string[];
  masterBundle: Record<string, string>;
  defaultBundles: Record<string, Record<string, string>>;
}> {
  const bundleIds = listBuiltinTranslationBundleIds();
  const loadedBundles = await Promise.all(
    bundleIds.map(async (bundleId) => [bundleId, await loadBuiltinTranslationBundle(bundleId)] as const),
  );
  const defaultBundles = Object.fromEntries(loadedBundles);
  const keys = await listBuiltinTranslationKeys();
  const masterBundle = defaultBundles[MASTER_TRANSLATION_BUNDLE_ID]
    ?? await loadMasterTranslationBundle();

  return { keys, masterBundle, defaultBundles };
}

