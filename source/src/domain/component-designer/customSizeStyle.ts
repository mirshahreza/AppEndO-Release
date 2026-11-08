import type { CSSProperties } from 'react';
import type { DesignerNode } from './types';

/**
 * Matches the plain `w-[…]`/`h-[…]` arbitrary-value utility the Style panel's custom
 * Width/Height input writes (see `InspectorVisualStylePanel.tsx`'s `CUSTOM_SIZE_UTILITY_PATTERN`
 * / `applyCustomSize`) — e.g. `w-[320px]`, `h-[50%]`, and HeroUI-promoted `!w-[…]`.
 * Only the base (unprefixed) token is handled; a responsive (`md:`/`lg:`) custom size still
 * writes a real class token for round-trip display purposes, but has no CSS generated for it
 * (a single inline style can't represent multiple breakpoint values at once) — Live/classic
 * paint collapse strips the prefix before this helper runs so the simulated tier still works.
 */
const BASE_CUSTOM_SIZE_PATTERN = /(?:^|\s)!?(w|h)-\[([^\]\s]+)\]/;

/**
 * Bug found: the custom Width/Height number inputs in the Style panel write an arbitrary
 * Tailwind bracket class (`w-[320px]`, `h-[50%]`) straight into `className` — but Tailwind v4's
 * static content scanner can never see a value assembled from user input at runtime, so no CSS
 * rule is ever generated for it and the property visibly does nothing (same root-cause class as
 * the "Columns" bug — see the safelist comment in `src/index.css`). Unlike the fixed/enumerable
 * utilities fixed there, arbitrary user-typed values can't be safelisted (infinite range), so this
 * mirrors `resolveLayoutGridDomStyle`'s approach instead: derive a real inline style from the
 * already-authored className, leaving the (now-inert-but-harmless) class token in place so the
 * Style panel's own read-back parsing keeps working unchanged.
 */
export const resolveCustomSizeDomStyle = (node: DesignerNode): CSSProperties | null => {
  const className = typeof node.props.className === 'string' ? node.props.className : '';
  if (!className) {
    return null;
  }

  const style: CSSProperties = {};
  for (const match of className.matchAll(new RegExp(BASE_CUSTOM_SIZE_PATTERN, 'g'))) {
    const [, prefix, value] = match;
    if (prefix === 'w') {
      style.width = value;
    } else if (prefix === 'h') {
      style.height = value;
    }
  }

  return Object.keys(style).length > 0 ? style : null;
};
