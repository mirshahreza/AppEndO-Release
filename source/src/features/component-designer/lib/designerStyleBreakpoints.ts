import { VIEWPORT_TIER_MAX_WIDTH } from '../../../shared/lib/viewportTokens';
import { TAILWIND_INSPECTOR_FIELDS } from '../../../domain/component-designer/inspectorRegistry';
import type { BreakpointPrefix } from '../../../domain/component-designer/tailwindStyleCodec';
import type { DesignerViewportPreset } from '../../../domain/component-designer/types';

/**
 * Style-panel breakpoints (Tailwind mobile-first):
 * - Mobile  → base (no prefix) — applies at all widths as the foundation
 * - Tablet  → md: (768px+)
 * - Desktop → lg: (1024px+)
 *
 * Matches canvas viewport presets. Tablet/desktop prefixes follow Tailwind `md`/`lg`
 * (768 / 1024). JS chrome tiers in `viewportTokens` split phone/tablet at 400px.
 */
export type DesignerStyleBreakpointId = 'mobile' | 'tablet' | 'desktop';

export type DesignerStyleBreakpointOption = {
  id: DesignerStyleBreakpointId;
  label: string;
  prefix: BreakpointPrefix;
  /** Accessible / button name used in tests and aria. */
  name: string;
  title: string;
};

/** Toolbar order: Desktop → Tablet → Mobile (same as canvas viewport controls). */
export const DESIGNER_STYLE_BREAKPOINTS: readonly DesignerStyleBreakpointOption[] = [
  {
    id: 'desktop',
    label: 'Desktop',
    prefix: 'lg:',
    name: 'Desktop',
    title: 'Desktop styles (lg:) — apply from 1024px and up',
  },
  {
    id: 'tablet',
    label: 'Tablet',
    prefix: 'md:',
    name: 'Tablet',
    title: 'Tablet styles (md:) — apply from 768px and up',
  },
  {
    id: 'mobile',
    label: 'Mobile',
    prefix: '',
    name: 'Mobile',
    title: 'Mobile / base styles — apply on every screen unless overridden at tablet or desktop',
  },
] as const;

const PREFIX_BY_ID: Record<DesignerStyleBreakpointId, BreakpointPrefix> = {
  mobile: '',
  tablet: 'md:',
  desktop: 'lg:',
};

const ID_BY_PREFIX: Record<BreakpointPrefix, DesignerStyleBreakpointId> = {
  '': 'mobile',
  'md:': 'tablet',
  'lg:': 'desktop',
};

const TIER_RANK: Record<DesignerStyleBreakpointId, number> = {
  mobile: 0,
  tablet: 1,
  desktop: 2,
};

export function styleBreakpointPrefix(id: DesignerStyleBreakpointId): BreakpointPrefix {
  return PREFIX_BY_ID[id];
}

export function styleBreakpointIdFromPrefix(prefix: BreakpointPrefix): DesignerStyleBreakpointId {
  return ID_BY_PREFIX[prefix];
}

export function styleBreakpointIdFromViewportPreset(
  preset: DesignerViewportPreset | null | undefined,
): DesignerStyleBreakpointId {
  if (preset === 'mobile' || preset === 'tablet' || preset === 'desktop') {
    return preset;
  }
  return 'desktop';
}

export function viewportPresetFromStyleBreakpoint(
  id: DesignerStyleBreakpointId,
): Exclude<DesignerViewportPreset, 'custom'> {
  return id;
}

/** Tailwind `md` starts at 768 — not the JS chrome phone/tablet split (400px). */
const TAILWIND_MD_MIN_PX = 768;

export function styleBreakpointIdFromWidth(width: number): DesignerStyleBreakpointId {
  if (width < TAILWIND_MD_MIN_PX) {
    return 'mobile';
  }
  if (width <= VIEWPORT_TIER_MAX_WIDTH.tablet) {
    return 'tablet';
  }
  return 'desktop';
}

const RESPONSIVE_PREFIX_RE = /^(md:|lg:)(.+)$/;
const STATE_OR_VARIANT_RE = /^(hover|focus|active|disabled|dark|group-hover|group-focus|peer-|before|after|placeholder|file|open|visited|first|last|odd|even|sm|xl|2xl|max-)/;

function splitClassTokens(className: string): string[] {
  return className.trim().split(/\s+/).filter(Boolean);
}

function prefixRank(prefix: BreakpointPrefix | string): number {
  if (prefix === 'lg:') return 2;
  if (prefix === 'md:') return 1;
  return 0;
}

function familyKeyForToken(token: string): string | null {
  for (const field of TAILWIND_INSPECTOR_FIELDS) {
    if (field.conflictPattern.test(token)) {
      return field.key;
    }
  }
  const bare = token.replace(/^(?:md:|lg:)/, '');
  if (bare === 'flex-wrap' || /^(?:[a-z0-9-]+:)?flex-wrap$/.test(token)) {
    return 'flex-wrap';
  }
  return null;
}

type RankedCandidate = {
  rank: number;
  utility: string;
};

/**
 * Collapse `md:` / `lg:` utilities to the effective unprefixed classes for a
 * simulated canvas width. Needed because the designer frame is not an iframe —
 * browser media queries still see the full desktop viewport.
 */
export function collapseResponsiveClassNameForBreakpoint(
  className: string,
  breakpointId: DesignerStyleBreakpointId,
): string {
  const maxRank = TIER_RANK[breakpointId];
  const tokens = splitClassTokens(className);
  if (tokens.length === 0) {
    return '';
  }

  const familyWinners = new Map<string, RankedCandidate>();
  const unknownWinners = new Map<string, RankedCandidate>();
  const passthrough: string[] = [];

  const consider = (
    bucket: Map<string, RankedCandidate>,
    key: string,
    rank: number,
    utility: string,
  ) => {
    if (rank > maxRank) {
      return;
    }
    const existing = bucket.get(key);
    if (!existing || rank >= existing.rank) {
      bucket.set(key, { rank, utility });
    }
  };

  for (const token of tokens) {
    const responsive = RESPONSIVE_PREFIX_RE.exec(token);
    if (responsive) {
      const prefix = responsive[1] as 'md:' | 'lg:';
      const rest = responsive[2] ?? '';
      // Stacked variants like md:hover:bg-red-500 — activate by stripping only the bp prefix.
      const rank = prefixRank(prefix);
      const family = familyKeyForToken(token) ?? familyKeyForToken(rest);
      if (family) {
        consider(familyWinners, family, rank, rest);
      } else {
        consider(unknownWinners, rest, rank, rest);
      }
      continue;
    }

    if (token.includes(':') && STATE_OR_VARIANT_RE.test(token)) {
      passthrough.push(token);
      continue;
    }

    const family = familyKeyForToken(token);
    if (family) {
      consider(familyWinners, family, 0, token);
    } else {
      passthrough.push(token);
    }
  }

  const collapsed = [
    ...passthrough,
    ...Array.from(familyWinners.values()).map((entry) => entry.utility),
    ...Array.from(unknownWinners.values()).map((entry) => entry.utility),
  ];

  return collapsed.join(' ');
}

export function collapseResponsiveClassNameForWidth(
  className: string,
  width: number,
): string {
  return collapseResponsiveClassNameForBreakpoint(className, styleBreakpointIdFromWidth(width));
}
