import type { PlatformCultureTranslationsConfig } from '../../../shared/api/contracts/platform/cultureTranslations';
import { MASTER_TRANSLATION_BUNDLE_ID } from '../../../shared/api/contracts/platform/cultureTranslations';

let cachedConfig: PlatformCultureTranslationsConfig | null = null;

function normalizeBundleId(bundleId: string): string {
  const normalized = bundleId.trim();
  if (normalized && cachedConfig?.bundles[normalized]) {
    return normalized;
  }
  return MASTER_TRANSLATION_BUNDLE_ID;
}

export function bootstrapServerCultureTranslationsCache(
  config: PlatformCultureTranslationsConfig,
): void {
  cachedConfig = config;
}

export function getServerCultureTranslationsRevision(): number {
  return cachedConfig?.revision ?? 0;
}

export function getServerCultureTranslationBundle(bundleId: string): Record<string, string> | undefined {
  if (!cachedConfig) {
    return undefined;
  }

  const normalized = normalizeBundleId(bundleId);
  return cachedConfig.bundles[normalized]
    ? { ...cachedConfig.bundles[normalized] }
    : undefined;
}

export function getServerCultureTranslationsConfig(): PlatformCultureTranslationsConfig | null {
  return cachedConfig;
}

export function resetServerCultureTranslationsCacheForTests(): void {
  cachedConfig = null;
}
