import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import { AdminHeaderActionPortal } from '../../../layouts/adminShell/AdminHeaderActionPortal';
import { showAppFeedbackToast } from '../../../shared/ui/appFeedbackToast';
import { DashboardLayoutProvider, useDashboardLayout } from '../../../contexts/DashboardLayoutContext';
import { useFeedbackPolicy } from '../../feedback/hooks/useFeedbackPolicy';
import {
  DASHBOARD_HEADER_ACTIONS_CLASS,
  DASHBOARD_HEADER_DIVIDER_CLASS,
  DASHBOARD_PAGE_GAP_CLASS,
  DASHBOARD_PAGE_PADDING_CLASS,
  DASHBOARD_WORKSPACE_BG_CLASS,
} from '../dashboardDensity';
import {
  createDashboardOverlayLockModifier,
  dashboardIdleSortingStrategy,
  detectDashboardWidgetCollision,
  lockDashboardTextSelection,
  readDashboardDragOrigin,
  readDashboardWidgetMoveRect,
  resolveDashboardDragOverlayRect,
  type DashboardDragOrigin,
} from '../dashboardWidgetDnd';
import {
  pinDashboardWidgetLayout,
  resolveDashboardGridStart,
  resolveDashboardOrderAfterDrop,
  resolveDashboardOrderFromPlacements,
} from '../dashboardMasonryLayout';
import {
  prepareDashboardHomeShortcutDrop,
  takeDashboardHomeShortcutDrop,
} from '../dashboardHomeShortcutDrop';
import type { DashboardMasonryLayoutHandle } from './DashboardMasonryLayout';
import type { DashboardWidgetId } from '../dashboardLayout';
import { filterDashboardWidgetOrderForDisplay } from '../../../shared/lib/userDashboardLayout';
import { useDashboardPage } from '../hooks/useDashboardPage';
import { useDashboardWidgetVacancyMap } from '../hooks/useDashboardWidgetVacancyMap';
import { useDashboardWidgetRenderer } from './useDashboardWidgetRenderer';
import { DashboardWidgetCatalog } from './DashboardWidgetCatalog';
import { DashboardDesignModeButton } from './DashboardDesignModeButton';
import { DashboardMasonryLayout } from './DashboardMasonryLayout';
import { DashboardRefreshIndicator } from './DashboardRefreshIndicator';
import { DashboardSortableWidget } from './DashboardSortableWidget';
import { DashboardWidgetDragOverlay } from './DashboardWidgetDragOverlay';

type DashboardPageModel = ReturnType<typeof useDashboardPage>;

type DashboardWorkspaceContentProps = {
  page: DashboardPageModel;
};

type ActiveDashboardDrag = {
  id: DashboardWidgetId;
  width: number;
  height: number;
  span: number;
  origin: DashboardDragOrigin | null;
};

