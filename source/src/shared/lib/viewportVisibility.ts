import type { ViewportTier } from './viewportTokens';
import { isCompactChromeTier } from './viewportTokens';

/**
 * Declarative visibility for shared toolbar / filter / chrome controls.
 * Prefer this over page-level `hidden lg:flex` when a component knows its own compact affordance.
 */
export type ComponentViewportVisibility =
  | 'always'
  /** Hidden on phone (≤399px). */
  | 'hide-phone'
  /** Hidden on phone and tablet (compact chrome). Visible from desktop (≥1024). */
  | 'hide-compact'
  /** Visible only on wide tier (≥1280). */
  | 'wide-only';

export function isComponentVisibleAtTier(
  visibility: ComponentViewportVisibility,
  tier: ViewportTier,
): boolean {
  switch (visibility) {
    case 'always':
      return true;
    case 'hide-phone':
      return tier !== 'phone';
    case 'hide-compact':
      return !isCompactChromeTier(tier);
    case 'wide-only':
      return tier === 'wide';
    default:
      return true;
  }
}
