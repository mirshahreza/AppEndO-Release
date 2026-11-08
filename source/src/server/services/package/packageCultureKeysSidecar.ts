import fs from 'fs';
import path from 'path';
import { MASTER_TRANSLATION_BUNDLE_ID } from '../../../shared/api/contracts/platform/cultureTranslations';
import { atomicWriteText, packageDirs } from '../../../core/packages/PackageFileStore';

export type CultureKeysSidecar = {
  schema: 'package-culture-keys';
  schemaVersion: '1.0.0';
  packageId: string;
  keys: Record<string, string>;
  appliedAt: string;
};

export function sidecarPath(packageId: string): string {
  return path.join(packageDirs.installed, `${packageId}.culture-keys.json`);
}

export function readSidecar(packageId: string): CultureKeysSidecar | null {
  return readSidecarFile(sidecarPath(packageId));
}

function readSidecarFile(filePath: string): CultureKeysSidecar | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CultureKeysSidecar;
    if (!parsed || parsed.schema !== 'package-culture-keys' || !parsed.keys || typeof parsed.keys !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSidecar(record: CultureKeysSidecar): void {
  atomicWriteText(sidecarPath(record.packageId), `${JSON.stringify(record, null, 2)}\n`);
}

export function deleteSidecar(packageId: string): void {
  const filePath = sidecarPath(packageId);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/**
 * Package sidecars store English master keys. Overlay them on the `us` bundle only —
 * locale packs (`ir`, `iq`, …) keep their own strings from settings/seed installs.
 */
export function overlayPackageCultureKeysOnBundles(
  bundles: Record<string, Record<string, string>>,
  keys: Record<string, string>,
): Record<string, Record<string, string>> {
  if (Object.keys(keys).length === 0) {
    return bundles;
  }
  const next: Record<string, Record<string, string>> = {};
  for (const [bundleId, bundle] of Object.entries(bundles)) {
    next[bundleId] = { ...bundle };
  }
  next[MASTER_TRANSLATION_BUNDLE_ID] = {
    ...(next[MASTER_TRANSLATION_BUNDLE_ID] ?? {}),
    ...keys,
  };
  return next;
}

export function stripPackageCultureOverrides(
  overrides: Record<string, Record<string, string>>,
  keys: Record<string, string>,
): Record<string, Record<string, string>> {
  if (Object.keys(keys).length === 0) {
    return overrides;
  }
  const next: Record<string, Record<string, string>> = {};
  for (const [cultureId, entries] of Object.entries(overrides)) {
    if (cultureId !== MASTER_TRANSLATION_BUNDLE_ID) {
      next[cultureId] = { ...entries };
      continue;
    }

    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(entries)) {
      if (key in keys) {
        continue;
      }
      filtered[key] = value;
    }
    if (Object.keys(filtered).length > 0) {
      next[cultureId] = filtered;
    }
  }
  return next;
}

/** Union of every installed package's culture-keys sidecar. Later files win on duplicate keys. */
export function collectInstalledPackageCultureKeys(): Record<string, string> {
  const dir = packageDirs.installed;
  if (!fs.existsSync(dir)) {
    return {};
  }
  const keys: Record<string, string> = {};
  for (const name of fs.readdirSync(dir).sort((left, right) => left.localeCompare(right))) {
    if (!name.endsWith('.culture-keys.json')) {
      continue;
    }
    const sidecar = readSidecarFile(path.join(dir, name));
    if (!sidecar) {
      continue;
    }
    Object.assign(keys, sidecar.keys);
  }
  return keys;
}
