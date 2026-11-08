export type ViewportTier = 'phone' | 'tablet' | 'desktop' | 'wide';

export type MinViewport = 'tablet' | 'desktop';

export const VIEWPORT_TIER_MAX_WIDTH = {
  phone: 399,
  tablet: 1023,
  desktop: 1279,
} as const;

export const VIEWPORT_MEDIA_QUERIES = {
  phone: `(max-width: ${VIEWPORT_TIER_MAX_WIDTH.phone}px)`,
  tablet: `(min-width: ${VIEWPORT_TIER_MAX_WIDTH.phone + 1}px) and (max-width: ${VIEWPORT_TIER_MAX_WIDTH.tablet}px)`,
  desktop: `(min-width: ${VIEWPORT_TIER_MAX_WIDTH.tablet + 1}px) and (max-width: ${VIEWPORT_TIER_MAX_WIDTH.desktop}px)`,
  wide: `(min-width: ${VIEWPORT_TIER_MAX_WIDTH.desktop + 1}px)`,
} as const;

export function resolveViewportTier(width: number): ViewportTier {
  if (width <= VIEWPORT_TIER_MAX_WIDTH.phone) {
    return 'phone';
  }
  if (width <= VIEWPORT_TIER_MAX_WIDTH.tablet) {
    return 'tablet';
  }
  if (width <= VIEWPORT_TIER_MAX_WIDTH.desktop) {
    return 'desktop';
  }
  return 'wide';
}

/** Phone + tablet: dialogs, AppEndoo overlay, compact header density. */
export function isCompactChromeTier(tier: ViewportTier): boolean {
  return tier === 'phone' || tier === 'tablet';
}

/** Phone + tablet: hamburger overlay drawer. Hover flyouts need a docked desktop rail. */
export function isOverlayNavTier(tier: ViewportTier): boolean {
  return isCompactChromeTier(tier);
}

export function tierMeetsMinViewport(tier: ViewportTier, minViewport?: MinViewport | null): boolean {
  if (!minViewport) {
    return true;
  }
  if (minViewport === 'tablet') {
    return tier !== 'phone';
  }
  return tier === 'desktop' || tier === 'wide';
}

