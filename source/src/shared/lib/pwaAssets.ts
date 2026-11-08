/** Disk folder segment under `workspace/platform/pwa/`. */
export const PWA_PLATFORM_ASSETS_RUNTIME_SEGMENT = 'platform/pwa';

/** Public URL prefix for uploaded PWA icons. */
export const PWA_PLATFORM_ASSETS_URL_PREFIX = '/assets/platform/pwa';

export type PwaIconSlot = '32' | '192' | '512' | 'maskable';

const normalizeRelativePath = (value: string): string =>
  value.trim().replace(/\\/g, '/').replace(/^\/+/, '');

export function toPwaPlatformAssetUrl(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  return normalized
    ? `${PWA_PLATFORM_ASSETS_URL_PREFIX}/${normalized}`
    : PWA_PLATFORM_ASSETS_URL_PREFIX;
}

export function isPwaPlatformAssetUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === PWA_PLATFORM_ASSETS_URL_PREFIX
    || trimmed.startsWith(`${PWA_PLATFORM_ASSETS_URL_PREFIX}/`);
}

export function pwaPlatformAssetUrlToRelativePath(value: string): string | null {
  const trimmed = value.trim();
  if (!isPwaPlatformAssetUrl(trimmed)) {
    return null;
  }

  if (trimmed === PWA_PLATFORM_ASSETS_URL_PREFIX) {
    return '';
  }

  return normalizeRelativePath(trimmed.slice(PWA_PLATFORM_ASSETS_URL_PREFIX.length + 1));
}
