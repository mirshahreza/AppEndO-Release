import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { packageDirs } from '../../../core/packages/PackageFileStore';
import {
  PACKAGE_WORKSPACE_ASSETS_PACKAGE_PREFIX,
  packageWorkspaceAssetUrlToRelativePath,
  toPackageWorkspaceAssetUrl,
} from '../../../shared/lib/packageWorkspaceAssets';
import {
  WEB_FONTS_PACKAGE_PREFIX,
  toWebFontPlatformAssetUrl,
} from '../../../shared/lib/platformWebFonts';
import { ensurePackageWorkspaceAssetsDir } from './packageWorkspaceAssets.service';
import { ensureWebFontsAssetsDir, getWebFontsAssetsRootPath } from '../platform/platformWebFonts.service';

function resolvePackageZipPath(packageId: string, version: string): string | null {
  const artifactPath = path.join(packageDirs.artifacts, packageId, `${version}.zip`);
  return fs.existsSync(artifactPath) ? artifactPath : null;
}

export function readPackageZipTextEntry(
  packageId: string,
  version: string,
  entryPath: string,
): string | null {
  const zipPath = resolvePackageZipPath(packageId, version);
  if (!zipPath) return null;
  const zip = new AdmZip(zipPath);
  const normalized = entryPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const entry = zip.getEntries().find((item) => (
    item.entryName.replace(/\\/g, '/').replace(/^\.\//, '') === normalized
  ));
  if (!entry || entry.isDirectory) return null;
  return entry.getData().toString('utf8');
}

function isSafeRelativeAssetPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    return false;
  }
  return !path.isAbsolute(normalized) && !/^[a-zA-Z]:/.test(normalized);
}

/**
 * Copies `assets/workspace/*` entries from an installed package ZIP into the node workspace assets store.
 * Existing files with the same relative path are overwritten (package is source of truth for that path).
 */
export function seedPackageWorkspaceAssetsFromZip(
  packageId: string,
  version: string,
): { seeded: string[]; warnings: string[] } {
  const zipPath = resolvePackageZipPath(packageId, version);
  if (!zipPath) {
    return {
      seeded: [],
      warnings: [`Package artifact not found for ${packageId}@${version}.`],
    };
  }

  const zip = new AdmZip(zipPath);
  const root = ensurePackageWorkspaceAssetsDir();
  const seeded: string[] = [];
  const warnings: string[] = [];
  const prefix = `${PACKAGE_WORKSPACE_ASSETS_PACKAGE_PREFIX}/`;

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const entryName = entry.entryName.replace(/\\/g, '/');
    if (!entryName.startsWith(prefix)) continue;

    const relativePath = entryName.slice(prefix.length).replace(/^\/+/, '');
    if (!isSafeRelativeAssetPath(relativePath)) {
      warnings.push(`Skipped unsafe workspace asset entry "${entryName}".`);
      continue;
    }

    try {
      const absPath = path.resolve(root, relativePath);
      if (!absPath.startsWith(path.resolve(root))) {
        warnings.push(`Skipped out-of-root workspace asset entry "${entryName}".`);
        continue;
      }
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, entry.getData());
      seeded.push(toPackageWorkspaceAssetUrl(relativePath));
    } catch (error) {
      warnings.push(
        `Failed to seed workspace asset "${entryName}": ${(error as Error).message || 'unknown error'}`,
      );
    }
  }

  // Also accept URL-shaped hints in case older packages stored them differently.
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const asUrl = `/${entry.entryName.replace(/\\/g, '/')}`;
    const relativeFromUrl = packageWorkspaceAssetUrlToRelativePath(asUrl);
    if (!relativeFromUrl || seeded.includes(toPackageWorkspaceAssetUrl(relativeFromUrl))) {
      continue;
    }
  }

  return { seeded, warnings };
}

/**
 * Copies `assets/platform/fonts/*` entries from an installed package ZIP into the node font store
 * so packed `/assets/platform/fonts/...` URLs resolve on the target.
 */
export function seedPackagePlatformFontsFromZip(
  packageId: string,
  version: string,
): { seeded: string[]; warnings: string[] } {
  const zipPath = resolvePackageZipPath(packageId, version);
  if (!zipPath) {
    return {
      seeded: [],
      warnings: [`Package artifact not found for ${packageId}@${version}.`],
    };
  }

  const zip = new AdmZip(zipPath);
  const root = ensureWebFontsAssetsDir(getWebFontsAssetsRootPath());
  const seeded: string[] = [];
  const warnings: string[] = [];
  const prefix = `${WEB_FONTS_PACKAGE_PREFIX}/`;

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const entryName = entry.entryName.replace(/\\/g, '/');
    if (!entryName.startsWith(prefix)) continue;

    const relativePath = entryName.slice(prefix.length).replace(/^\/+/, '');
    if (!isSafeRelativeAssetPath(relativePath)) {
      warnings.push(`Skipped unsafe platform font entry "${entryName}".`);
      continue;
    }

    try {
      const absPath = path.resolve(root, relativePath);
      if (!absPath.startsWith(path.resolve(root))) {
        warnings.push(`Skipped out-of-root platform font entry "${entryName}".`);
        continue;
      }
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        if (fs.existsSync(absPath)) {
          const existing = fs.readFileSync(absPath);
          const incoming = entry.getData();
          if (existing.equals(incoming)) {
            seeded.push(toWebFontPlatformAssetUrl(relativePath));
            continue;
          }
          warnings.push(
            `Kept existing platform font "${relativePath}" (package copy differs; existing file was not overwritten).`,
          );
          continue;
        }
        fs.writeFileSync(absPath, entry.getData());
        seeded.push(toWebFontPlatformAssetUrl(relativePath));
    } catch (error) {
      warnings.push(
        `Failed to seed platform font "${entryName}": ${(error as Error).message || 'unknown error'}`,
      );
    }
  }

  return { seeded, warnings };
}
