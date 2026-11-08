import type { CSSProperties } from 'react';
import type {
  DashboardWidgetId,
  DashboardWidgetSize,
  DashboardWidgetSizes,
} from '../../shared/lib/userDashboardLayout';
import {
  DASHBOARD_LAYOUT_COLUMNS,
  resolveDashboardSpanUnits,
  resolveDashboardWidgetStart,
} from './dashboardWidgetLayoutSpan';

/** Matches Tailwind `gap-4` (1rem @ 16px root). */
export const DASHBOARD_MASONRY_GAP_PX = 16;

export type DashboardMasonryPlacement = {
  id: DashboardWidgetId;
  start: number;
  span: number;
  top: number;
};

export type DashboardMasonryLayoutResult = {
  placements: DashboardMasonryPlacement[];
  totalHeight: number;
};

const resolveHeight = (
  heights: Partial<Record<DashboardWidgetId, number>>,
  id: DashboardWidgetId,
): number => Math.max(0, heights[id] ?? 0);

const columnSliceMax = (heights: number[], start: number, span: number): number => {
  let max = 0;
  for (let index = start; index < start + span; index += 1) {
    const value = heights[index] ?? 0;
    if (value > max) {
      max = value;
    }
  }
  return max;
};

/**
 * Packs dashboard widgets on a 12-track skyline so wide, half, narrow,
 * and compact tiles can sit on the same band instead of a fixed 50/50 split.
 */
export const computeDashboardMasonryPlacements = (
  widgetOrder: DashboardWidgetId[],
  heights: Partial<Record<DashboardWidgetId, number>>,
  gap: number,
  multiColumn: boolean,
  sizes?: DashboardWidgetSizes,
  fallbackSpanById?: Partial<Record<string, number>>,
): DashboardMasonryLayoutResult => {
  const columns = multiColumn ? DASHBOARD_LAYOUT_COLUMNS : 1;

  if (columns <= 1) {
    let y = 0;
    const placements: DashboardMasonryPlacement[] = [];

    for (const id of widgetOrder) {
      placements.push({ id, start: 0, span: 1, top: y });
      const height = resolveHeight(heights, id);
      if (height > 0) {
        y += height + gap;
      }
    }

    return {
      placements,
      totalHeight: y > 0 ? y - gap : 0,
    };
  }

  const colHeights = Array.from({ length: columns }, () => 0);
  const placements: DashboardMasonryPlacement[] = [];

  for (const id of widgetOrder) {
    const span = Math.min(resolveDashboardSpanUnits(id, sizes, fallbackSpanById?.[id]), columns);
    const height = resolveHeight(heights, id);
    const preferredStart = resolveDashboardWidgetStart(id, sizes, span);
    let bestStart = preferredStart ?? 0;
    let bestTop = preferredStart == null
      ? Number.POSITIVE_INFINITY
      : columnSliceMax(colHeights, bestStart, span);

    if (preferredStart == null) {
      for (let start = 0; start <= columns - span; start += 1) {
        const top = columnSliceMax(colHeights, start, span);
        if (top < bestTop) {
          bestTop = top;
          bestStart = start;
        }
      }
    }

    placements.push({ id, start: bestStart, span, top: bestTop });
    const nextY = bestTop + height + gap;
    for (let column = bestStart; column < bestStart + span; column += 1) {
      colHeights[column] = nextY;
    }
  }

  const totalHeight = Math.max(0, ...colHeights);
  return {
    placements,
    totalHeight: totalHeight > 0 ? totalHeight - gap : 0,
  };
};

/**
 * Uniform Home: GridStack gravity (`float: false`).
 * Keep the column, then slide the tile up into the first hole that fits.
 * Masonry may still pick a different column (first-fit).
 */
