import fs from 'fs';
import path from 'path';
import {
  ensurePackageManifestCached,
  leftoverCatalogVersionEntry,
} from '../../../core/packages/PackageArtifactService';
import { packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import { validateManifest, type AnyPackageManifest } from '../../../core/packages/PackageManifestValidator';
import type { InstallSelection } from './types';

export function parseManifestFile(manifestPath: string): AnyPackageManifest | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(packageDirs.root, manifestPath), 'utf8')) as unknown;
    const validation = validateManifest(parsed);
    return validation.valid ? validation.manifest : null;
  } catch {
    return null;
  }
}

export function resolveVersionForInstall(packageId: string, requestedVersion?: string): InstallSelection | null {
  const index = readPackageIndex();
  const entry = index.packages.find((p) => p.packageId === packageId);
  const requested = requestedVersion?.trim() || '';
  const indexed = requested
    ? entry?.versions.find((v) => v.version === requested)
    : entry?.versions[0];
  const selected = indexed
    ?? (requested ? leftoverCatalogVersionEntry(packageId, requested) : undefined);
  if (!selected) return null;

  const cached = ensurePackageManifestCached(packageId, selected);
  if (!cached?.manifestPath?.trim()) return null;

  return { version: cached.version, manifestPath: cached.manifestPath };
}
