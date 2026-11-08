import type { ViewportTier } from './viewportTokens';
import type { GridCardActionsPlacement } from './gridRowActions';
import type { GridCompactLayout } from './gridCompactViewport';

export type GridPresentationMode = 'table' | 'cards' | 'table-scroll' | 'auto';

export type GridEffectivePresentation = 'table' | 'cards' | 'table-scroll';

/**
 * Smallest viewport at which card layout starts (when presentation is `auto`).
 * `phone` = phone only; `tablet` = phone+tablet; `desktop` = every size including wide.
 */
export type GridCardBelowTier = 'phone' | 'tablet' | 'desktop';

export type { GridCardActionsPlacement };

export const DEFAULT_GRID_CARD_BELOW: GridCardBelowTier = 'tablet';

export function sanitizeGridCardBelow(value: unknown): GridCardBelowTier {
  if (value === 'phone' || value === 'tablet' || value === 'desktop') {
    return value;
  }
  return DEFAULT_GRID_CARD_BELOW;
}

export function tierUsesCardLayout(tier: ViewportTier, cardBelow: GridCardBelowTier): boolean {
  if (cardBelow === 'desktop') {
    return true;
  }
  if (cardBelow === 'tablet') {
    return tier === 'phone' || tier === 'tablet';
  }
  return tier === 'phone';
}

/**
 * Whether the tablet viewport renders card layout (for showing tablet cards-per-row).
 * Matches `resolveGridCompactViewport` when tier is `tablet`.
 */
export function gridTabletTierUsesCardGrid(input: {
  presentation?: GridPresentationMode;
  cardBelow?: GridCardBelowTier;
  compactTabletLayout?: GridCompactLayout | 'inherit' | null;
}): boolean {
  const presentation = input.presentation ?? 'auto';
  const cardBelow = input.cardBelow ?? DEFAULT_GRID_CARD_BELOW;
  const tabletLayout = input.compactTabletLayout;

  if (tabletLayout === 'keep-table' || tabletLayout === 'table-scroll') {
    return false;
  }
  if (tabletLayout === 'cards') {
    return true;
  }
  if (presentation === 'cards') {
    return true;
  }
  if (presentation === 'table' || presentation === 'table-scroll') {
    return false;
  }
  return tierUsesCardLayout('tablet', cardBelow);
}

export function resolveGridEffectivePresentation(
  presentation: GridPresentationMode,
  viewportTier: ViewportTier,
  cardBelow: GridCardBelowTier = DEFAULT_GRID_CARD_BELOW,
): GridEffectivePresentation {
  if (presentation === 'table') {
    return 'table';
  }
  if (presentation === 'cards') {
    return 'cards';
  }
  if (presentation === 'table-scroll') {
    return 'table-scroll';
  }

  if (tierUsesCardLayout(viewportTier, cardBelow)) {
    return 'cards';
  }
  if (viewportTier === 'tablet') {
    return 'table-scroll';
  }
  return 'table';
}

/** True when any configured path can render cards (presentation or compact layout). */
export function appTableGridUsesCardPresentation(input: {
  presentation?: GridPresentationMode;
  compactPhoneLayout?: GridCompactLayout | 'inherit';
  compactTabletLayout?: GridCompactLayout | 'inherit';
}): boolean {
  const presentation = input.presentation ?? 'auto';
  if (presentation === 'cards' || presentation === 'auto') {
    return true;
  }
  return input.compactPhoneLayout === 'cards' || input.compactTabletLayout === 'cards';
}