const DashboardWorkspaceContent: React.FC<DashboardWorkspaceContentProps> = ({ page }) => {
  const { widgetOrder, widgetSizes, widgetChrome, placeWidgets, addHomeShortcut, isDesigning, homeWidgetRegistry, resolveWidgetSpanUnits } = useDashboardLayout();
  const culture = useOptionalCulture();
  const packerRef = useRef<DashboardMasonryLayoutHandle | null>(null);
  const overlayOriginRef = useRef<DashboardDragOrigin | null>(null);
  const overlayLockModifier = useMemo(
    () => createDashboardOverlayLockModifier(() => overlayOriginRef.current),
    [],
  );
  const [activeDrag, setActiveDrag] = useState<ActiveDashboardDrag | null>(null);
  const [dropPreview, setDropPreview] = useState<{ start: number; top: number } | null>(null);
  const dropPreviewRef = useRef<{ start: number; top: number } | null>(null);
  const [isShortcutDropActive, setIsShortcutDropActive] = useState(false);
  const t = culture?.t;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => lockDashboardTextSelection(), []);

  const renderWidgetContent = useDashboardWidgetRenderer({ page, registry: homeWidgetRegistry });
  const contentEmptyById = useDashboardWidgetVacancyMap(page);
  const displayWidgetOrder = useMemo(
    () => filterDashboardWidgetOrderForDisplay(widgetOrder, widgetChrome, contentEmptyById, { isDesigning }),
    [contentEmptyById, isDesigning, widgetChrome, widgetOrder],
  );

  const resolveDragOverlayRect = useCallback((
    event: DragMoveEvent | DragEndEvent,
    origin: DashboardDragOrigin | null,
  ) => {
    if (origin) {
      return resolveDashboardDragOverlayRect(origin, event.delta);
    }
    return readDashboardWidgetMoveRect(
      event.active.rect.current.translated ?? event.active.rect.current.initial,
    );
  }, []);

  const resolveDropPreview = useCallback((
    event: DragMoveEvent | DragEndEvent,
    span: number,
    origin: DashboardDragOrigin | null,
    lastStart?: number | null,
  ): { start: number; top: number } | null => {
    const overlay = resolveDragOverlayRect(event, origin);
    const container = packerRef.current?.getContainerRect();
    if (!overlay || !container) {
      return null;
    }
    return {
      start: resolveDashboardGridStart(
        overlay,
        container,
        span,
        culture?.direction === 'rtl',
        undefined,
        undefined,
        lastStart,
      ),
      top: Math.max(0, overlay.top - container.top),
    };
  }, [culture?.direction, resolveDragOverlayRect]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id) as DashboardWidgetId;
    const initial = readDashboardWidgetMoveRect(event.active.rect.current.initial);
    const origin = readDashboardDragOrigin(event.activatorEvent, initial);
    overlayOriginRef.current = origin;
    document.getSelection()?.removeAllRanges();
    const span = resolveWidgetSpanUnits(id);
    setActiveDrag({
      id,
      width: Math.round(origin?.width ?? initial?.width ?? 0),
      height: Math.round(origin?.height ?? initial?.height ?? 0),
      span,
      origin,
    });
    const start = widgetSizes[id]?.start;
    const preview = start == null ? null : { start, top: 0 };
    dropPreviewRef.current = preview;
    setDropPreview(preview);
  }, [widgetSizes]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const id = String(event.active.id) as DashboardWidgetId;
    const span = activeDrag?.span ?? resolveWidgetSpanUnits(id);
    const preview = resolveDropPreview(
      event,
      span,
      activeDrag?.origin ?? overlayOriginRef.current,
      dropPreviewRef.current?.start,
    );
    dropPreviewRef.current = preview;
    setDropPreview(preview);
  }, [activeDrag?.origin, activeDrag?.span, resolveDropPreview, widgetSizes]);

  const handleDragCancel = useCallback(() => {
    overlayOriginRef.current = null;
    dropPreviewRef.current = null;
    setActiveDrag(null);
    setDropPreview(null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const activeId = String(event.active.id) as DashboardWidgetId;
    const span = activeDrag?.span ?? resolveWidgetSpanUnits(activeId, widgetSizes);
    const origin = activeDrag?.origin ?? overlayOriginRef.current;
    const preview = dropPreviewRef.current
      ?? resolveDropPreview(event, span, origin, dropPreviewRef.current?.start);
    const packer = packerRef.current;
    const displayed = packer?.getDisplayedLayout(preview);

    if (displayed?.packed && displayed.placements.length > 0) {
      placeWidgets(
        resolveDashboardOrderFromPlacements(displayed.placements, widgetOrder),
        pinDashboardWidgetLayout(widgetSizes, displayed.placements),
      );
    } else if (packer && preview) {
      const placements = packer.getPlacements();
      placeWidgets(
        resolveDashboardOrderAfterDrop(
          widgetOrder,
          placements,
          activeId,
          preview.start,
          preview.top,
        ),
        widgetSizes,
      );
    }

    overlayOriginRef.current = null;
    dropPreviewRef.current = null;
    setActiveDrag(null);
    setDropPreview(null);
  }, [activeDrag?.origin, activeDrag?.span, placeWidgets, resolveDropPreview, widgetOrder, widgetSizes]);

  const renderBlock = useCallback((blockId: DashboardWidgetId, columnStart?: number) => {
    const content = renderWidgetContent(blockId);
    if (!content) {
      return null;
    }

    return (
      <DashboardSortableWidget
        key={blockId}
        id={blockId}
        span={resolveWidgetSpanUnits(blockId)}
        columnStart={columnStart}
      >
        {content}
      </DashboardSortableWidget>
    );
  }, [renderWidgetContent, resolveWidgetSpanUnits]);

  const sortableBlocks = (
    <SortableContext items={displayWidgetOrder} strategy={dashboardIdleSortingStrategy}>
      <DashboardMasonryLayout
        ref={packerRef}
        widgetOrder={displayWidgetOrder}
        renderWidget={renderBlock}
        isDragging={Boolean(activeDrag)}
        dropActiveId={activeDrag?.id ?? null}
        dropStart={dropPreview?.start ?? null}
        dropTop={dropPreview?.top ?? null}
        dropSpan={activeDrag?.span}
        dropHeight={activeDrag?.height}
      />
    </SortableContext>
  );

  return (
    <div className={cn('flex h-full w-full flex-col font-sans', DASHBOARD_WORKSPACE_BG_CLASS)}>
      <AdminHeaderActionPortal>
        <div className={DASHBOARD_HEADER_ACTIONS_CLASS}>
          <DashboardDesignModeButton />
          {isDesigning ? (
            <>
              <div className={DASHBOARD_HEADER_DIVIDER_CLASS} aria-hidden="true" />
              <DashboardWidgetCatalog />
            </>
          ) : null}
          {page.isAdmin ? (
            <>
              <div className={DASHBOARD_HEADER_DIVIDER_CLASS} aria-hidden="true" />
              <DashboardRefreshIndicator
                lastUpdatedTimestamp={page.lastUpdatedTimestamp}
                pollMs={page.dashboardPollMs}
              />
            </>
          ) : null}
        </div>
      </AdminHeaderActionPortal>

      <div
        className={cn('flex-1 overflow-auto', DASHBOARD_WORKSPACE_BG_CLASS, DASHBOARD_PAGE_PADDING_CLASS)}
        onDragEnter={(event) => {
          if (prepareDashboardHomeShortcutDrop(event)) {
            setIsShortcutDropActive(true);
          }
        }}
        onDragOver={(event) => {
          if (prepareDashboardHomeShortcutDrop(event)) {
            setIsShortcutDropActive(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsShortcutDropActive(false);
          }
        }}
        onDrop={(event) => {
          setIsShortcutDropActive(false);
          const shortcut = takeDashboardHomeShortcutDrop(event);
          if (!shortcut) {
            return;
          }
          const added = addHomeShortcut(shortcut);
          showAppFeedbackToast(
            added
              ? (t?.('dashboard.myShortcuts.pinned') ?? 'Pinned to Home')
              : (t?.('dashboard.myShortcuts.alreadyPinned') ?? 'Already on Home'),
            { type: added ? 'success' : 'info' },
          );
        }}
      >
        <div className={cn('flex w-full min-w-0 flex-col', DASHBOARD_PAGE_GAP_CLASS)}>
          {isDesigning ? (
            <div className="rounded-xl border border-dashed border-indigo-400/50 bg-indigo-50/90 px-4 py-2.5 text-center text-sm font-semibold text-indigo-900">
              {t?.('dashboard.layout.designModeBanner') ?? 'Drag widgets to reorder or resize. Add widgets from the catalog.'}
            </div>
          ) : null}
          {isShortcutDropActive ? (
            <div className="rounded-xl border border-dashed border-primary-400/60 bg-primary-50/80 px-4 py-2.5 text-center text-sm font-semibold text-primary-800">
              {t?.('dashboard.myShortcuts.dropHint') ?? 'Drop to pin this page on Home'}
            </div>
          ) : null}
          <DndContext
            sensors={sensors}
            collisionDetection={detectDashboardWidgetCollision}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            {sortableBlocks}
            <DashboardWidgetDragOverlay
              activeId={activeDrag?.id ?? null}
              width={activeDrag?.width ?? 0}
              height={activeDrag?.height ?? 0}
              span={activeDrag?.span ?? 6}
              modifiers={[overlayLockModifier]}
            >
              {activeDrag ? renderWidgetContent(activeDrag.id) : null}
            </DashboardWidgetDragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  );
};

export const DashboardWorkspace: React.FC = () => {
  const page = useDashboardPage();
  const { showOnDashboard: feedbackEnabled } = useFeedbackPolicy();

  return (
    <DashboardLayoutProvider
      isAdmin={page.isAdmin}
      feedbackEnabled={feedbackEnabled}
    >
      <DashboardWorkspaceContent page={page} />
    </DashboardLayoutProvider>
  );
};
