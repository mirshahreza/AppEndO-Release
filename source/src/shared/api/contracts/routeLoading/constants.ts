import type { PlatformRouteLoadingConfig, RouteLoadingLogoSize } from './schema';

export const DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG: PlatformRouteLoadingConfig = {
  version: 1,
  showLogo: true,
  logoSize: 'default',
  logoGlow: true,
  logoBreathe: true,
  stackOrder: 'logo-first',
  progressStyle: 'ecg',
  stackGapRem: undefined,
  embedded: {
    logoSize: 'compact',
    stackGapRem: 0.75,
  },
};

export const ROUTE_LOADING_LOGO_SIZE_SCALE: Record<RouteLoadingLogoSize, number> = {
  compact: 0.85,
  default: 1,
  large: 1.15,
  xlarge: 1.35,
};
