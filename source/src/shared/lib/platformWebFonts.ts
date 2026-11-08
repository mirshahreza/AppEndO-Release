import type { WebFontScript } from '../api/contracts/platform/webFonts';

/** Disk folder segment under `workspace/platform/fonts/`. */
export const WEB_FONTS_PLATFORM_ASSETS_RUNTIME_SEGMENT = 'platform/fonts';

/** Public URL prefix for uploaded web fonts. */
export const WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX = '/assets/platform/fonts';

/** Zip entry prefix inside package artifacts. */
export const WEB_FONTS_PACKAGE_PREFIX = 'assets/platform/fonts';

const normalizeRelativePath = (value: string): string =>
  value.trim().replace(/\\/g, '/').replace(/^\/+/, '');

export function toWebFontPackageEntry(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  return normalized
    ? `${WEB_FONTS_PACKAGE_PREFIX}/${normalized}`
    : WEB_FONTS_PACKAGE_PREFIX;
}

export function toWebFontPlatformAssetUrl(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  return normalized
    ? `${WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX}/${normalized}`
    : WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX;
}

export function isWebFontPlatformAssetUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX
    || trimmed.startsWith(`${WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX}/`);
}

export function webFontPlatformAssetUrlToRelativePath(value: string): string | null {
  const trimmed = value.trim();
  if (!isWebFontPlatformAssetUrl(trimmed)) {
    return null;
  }

  if (trimmed === WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX) {
    return '';
  }

  return normalizeRelativePath(trimmed.slice(WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX.length + 1));
}

export function resolveWebFontScriptForBundle(translationBundleId: string): WebFontScript {
  switch (translationBundleId.trim()) {
    case 'ir':
      return 'fa';
    case 'iq':
      return 'ar';
    default:
      return 'en';
  }
}
