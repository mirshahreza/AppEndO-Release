import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { cn } from '../../../lib/utils';
import type { DashboardWidgetId } from '../../../shared/lib/userDashboardLayout';
import { DASHBOARD_LAYOUT_COLUMNS } from '../dashboardWidgetLayoutSpan';
import {
  DASHBOARD_MASONRY_GAP_PX,
  computeDashboardLiveLayout,
  computeDashboardPackedLayout,
  resolveDashboardMasonryItemStyle,
  type DashboardMasonryPlacement,
} from '../dashboardMasonryLayout';
import {
  DASHBOARD_DRAG_GRID_CLASS,
  DASHBOARD_DRAG_GRID_TRACK_CLASS,
  DASHBOARD_DROP_PLACEHOLDER_CLASS,
  DASHBOARD_MASONRY_GAP_CLASS,
  DASHBOARD_WIDGET_MOVE_TRANSITION,
} from '../dashboardDensity';
import { useDashboardLayout } from '../../../contexts/DashboardLayoutContext';
import { useDashboardMasonryColumns } from '../hooks/useDashboardMasonryColumns';

export type DashboardDisplayedLayout = {
  placements: DashboardMasonryPlacement[];
  packed: boolean;
};

export type DashboardMasonryLayoutHandle = {
  getContainerRect: () => DOMRect | null;
  getPlacements: () => DashboardMasonryPlacement[];
  getDisplayedLayout: (drop?: { start: number; top: number } | null) => DashboardDisplayedLayout;
};

export type DashboardMasonryLayoutProps = {
  widgetOrder: DashboardWidgetId[];
  renderWidget: (blockId: DashboardWidgetId, columnStart?: number) => React.ReactNode;
  isDragging?: boolean;
  dropActiveId?: DashboardWidgetId | null;
  dropStart?: number | null;
  dropTop?: number | null;
  dropSpan?: number;
  dropHeight?: number;
};

export const DashboardMasonryLayout = React.forwardRef<
  DashboardMasonryLayoutHandle,
  DashboardMasonryLayoutProps
