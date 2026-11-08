import fs from 'fs';
import path from 'path';
import { isVerticalAppManifest } from '../../../core/packages/PackageManifestValidator';
import { parseManifestFile } from '../../domain/package-domain/manifestRepository';
import { readPackageIndex } from '../../../core/packages/PackageFileStore';
import {
  getEnabledInstalledVersionsMap,
  getInstalledVersionsMap,
} from '../../domain/package-domain/installStateRepository';
import {
  isSafeRelativeEntry,
  resolveRuntimeEntryPath,
} from './packageUiRuntime.service';

export type StaticAssetResolveResult =
  | { ok: true; absPath: string; contentType: string; isPublic: boolean }
  | { ok: false; error: string; statusCode: number; requiresAuth?: boolean };

const ASSET_CONTENT_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function resolveInstalledVersion(packageId: string): string | null {
  const installedMap = getInstalledVersionsMap();
  return installedMap.get(packageId) ?? null;
}

function resolveManifestForInstalledVersion(packageId: string, version: string) {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.manifestPath) return null;
  return parseManifestFile(versionEntry.manifestPath);
}

function resolveContentType(absPath: string, mime?: string): string {
  if (typeof mime === 'string' && mime.trim()) {
    return mime.trim();
  }
  const ext = path.extname(absPath).toLowerCase();
  return ASSET_CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

export function resolvePackageStaticAsset(
  packageId: string,
  assetKey: string,
): StaticAssetResolveResult {
  const normalizedPluginId = packageId.trim();
  const normalizedAssetKey = assetKey.trim();
  if (!normalizedPluginId || !normalizedAssetKey) {
    return { ok: false, error: 'Package id and asset key are required.', statusCode: 400 };
  }

  const version = resolveInstalledVersion(normalizedPluginId);
  if (!version) {
    return { ok: false, error: `Package "${normalizedPluginId}" is not installed.`, statusCode: 404 };
  }

  const enabledMap = getEnabledInstalledVersionsMap();
  if (!enabledMap.has(normalizedPluginId)) {
    return { ok: false, error: `Package "${normalizedPluginId}" is disabled.`, statusCode: 404 };
  }

  const manifest = resolveManifestForInstalledVersion(normalizedPluginId, version);
  if (!manifest || !isVerticalAppManifest(manifest)) {
    return {
      ok: false,
      error: `Package "${normalizedPluginId}" does not expose static assets.`,
      statusCode: 404,
    };
  }

  const asset = (manifest.capabilities.static_assets ?? []).find((item) => item.assetKey === normalizedAssetKey);
  if (!asset) {
    return {
      ok: false,
      error: `Static asset "${normalizedAssetKey}" is not registered for package "${normalizedPluginId}".`,
      statusCode: 404,
    };
  }

  if (!isSafeRelativeEntry(asset.path)) {
    return {
      ok: false,
      error: `Static asset "${normalizedAssetKey}" has an unsafe path.`,
      statusCode: 400,
    };
  }

  const absPath = resolveRuntimeEntryPath(normalizedPluginId, version, asset.path);
  if (!absPath || !fs.existsSync(absPath)) {
    return {
      ok: false,
      error: `Static asset "${normalizedAssetKey}" is not available on disk.`,
      statusCode: 404,
    };
  }

  return {
    ok: true,
    absPath,
    contentType: resolveContentType(absPath, asset.mime),
    isPublic: asset.public === true,
  };
}

export function buildPackageStaticAssetUrl(packageId: string, assetKey: string): string {
  return `/api/packages/${encodeURIComponent(packageId)}/assets/${encodeURIComponent(assetKey)}`;
}