export const computeDashboardUniformPlacements = (
  widgetOrder: DashboardWidgetId[],
  heights: Partial<Record<DashboardWidgetId, number>>,
  gap: number,
  multiColumn: boolean,
  sizes?: DashboardWidgetSizes,
  fallbackSpanById?: Partial<Record<string, number>>,
): DashboardMasonryLayoutResult => {
  if (!multiColumn) {
    return computeDashboardMasonryPlacements(widgetOrder, heights, gap, false, sizes, fallbackSpanById);
  }

  const columns = DASHBOARD_LAYOUT_COLUMNS;
  const colHeights = Array.from({ length: columns }, () => 0);
  const placements: DashboardMasonryPlacement[] = [];
  let cursor = 0;

  for (const id of widgetOrder) {
    const span = Math.min(resolveDashboardSpanUnits(id, sizes, fallbackSpanById?.[id]), columns);
    const height = resolveHeight(heights, id);
    const preferredStart = resolveDashboardWidgetStart(id, sizes, span);
    let start = preferredStart ?? cursor;

    if (preferredStart == null && cursor + span > columns) {
      start = 0;
    }

    const top = columnSliceMax(colHeights, start, span);
    placements.push({ id, start, span, top });
    const nextY = top + height + gap;
    for (let column = start; column < start + span; column += 1) {
      colHeights[column] = nextY;
    }
    cursor = start + span;
    if (cursor >= columns) {
      cursor = 0;
    }
  }

  const totalHeight = Math.max(0, ...colHeights);
  return {
    placements,
    totalHeight: totalHeight > 0 ? totalHeight - gap : 0,
  };
};

export const computeDashboardPackedLayout = (
  widgetOrder: DashboardWidgetId[],
  heights: Partial<Record<DashboardWidgetId, number>>,
  gap: number,
  multiColumn: boolean,
  sizes?: DashboardWidgetSizes,
  fallbackSpanById?: Partial<Record<string, number>>,
): DashboardMasonryLayoutResult =>
  computeDashboardMasonryPlacements(widgetOrder, heights, gap, multiColumn, sizes, fallbackSpanById);

export const resolveDashboardMasonryItemStyle = (
  start: number,
  span: number,
  top: number,
  gap: number,
  columns: number = DASHBOARD_LAYOUT_COLUMNS,
): CSSProperties => {
  if (columns <= 1 || span >= columns) {
    return {
      top,
      insetInlineStart: 0,
      width: '100%',
    };
  }

  const innerGaps = columns - 1;
  const track = `(100% - ${innerGaps * gap}px) / ${columns}`;

  return {
    top,
    insetInlineStart: `calc(${start} * (${track} + ${gap}px))`,
    width: `calc(${span} * ${track} + ${(span - 1) * gap}px)`,
  };
};

/** Stay on the current column until the overlay crosses ~30% into the next track. */
export const DASHBOARD_GRID_SNAP_HYSTERESIS = 0.3;

export const resolveDashboardGridStart = (
  overlay: { left: number; width: number },
  container: { left: number; width: number },
  span: number,
  rtl = false,
  gap: number = DASHBOARD_MASONRY_GAP_PX,
  columns: number = DASHBOARD_LAYOUT_COLUMNS,
  lastStart?: number | null,
): number => {
  const safeSpan = Math.min(columns, Math.max(1, span));
  const innerGaps = columns - 1;
  const track = (container.width - innerGaps * gap) / columns;
  const pitch = track + gap;
  if (!Number.isFinite(pitch) || pitch <= 0) {
    return 0;
  }

  const containerRight = container.left + container.width;
  const overlayRight = overlay.left + overlay.width;
  const inlineOffset = rtl
    ? containerRight - overlayRight
    : overlay.left - container.left;
  const fraction = inlineOffset / pitch;
  const raw = Math.round(fraction);
  const next = Math.min(columns - safeSpan, Math.max(0, raw));

  if (lastStart != null && lastStart !== next) {
    const low = lastStart - 0.5 - DASHBOARD_GRID_SNAP_HYSTERESIS;
    const high = lastStart + 0.5 + DASHBOARD_GRID_SNAP_HYSTERESIS;
    if (fraction > low && fraction < high) {
      return Math.min(columns - safeSpan, Math.max(0, lastStart));
    }
  }

  return next;
};

export const computeDashboardDropPreview = (
  widgetOrder: DashboardWidgetId[],
  heights: Partial<Record<DashboardWidgetId, number>>,
  gap: number,
  multiColumn: boolean,
  sizes: DashboardWidgetSizes | undefined,
  draggedId: DashboardWidgetId,
  dropStart: number,
  span: number,
): DashboardMasonryPlacement => {
  const remaining = widgetOrder.filter((id) => id !== draggedId);
  const packed = computeDashboardMasonryPlacements(
    remaining,
    heights,
    gap,
    multiColumn,
    sizes,
  );
  const columns = multiColumn ? DASHBOARD_LAYOUT_COLUMNS : 1;
  const safeSpan = Math.min(span, columns);
  const safeStart = Math.min(columns - safeSpan, Math.max(0, dropStart));

  if (columns <= 1) {
    const last = packed.placements[packed.placements.length - 1];
    const lastHeight = last ? resolveHeight(heights, last.id) : 0;
    const top = last ? last.top + lastHeight + gap : 0;
    return { id: draggedId, start: 0, span: 1, top };
  }

  const colHeights = Array.from({ length: columns }, () => 0);
  for (const placement of packed.placements) {
    const bottom = placement.top + resolveHeight(heights, placement.id) + gap;
    for (let column = placement.start; column < placement.start + placement.span; column += 1) {
      colHeights[column] = Math.max(colHeights[column], bottom);
    }
  }

  return {
    id: draggedId,
    start: safeStart,
    span: safeSpan,
    top: columnSliceMax(colHeights, safeStart, safeSpan),
  };
};

