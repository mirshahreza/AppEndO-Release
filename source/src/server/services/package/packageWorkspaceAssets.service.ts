import fs from 'fs';
import path from 'path';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import {
  displayPackageWorkspaceAssetName,
} from '../../../shared/lib/packageWorkspaceAssets';

const ALLOWED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
]);

export type PackageWorkspaceAssetSummary = {
  path: string;
  name: string;
  sizeBytes: number;
  modifiedAt: string;
};

export function getPackageWorkspaceAssetsRootPath(): string {
  return runtimeDirs.workspaceAssets;
}

export function ensurePackageWorkspaceAssetsDir(): string {
  const root = getPackageWorkspaceAssetsRootPath();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function normalizeRelativeAssetPath(input: string): string | null {
  const normalized = input.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    return null;
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  return segments.join('/');
}

function isAllowedAssetFileName(fileName: string): boolean {
  const extension = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension);
}

function collectAssetsRecursive(
  directoryPath: string,
  relativeDirectory: string,
  output: PackageWorkspaceAssetSummary[],
): void {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      collectAssetsRecursive(absolutePath, relativePath, output);
      continue;
    }

    if (!entry.isFile() || !isAllowedAssetFileName(entry.name)) {
      continue;
    }

    const stat = fs.statSync(absolutePath);
    output.push({
      path: relativePath.replace(/\\/g, '/'),
      name: displayPackageWorkspaceAssetName(relativePath),
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }
}

export function listPackageWorkspaceAssets(): PackageWorkspaceAssetSummary[] {
  const root = ensurePackageWorkspaceAssetsDir();
  const assets: PackageWorkspaceAssetSummary[] = [];
  collectAssetsRecursive(root, '', assets);
  return assets.sort((left, right) => left.path.localeCompare(right.path));
}

export function readPackageWorkspaceAsset(
  relativePath: string,
): { ok: true; absPath: string; content: Buffer } | { ok: false; error: string } {
  const normalized = normalizeRelativeAssetPath(relativePath);
  if (!normalized) {
    return { ok: false, error: 'Invalid workspace asset path.' };
  }

  const root = ensurePackageWorkspaceAssetsDir();
  const absPath = path.resolve(root, normalized);
  if (!absPath.startsWith(path.resolve(root))) {
    return { ok: false, error: 'Invalid workspace asset path.' };
  }

  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    return { ok: false, error: 'Workspace asset was not found.' };
  }

  if (!isAllowedAssetFileName(path.basename(absPath))) {
    return { ok: false, error: 'Workspace asset type is not allowed.' };
  }

  return {
    ok: true,
    absPath,
    content: fs.readFileSync(absPath),
  };
}

export function writePackageWorkspaceAsset(
  fileName: string,
  content: Buffer,
): { ok: true; asset: PackageWorkspaceAssetSummary } | { ok: false; error: string } {
  const baseName = path.basename(fileName.trim());
  if (!baseName || baseName !== fileName.trim().replace(/\\/g, '/')) {
    return { ok: false, error: 'Workspace assets must be uploaded as a single file name without folders.' };
  }

  if (!isAllowedAssetFileName(baseName)) {
    return { ok: false, error: 'File type is not allowed for workspace assets.' };
  }

  const root = ensurePackageWorkspaceAssetsDir();
  const absPath = path.join(root, baseName);
  fs.writeFileSync(absPath, content);

  const stat = fs.statSync(absPath);
  return {
    ok: true,
    asset: {
      path: baseName,
      name: displayPackageWorkspaceAssetName(baseName),
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    },
  };
}

export function deletePackageWorkspaceAsset(
  relativePath: string,
): { ok: true } | { ok: false; error: string } {
  const normalized = normalizeRelativeAssetPath(relativePath);
  if (!normalized) {
    return { ok: false, error: 'Invalid workspace asset path.' };
  }

  const root = ensurePackageWorkspaceAssetsDir();
  const absPath = path.resolve(root, normalized);
  if (!absPath.startsWith(path.resolve(root))) {
    return { ok: false, error: 'Invalid workspace asset path.' };
  }

  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    return { ok: false, error: 'Workspace asset was not found.' };
  }

  try {
    fs.unlinkSync(absPath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message || 'Failed to delete workspace asset.' };
  }
}

