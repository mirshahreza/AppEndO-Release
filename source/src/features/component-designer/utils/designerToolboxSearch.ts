import type { DesignerPaletteItem } from '../../../domain/component-designer/types';
import {
  DESIGNER_TOOLBOX_GROUP_LABELS,
  resolveToolboxGroup,
} from './designerToolboxGroups';

/**
 * Phase 11 — Toolbox search: category (phase-8 group) in match domain,
 * lightweight fuzzy (substring + non-consecutive subsequence), and
 * ranking (label > id / sourceRef / category).
 *
 * Exact substring matches remain a strict subset of fuzzy matches (Self-Audit).
 */

export type ToolboxSearchableItem = Pick<DesignerPaletteItem, 'id' | 'label' | 'category'> & {
  sourceRef?: string | null;
};

/** Field priority: exact/stronger match on label outranks any match on lower fields. */
const FIELD_WEIGHT = {
  label: 1_000,
  id: 100,
  sourceRef: 100,
  category: 50,
} as const;

type SearchField = keyof typeof FIELD_WEIGHT;

const QUALITY = {
  exact: 40,
  prefix: 30,
  substring: 20,
  subsequence: 10,
} as const;

const isSubsequenceMatch = (haystack: string, needle: string): boolean => {
  let needleIndex = 0;
  for (let i = 0; i < haystack.length && needleIndex < needle.length; i += 1) {
    if (haystack[i] === needle[needleIndex]) {
      needleIndex += 1;
    }
  }
  return needleIndex === needle.length;
};

const scoreHaystack = (haystackRaw: string, needle: string): number | null => {
  const haystack = haystackRaw.trim().toLowerCase();
  if (!haystack || !needle) {
    return null;
  }
  if (haystack === needle) {
    return QUALITY.exact;
  }
  if (haystack.startsWith(needle)) {
    return QUALITY.prefix;
  }
  if (haystack.includes(needle)) {
    return QUALITY.substring;
  }
  if (isSubsequenceMatch(haystack, needle)) {
    return QUALITY.subsequence;
  }
  return null;
};

const categorySearchText = (item: ToolboxSearchableItem): string => {
  const group = resolveToolboxGroup(item);
  const label = DESIGNER_TOOLBOX_GROUP_LABELS[group];
  // Phase 8 group id + human label only (spec: category = new group label).
  return `${group} ${label}`;
};

/**
 * Best score for one item against a normalized (trimmed, lowercased) needle.
 * Returns null when nothing matches.
 */
export const scoreToolboxPaletteItem = (
  item: ToolboxSearchableItem,
  normalizedNeedle: string,
): number | null => {
  if (!normalizedNeedle) {
    return 0;
  }

  const fields: Array<{ field: SearchField; text: string }> = [
    { field: 'label', text: item.label },
    { field: 'id', text: item.id },
    {
      field: 'sourceRef',
      text: typeof item.sourceRef === 'string' ? item.sourceRef : '',
    },
    { field: 'category', text: categorySearchText(item) },
  ];

  let best: number | null = null;
  for (const { field, text } of fields) {
    const quality = scoreHaystack(text, normalizedNeedle);
    if (quality == null) {
      continue;
    }
    const score = FIELD_WEIGHT[field] + quality;
    if (best == null || score > best) {
      best = score;
    }
  }
  return best;
};

/**
 * Filter + rank palette items for Toolbox search.
 * Empty / whitespace query returns items unchanged (caller typically passes all draggable items).
 */
export const filterAndRankToolboxPalette = <T extends ToolboxSearchableItem>(
  items: readonly T[],
  query: string,
): T[] => {
  const normalizedNeedle = query.trim().toLowerCase();
  if (!normalizedNeedle) {
    return [...items];
  }

  const scored: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    const score = scoreToolboxPaletteItem(item, normalizedNeedle);
    if (score != null && score > 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Stable-ish tie-break: label then id (presentation only; does not change match set).
    const byLabel = a.item.label.localeCompare(b.item.label);
    if (byLabel !== 0) {
      return byLabel;
    }
    return a.item.id.localeCompare(b.item.id);
  });

  return scored.map((row) => row.item);
};