export const pinDashboardWidgetStarts = (
  sizes: DashboardWidgetSizes,
  placements: DashboardMasonryPlacement[],
): DashboardWidgetSizes => {
  const next: DashboardWidgetSizes = { ...sizes };
  for (const placement of placements) {
    const current: DashboardWidgetSize = { ...next[placement.id] };
    current.start = placement.start;
    next[placement.id] = current;
  }
  return next;
};

export const pinDashboardWidgetLayout = (
  sizes: DashboardWidgetSizes,
  placements: DashboardMasonryPlacement[],
): DashboardWidgetSizes => {
  const next = pinDashboardWidgetStarts(sizes, placements);
  for (const placement of placements) {
    next[placement.id] = {
      ...next[placement.id],
      span: placement.span,
      start: placement.start,
    };
  }
  return next;
};

export const resolveDashboardOrderFromPlacements = (
  placements: readonly DashboardMasonryPlacement[],
  fallbackOrder: readonly DashboardWidgetId[],
): DashboardWidgetId[] => {
  const seen = new Set<DashboardWidgetId>();
  const ordered = [...placements]
    .sort((left, right) => {
      if (left.top !== right.top) {
        return left.top - right.top;
      }
      if (left.start !== right.start) {
        return left.start - right.start;
      }
      return fallbackOrder.indexOf(left.id) - fallbackOrder.indexOf(right.id);
    })
    .map((placement) => placement.id)
    .filter((id) => {
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });

  for (const id of fallbackOrder) {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  }

  return ordered;
};

export const resolveDashboardOrderAfterDrop = (
  order: readonly DashboardWidgetId[],
  placements: readonly DashboardMasonryPlacement[],
  draggedId: DashboardWidgetId,
  dropStart: number,
  dropTop: number,
): DashboardWidgetId[] => {
  const byId = new Map(placements.map((placement) => [placement.id, placement]));
  const scored = order.map((id) => {
    if (id === draggedId) {
      return { id, start: dropStart, top: dropTop };
    }
    const placement = byId.get(id);
    return { id, start: placement?.start ?? 0, top: placement?.top ?? 0 };
  });

  scored.sort((left, right) => {
    if (left.top !== right.top) {
      return left.top - right.top;
    }
    if (left.start !== right.start) {
      return left.start - right.start;
    }
    return order.indexOf(left.id) - order.indexOf(right.id);
  });

  return scored.map((item) => item.id);
};

/**
 * Gridstack / RGL live compact: other tiles reflow around the drop cell
 * while the dragged tile is still following the pointer.
 */
export const computeDashboardLiveLayout = (
  order: DashboardWidgetId[],
  committedPlacements: DashboardMasonryPlacement[],
  heights: Partial<Record<DashboardWidgetId, number>>,
  gap: number,
  multiColumn: boolean,
  sizes: DashboardWidgetSizes | undefined,
  draggedId: DashboardWidgetId,
  dropStart: number,
  dropTop: number,
  fallbackSpanById?: Partial<Record<string, number>>,
): DashboardMasonryLayoutResult => {
  const liveOrder = resolveDashboardOrderAfterDrop(
    order,
    committedPlacements,
    draggedId,
    dropStart,
    dropTop,
  );
  const liveSizes = pinDashboardWidgetStarts(sizes ?? {}, committedPlacements);
  liveSizes[draggedId] = {
    ...liveSizes[draggedId],
    start: dropStart,
    span: liveSizes[draggedId]?.span ?? resolveDashboardSpanUnits(draggedId, sizes, fallbackSpanById?.[draggedId]),
  };
  return computeDashboardPackedLayout(
    liveOrder,
    heights,
    gap,
    multiColumn,
    liveSizes,
    fallbackSpanById,
  );
};