>(({
  widgetOrder,
  renderWidget,
  isDragging = false,
  dropActiveId = null,
  dropStart = null,
  dropTop = null,
  dropSpan = 6,
  dropHeight = 0,
}, ref) => {
  const twoColumns = useDashboardMasonryColumns();
  const { widgetSizes, defaultSpanUnitsById } = useDashboardLayout();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [heights, setHeights] = useState<Partial<Record<DashboardWidgetId, number>>>({});
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const updateHeight = useCallback((id: DashboardWidgetId, height: number) => {
    setHeights((current) => {
      const nextHeight = Math.round(height);
      if (current[id] === nextHeight) {
        return current;
      }
      return { ...current, [id]: nextHeight };
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isDragging) {
      return;
    }

    const measureNodes = () => {
      const nodes = container.querySelectorAll<HTMLElement>('[data-dashboard-masonry-item]');
      nodes.forEach((node) => {
        const id = node.dataset.dashboardMasonryItem as DashboardWidgetId | undefined;
        if (!id) {
          return;
        }
        updateHeight(id, node.getBoundingClientRect().height);
      });
    };

    measureNodes();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      measureNodes();
    });
    resizeObserver.observe(container);

    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
        measureNodes();
      });
    mutationObserver?.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
    };
  }, [isDragging, updateHeight, widgetOrder, twoColumns]);

  const committed = useMemo(
    () => computeDashboardPackedLayout(
      widgetOrder,
      heights,
      DASHBOARD_MASONRY_GAP_PX,
      twoColumns,
      widgetSizes,
      defaultSpanUnitsById,
    ),
    [defaultSpanUnitsById, heights, twoColumns, widgetOrder, widgetSizes],
  );

  const live = useMemo(() => {
    if (!dropActiveId || dropStart == null || !twoColumns) {
      return committed;
    }
    return computeDashboardLiveLayout(
      widgetOrder,
      committed.placements,
      heights,
      DASHBOARD_MASONRY_GAP_PX,
      twoColumns,
      widgetSizes,
      dropActiveId,
      dropStart,
      dropTop ?? 0,
      defaultSpanUnitsById,
    );
  }, [committed, dropActiveId, dropStart, dropTop, defaultSpanUnitsById, heights, twoColumns, widgetOrder, widgetSizes]);

  const allMeasured = widgetOrder.every((id) => heights[id] != null);
  const usePackedLayout = twoColumns && allMeasured;

  useImperativeHandle(ref, () => ({
    getContainerRect: () => containerRef.current?.getBoundingClientRect() ?? null,
    getPlacements: () => committed.placements,
    getDisplayedLayout: (drop) => {
      if (!usePackedLayout) {
        return { placements: committed.placements, packed: false };
      }
      const start = drop?.start ?? dropStart;
      const top = drop?.top ?? dropTop ?? 0;
      if (dropActiveId == null || start == null) {
        return { placements: committed.placements, packed: true };
      }
      return {
        placements: computeDashboardLiveLayout(
          widgetOrder,
          committed.placements,
          heights,
          DASHBOARD_MASONRY_GAP_PX,
          twoColumns,
          widgetSizes,
          dropActiveId,
          start,
          top,
          defaultSpanUnitsById,
        ).placements,
        packed: true,
      };
    },
  }), [
    committed.placements,
    defaultSpanUnitsById,
    dropActiveId,
    dropStart,
    dropTop,
    heights,
    twoColumns,
    usePackedLayout,
    widgetOrder,
    widgetSizes,
  ]);

  const placementById = useMemo(
    () => new Map(live.placements.map((placement) => [placement.id, placement])),
    [live.placements],
  );
  const committedById = useMemo(
    () => new Map(committed.placements.map((placement) => [placement.id, placement])),
    [committed.placements],
  );

  const previewPlacement = dropActiveId ? placementById.get(dropActiveId) : undefined;
  const previewHeight = Math.max(dropHeight, 72);
  const canvasHeight = Math.max(committed.totalHeight, live.totalHeight);

  return (
    <div
      ref={containerRef}
      data-dashboard-layout-mode="masonry"
      className={cn(
        !usePackedLayout && cn('flex flex-col', DASHBOARD_MASONRY_GAP_CLASS),
      )}
      style={usePackedLayout ? { position: 'relative', height: canvasHeight } : undefined}
    >
      {usePackedLayout && isDragging ? (
        <div aria-hidden className={DASHBOARD_DRAG_GRID_CLASS}>
          {Array.from({ length: DASHBOARD_LAYOUT_COLUMNS }, (_, index) => (
            <div key={index} className={DASHBOARD_DRAG_GRID_TRACK_CLASS} />
          ))}
        </div>
      ) : null}
      {widgetOrder.map((blockId) => {
        const isDragged = blockId === dropActiveId;
        const placement = isDragged
          ? committedById.get(blockId) ?? placementById.get(blockId)
          : placementById.get(blockId);
        const packedStyle = usePackedLayout && placement
          ? {
              position: 'absolute' as const,
              transition: reduceMotion || isDragged ? undefined : DASHBOARD_WIDGET_MOVE_TRANSITION,
              ...resolveDashboardMasonryItemStyle(
                placement.start,
                placement.span,
                placement.top,
                DASHBOARD_MASONRY_GAP_PX,
              ),
            }
          : undefined;

        return (
          <div
            key={blockId}
            data-dashboard-masonry-item={blockId}
            className={cn('min-w-0', isDragged && 'pointer-events-none invisible')}
            style={packedStyle}
          >
            {renderWidget(blockId, placement?.start)}
          </div>
        );
      })}
      {usePackedLayout && previewPlacement ? (
        <div
          aria-hidden
          className={DASHBOARD_DROP_PLACEHOLDER_CLASS}
          style={{
            position: 'absolute',
            height: previewHeight,
            transition: reduceMotion ? undefined : DASHBOARD_WIDGET_MOVE_TRANSITION,
            ...resolveDashboardMasonryItemStyle(
              previewPlacement.start,
              dropSpan || previewPlacement.span,
              previewPlacement.top,
              DASHBOARD_MASONRY_GAP_PX,
            ),
          }}
        />
      ) : null}
    </div>
  );
});

DashboardMasonryLayout.displayName = 'DashboardMasonryLayout';
