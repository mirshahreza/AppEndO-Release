import { BUILTIN_CULTURE_PACK_IDS } from '../../../shared/api/contracts/platform/cultures';
import type { PlatformCultureTranslationBundles } from '../../../shared/api/contracts/platform/cultureTranslations';
import irBundle from '../../../core/system-extensions/culture-packs/ir/bundle.ts';
import iqBundle from '../../../core/system-extensions/culture-packs/iq/bundle.ts';
import usBundle from '../../../core/system-extensions/culture-packs/us/bundle.ts';
const FILE_SEED_BUNDLES: PlatformCultureTranslationBundles = {
  us: { ...usBundle },
  ir: { ...irBundle },
  iq: { ...iqBundle },
};

const FILE_PACK_REFRESH_PREFIXES = [
  'appearance.',
  'operations.logs.',
  'operations.recordEvents.',
  'operations.retention.',
  'settings.forms.logs.',
  'settings.sections.logs',
] as const;

function isFilePackRefreshKey(key: string): boolean {
  return FILE_PACK_REFRESH_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function listSeedCultureTranslationBundleIds(): string[] {
  return [...BUILTIN_CULTURE_PACK_IDS];
}

export function buildSeedCultureTranslationBundles(): PlatformCultureTranslationBundles {
  return {
    us: { ...FILE_SEED_BUNDLES.us },
    ir: { ...FILE_SEED_BUNDLES.ir },
    iq: { ...FILE_SEED_BUNDLES.iq },
  };
}

export function mergeCultureTranslationBundles(
  current: PlatformCultureTranslationBundles,
  seed: PlatformCultureTranslationBundles,
): PlatformCultureTranslationBundles {
  const next: PlatformCultureTranslationBundles = {};

  for (const bundleId of listSeedCultureTranslationBundleIds()) {
    const seedBundle = seed[bundleId] ?? {};
    const currentBundle = current[bundleId] ?? {};
    // Shipped locale packs (ir/iq/us) refresh from repo seed; operator diffs live in cultureOverrides.
    const merged: Record<string, string> = { ...currentBundle, ...seedBundle };
    for (const [key, value] of Object.entries(seedBundle)) {
      if (isFilePackRefreshKey(key)) {
        merged[key] = value;
      }
    }
    next[bundleId] = merged;
  }

  for (const [bundleId, bundle] of Object.entries(current)) {
    if (!next[bundleId]) {
      next[bundleId] = { ...bundle };
    }
  }

  return next;
}
