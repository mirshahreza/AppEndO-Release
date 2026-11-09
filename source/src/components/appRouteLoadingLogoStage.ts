import { APPENDO_BRAND_WORDMARK_ASPECT } from '../config/appendoBrandAssets';

/** AppEnd wordmark aspect (mask SVG). */
export const APPENDO_LOADING_LOGO_ASPECT = APPENDO_BRAND_WORDMARK_ASPECT;

export type LoadingLogoStageShape = 'appendo' | 'square' | 'wide';

export function classifyLoadingLogoShape(logoSrc: string | undefined): LoadingLogoStageShape {
  if (!logoSrc?.trim()) {
    return 'wide';
  }
  const path = logoSrc.split('?')[0].toLowerCase();
  if (path.includes('/mark-blue') || path.includes('/mark-white')) {
    return 'square';
  }
  if (path.includes('/assets/hawiety/') && path.includes('/mark-')) {
    return 'square';
  }
  if (path.includes('/assets/appendo/brand/') && path.includes('mark')) {
    return 'square';
  }
  return 'wide';
}

export function loadingLogoStageClassName(
  shape: LoadingLogoStageShape,
  prefix: 'app-route-loading' | 'app-boot' = 'app-route-loading',
): string {
  const base = prefix === 'app-boot' ? 'app-boot-logo-stage' : 'app-route-loading__logo-stage';
  return `${base} ${base}--${shape}`;
}
