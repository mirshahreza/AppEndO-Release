import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useCultureT } from '../../../core/culture/CultureContext';
import { useDashboardLayout } from '../../../contexts/DashboardLayoutContext';
import { cn } from '../../../lib/utils';
import type { DashboardWidgetId } from '../../../shared/lib/userDashboardLayout';
import {
  DASHBOARD_WIDGET_ACCENT_ARTICLE_CLASS,
  resolveDashboardWidgetChrome,
} from '../dashboardWidgetChrome';
import { resolveDashboardWidgetDragSurface } from '../dashboardWidgetDragSurface';
import { resolveDashboardWidgetFit } from '../dashboardWidgetFit';
import { DashboardWidgetFitProvider } from './DashboardWidgetFitContext';
import { DashboardWidgetHoverActions } from './DashboardWidgetHoverActions';
import { DashboardWidgetResizeHandles } from './DashboardWidgetResizeHandles';
import { DashboardSortableWidgetProvider } from './DashboardSortableWidgetContext';

export type DashboardSortableWidgetProps = {
  id: DashboardWidgetId;
  span: number;
  columnStart?: number;
  children: React.ReactNode;
};

export const DashboardSortableWidget: React.FC<DashboardSortableWidgetProps> = ({
  id,
  span,
  columnStart,
  children,
}) => {
  const t = useCultureT();
  const { hideWidget, setWidgetSize, widgetSizes, widgetChrome, isDesigning } = useDashboardLayout();
  const resolvedStart = columnStart ?? widgetSizes[id]?.start;
  const chrome = resolveDashboardWidgetChrome(id, widgetChrome);
  const catalogSurface = resolveDashboardWidgetDragSurface(id);
  const dragSurface = chrome.showHeader ? 'header' : catalogSurface;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
    isOver,
  } = useSortable({
    id,
    disabled: !isDesigning,
    animateLayoutChanges: () => false,
  });

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    frameRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setBox((current) => {
        const nextWidth = Math.round(rect.width);
        const nextHeight = Math.round(rect.height);
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, [span]);

  const fit = useMemo(
    () => resolveDashboardWidgetFit({ width: box.width, height: box.height, span }),
    [box.height, box.width, span],
  );

  const handleResize = useCallback((next: { span: number }) => {
    if (chrome.lockSize) {
      return;
    }
    setWidgetSize(id, resolvedStart == null
      ? { span: next.span }
      : { span: next.span, start: resolvedStart });
  }, [chrome.lockSize, id, resolvedStart, setWidgetSize]);

  return (
    <DashboardSortableWidgetProvider
      value={{
        widgetId: id,
        dragSurface,
        attributes,
        listeners,
        isDragging,
        onClose: () => hideWidget(id),
      }}
    >
      <DashboardWidgetFitProvider value={fit}>
        <div
          ref={setRefs}
          className={cn(
            'group/sortable relative h-auto min-w-0 select-none',
            chrome.accent ? DASHBOARD_WIDGET_ACCENT_ARTICLE_CLASS[chrome.accent] : null,
            isDragging && 'pointer-events-none',
            isDesigning && !isDragging && 'rounded-3xl ring-1 ring-primary-300/55',
            isOver && !isDragging && 'rounded-3xl ring-2 ring-primary-400/40',
          )}
        >
          {isDesigning ? <DashboardWidgetHoverActions /> : null}
          {dragSurface === 'body' ? (
            <div
              className={cn(
                'h-auto min-h-0',
                isDesigning && 'cursor-grab active:cursor-grabbing',
                isDragging && 'cursor-grabbing',
              )}
              aria-label={isDesigning ? t('dashboard.layout.dragWidget') : undefined}
              {...(isDesigning ? { ...attributes, ...listeners } : {})}
            >
              {children}
            </div>
          ) : (
            children
          )}
          {isDesigning && !isDragging && !chrome.lockSize ? (
            <DashboardWidgetResizeHandles
              span={span}
              start={resolvedStart}
              onResize={handleResize}
            />
          ) : null}
        </div>
      </DashboardWidgetFitProvider>
    </DashboardSortableWidgetProvider>
  );
};
