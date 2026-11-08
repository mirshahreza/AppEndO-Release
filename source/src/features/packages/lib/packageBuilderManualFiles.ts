import {
  displayPackageWorkspaceAssetName,
  toPackageWorkspaceAssetEntry,
} from '../../../shared/lib/packageWorkspaceAssets';

export type PackageBuilderManualFile = {
  id: string;
  workspacePath: string;
  fileName: string;
  entryPath: string;
};

export function createPackageBuilderManualFile(
  workspacePath: string,
  existing: readonly PackageBuilderManualFile[],
): PackageBuilderManualFile | null {
  const normalizedPath = workspacePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalizedPath || normalizedPath.includes('..')) {
    return null;
  }

  if (existing.some((item) => item.workspacePath === normalizedPath)) {
    return null;
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    workspacePath: normalizedPath,
    fileName: displayPackageWorkspaceAssetName(normalizedPath),
    entryPath: toPackageWorkspaceAssetEntry(normalizedPath),
  };
}

export function createPackageBuilderManualFiles(
  workspacePaths: readonly string[],
  existing: readonly PackageBuilderManualFile[],
): PackageBuilderManualFile[] {
  const additions: PackageBuilderManualFile[] = [];
  const seen = new Set(existing.map((item) => item.workspacePath));

  for (const workspacePath of workspacePaths) {
    const normalizedPath = workspacePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalizedPath || normalizedPath.includes('..') || seen.has(normalizedPath)) {
      continue;
    }

    seen.add(normalizedPath);
    const created = createPackageBuilderManualFile(normalizedPath, [...existing, ...additions]);
    if (created) {
      additions.push(created);
    }
  }

  return additions;
}
