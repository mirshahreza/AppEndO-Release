/** Runtime folder segment under `workspace/`. */
export const PACKAGE_WORKSPACE_ASSETS_RUNTIME_SEGMENT = 'assets';

/** Public URL prefix for component and package references. */
export const PACKAGE_WORKSPACE_ASSETS_URL_PREFIX = '/assets/workspace';

/** Zip entry prefix inside package artifacts. */
export const PACKAGE_WORKSPACE_ASSETS_PACKAGE_PREFIX = 'assets/workspace';

const normalizeWorkspaceRelativePath = (value: string): string =>
  value.trim().replace(/\\/g, '/').replace(/^\/+/, '');

export function toPackageWorkspaceAssetUrl(relativePath: string): string {
  const normalized = normalizeWorkspaceRelativePath(relativePath);
  return normalized
    ? `${PACKAGE_WORKSPACE_ASSETS_URL_PREFIX}/${normalized}`
    : PACKAGE_WORKSPACE_ASSETS_URL_PREFIX;
}

export function toPackageWorkspaceAssetEntry(relativePath: string): string {
  const normalized = normalizeWorkspaceRelativePath(relativePath);
  return normalized
    ? `${PACKAGE_WORKSPACE_ASSETS_PACKAGE_PREFIX}/${normalized}`
    : PACKAGE_WORKSPACE_ASSETS_PACKAGE_PREFIX;
}

export function isPackageWorkspaceAssetUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === PACKAGE_WORKSPACE_ASSETS_URL_PREFIX
    || trimmed.startsWith(`${PACKAGE_WORKSPACE_ASSETS_URL_PREFIX}/`);
}

export function packageWorkspaceAssetUrlToRelativePath(value: string): string | null {
  const trimmed = value.trim();
  if (!isPackageWorkspaceAssetUrl(trimmed)) {
    return null;
  }

  if (trimmed === PACKAGE_WORKSPACE_ASSETS_URL_PREFIX) {
    return '';
  }

  return normalizeWorkspaceRelativePath(trimmed.slice(PACKAGE_WORKSPACE_ASSETS_URL_PREFIX.length + 1));
}

export function displayPackageWorkspaceAssetName(relativePath: string): string {
  const normalized = normalizeWorkspaceRelativePath(relativePath);
  if (!normalized) {
    return '—';
  }

  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
}
