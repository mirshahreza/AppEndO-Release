import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { MASTER_TRANSLATION_BUNDLE_ID } from '../../../shared/api/contracts/platform/cultureTranslations';
import { SETTINGS_PATH } from '../../config/settingsFile';
import {
  getPlatformCultureTranslationsConfig,
  savePlatformCultureTranslationsConfig,
} from '../../db/platformCultureTranslationsStore';
import { bootstrapPlatformCultureTranslationsFromSettings } from '../platform/platformCultureTranslations.service';
import { replaceCachedPlatformBlob } from '../settings/platformSettingsCache';
import {
  deleteSidecar,
  overlayPackageCultureKeysOnBundles,
  readSidecar,
  stripPackageCultureOverrides,
  writeSidecar,
} from './packageCultureKeysSidecar';
import { readPackageZipTextEntry } from './packageWorkspaceAssetInstall.service';

export { overlayPackageCultureKeysOnBundles } from './packageCultureKeysSidecar';

function parseCultureKeysJson(raw: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const keys: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const trimmedKey = key.trim();
      const trimmedValue = typeof value === 'string' ? value.trim() : '';
      if (!trimmedKey || !trimmedValue) continue;
      keys[trimmedKey] = trimmedValue;
    }
    return keys;
  } catch {
    return null;
  }
}

export async function seedPackageCultureKeysFromZip(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): Promise<{ seeded: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const entries = manifest.capabilities.culture_keys ?? [];
  if (entries.length === 0) {
    return { seeded: [], warnings };
  }

  const mergedKeys: Record<string, string> = {};
  for (const capability of entries) {
    const raw = readPackageZipTextEntry(packageId, version, capability.entry);
    if (!raw) {
      warnings.push(`Culture keys entry "${capability.entry}" was missing from the package artifact.`);
      continue;
    }
    const parsed = parseCultureKeysJson(raw);
    if (!parsed) {
      warnings.push(`Culture keys entry "${capability.entry}" is not a JSON object of string values.`);
      continue;
    }
    Object.assign(mergedKeys, parsed);
  }

  if (Object.keys(mergedKeys).length === 0) {
    return { seeded: [], warnings };
  }

  const config = getPlatformCultureTranslationsConfig(SETTINGS_PATH);
  const bundles = overlayPackageCultureKeysOnBundles(config.bundles, mergedKeys);
  if (!bundles[MASTER_TRANSLATION_BUNDLE_ID]) {
    bundles[MASTER_TRANSLATION_BUNDLE_ID] = { ...mergedKeys };
  }

  const saved = savePlatformCultureTranslationsConfig(SETTINGS_PATH, {
    ...config,
    revision: config.revision + 1,
    bundles,
    cultureOverrides: stripPackageCultureOverrides(config.cultureOverrides, mergedKeys),
  });
  writeSidecar({
    schema: 'package-culture-keys',
    schemaVersion: '1.0.0',
    packageId,
    keys: mergedKeys,
    appliedAt: new Date().toISOString(),
  });
  await replaceCachedPlatformBlob(
    'platformCultureTranslations',
    saved as unknown as Record<string, unknown>,
    null,
  );
  bootstrapPlatformCultureTranslationsFromSettings(SETTINGS_PATH);

  return { seeded: Object.keys(mergedKeys), warnings };
}

export async function uninstallPackageCultureKeys(packageId: string): Promise<void> {
  const sidecar = readSidecar(packageId);
  if (!sidecar) return;

  const config = getPlatformCultureTranslationsConfig(SETTINGS_PATH);
  const bundles: Record<string, Record<string, string>> = {};
  let changed = false;
  for (const [bundleId, bundle] of Object.entries(config.bundles)) {
    const next = { ...bundle };
    for (const [key, value] of Object.entries(sidecar.keys)) {
      if (next[key] === value) {
        delete next[key];
        changed = true;
      }
    }
    bundles[bundleId] = next;
  }
  if (changed) {
    const saved = savePlatformCultureTranslationsConfig(SETTINGS_PATH, {
      ...config,
      revision: config.revision + 1,
      bundles,
    });
    await replaceCachedPlatformBlob(
      'platformCultureTranslations',
      saved as unknown as Record<string, unknown>,
      null,
    );
    bootstrapPlatformCultureTranslationsFromSettings(SETTINGS_PATH);
  }
  deleteSidecar(packageId);
}
