/** Built-in AppEndO brand SVGs served from `public/assets/appendo/brand/`. */

export const APPENDO_BRAND_ASSET_ROOT = '/assets/appendo/brand';

/** Mask-friendly wordmark for accent-gradient shell chrome (sidebar, loading). */
export const APPENDO_BRAND_WORDMARK_MASK_URL =
  `${APPENDO_BRAND_ASSET_ROOT}/transparent/appendo-wordmark-currentColor.svg`;

/** Mask-friendly mark for compact chrome and collapsed sidebar rail. */
export const APPENDO_BRAND_MARK_MASK_URL =
  `${APPENDO_BRAND_ASSET_ROOT}/transparent/appendo-mark-currentColor.svg`;

/** Neutral lockup for `<img>` surfaces (portal preview, exports). */
export const APPENDO_BRAND_WORDMARK_URL = `${APPENDO_BRAND_ASSET_ROOT}/appendo-wordmark.svg`;

/** Icon-only mark for `<img>` surfaces. */
export const APPENDO_BRAND_MARK_URL = `${APPENDO_BRAND_ASSET_ROOT}/appendo-icon-mark.svg`;

export const APPENDO_LOGO_SRC = APPENDO_BRAND_WORDMARK_MASK_URL;
export const APPENDO_LOGO_ONLY_SRC = APPENDO_BRAND_MARK_MASK_URL;

/** viewBox width / height for `appendo-wordmark-currentColor.svg`. */
export const APPENDO_BRAND_WORDMARK_ASPECT = 1350.33 / 443.31;

/** `appendo-mark-currentColor.svg` viewBox is square. */
export const APPENDO_BRAND_MARK_ASPECT = 1;

const BUILTIN_APPENDO_BRAND_URLS = new Set<string>([
  APPENDO_BRAND_WORDMARK_MASK_URL,
  APPENDO_BRAND_MARK_MASK_URL,
  APPENDO_BRAND_WORDMARK_URL,
  APPENDO_BRAND_MARK_URL,
]);

export function isBuiltinAppEndBrandLogoUrl(src: string): boolean {
  const pathOnly = src.trim().split('?')[0] ?? '';
  if (BUILTIN_APPENDO_BRAND_URLS.has(pathOnly)) {
    return true;
  }
  return pathOnly.startsWith(`${APPENDO_BRAND_ASSET_ROOT}/`);
}

export function isDefaultAppEndBrandLogoUrl(src: string | undefined): boolean {
  const pathOnly = src?.trim().split('?')[0] ?? '';
  return (
    pathOnly === APPENDO_LOGO_SRC ||
    pathOnly === APPENDO_LOGO_ONLY_SRC ||
    pathOnly === APPENDO_BRAND_WORDMARK_URL
  );
}
