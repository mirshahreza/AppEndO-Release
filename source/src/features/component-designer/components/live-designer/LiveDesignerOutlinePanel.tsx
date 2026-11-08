import * as React from 'react';
import { ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, ListTree } from 'lucide-react';
import { AppButton, AppSearchBox } from '../../../../shared/ui';
import { ICON_ACTION_BUTTON_SM_CLASS, TOOLBOX_PANEL_SEARCH_HOST_CLASS, UI_CHROME_NO_SELECT_CLASS } from '../../../../shared/ui/surfaceClasses';
import { cn } from '../../../../lib/utils';
import type {
  DesignerBindingDefinitions,
  DesignerDocument,
} from '../../../../domain/component-designer/types';
import { LiveDesignerDragGhost, LiveDesignerDropMarker } from './LiveDesignerDropMarker';
import { LiveDesignerDockPanelHeader } from './LiveDesignerDockPanelHeader';
import {
  beginLiveDesignerExternalDrag,
  endLiveDesignerExternalDrag,
  getLiveDesignerExternalDrag,
  hasLiveDesignerExternalDragType,
  LIVE_DESIGNER_NODE_DRAG_MIME,
  setLiveDesignerDragImage,
} from './liveDesignerDragSession';
import {
  isLiveDesignerNoOpMove,
  liveDesignerDropTargetsEqual,
  measureLiveDesignerDropIndicator,
  measureLiveDesignerInvalidIndicator,
  resolveLiveDesignerDropTarget,
  type LiveDesignerDragSource,
  type LiveDesignerDropIndicator,
  type LiveDesignerDropTarget,
} from './liveDesignerDropResolve';
import {
  useLiveDesignerOutline,
  type LiveDesignerOutlineRow,
} from './useLiveDesignerOutline';

export type LiveDesignerOutlinePanelProps = {
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  selectedNodeId: string | null;
  selectedNodeIds?: string[];
  onSelectNode: (nodeId: string) => void;
  onOpenProperties: (nodeId: string) => void;
  onMoveNode: (nodeId: string, targetParentId: string, index?: number) => boolean;
  onInsertPaletteItem: (itemId: string, parentId?: string | null, index?: number) => void;
  interactionEnabled?: boolean;
  onClose: () => void;
  width: number;
};

function escapeSelectorIdent(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderRowLabel(row: LiveDesignerOutlineRow): React.ReactNode {
  if (row.isRoot) {
    return <span className="truncate font-semibold text-slate-800">{row.treeLabel}</span>;
  }

  if (row.display.detail) {
    return (
      <span className="flex min-w-0 items-baseline gap-1 truncate">
        <span className="truncate font-medium text-slate-800">{row.display.detail}</span>
        <span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">·</span>
        <span className="hidden truncate text-[10px] text-slate-500 sm:inline">
          {row.display.componentLabel}
        </span>
      </span>
    );
  }

  return <span className="truncate font-medium text-slate-800">{row.display.componentLabel}</span>;
}

function sourceFromExternalDrag(): LiveDesignerDragSource | null {
  const drag = getLiveDesignerExternalDrag();
  if (!drag) {
    return null;
  }
  return drag.kind === 'palette'
    ? { kind: 'palette', itemId: drag.itemId }
    : { kind: 'node', nodeId: drag.nodeId };
}

function measureRowRect(
  rowEl: HTMLElement,
  host: HTMLElement,
): { top: number; left: number; width: number; height: number } {
  const hostRect = host.getBoundingClientRect();
  const rowRect = rowEl.getBoundingClientRect();
  return {
    top: rowRect.top - hostRect.top,
    left: rowRect.left - hostRect.left,
    width: rowRect.width,
    height: rowRect.height,
  };
}

export const LiveDesignerOutlinePanel: React.FC<LiveDesignerOutlinePanelProps> = ({
  document,
  bindingDefinitions,
  selectedNodeId,
  selectedNodeIds = [],
  onSelectNode,
  onOpenProperties,
  onMoveNode,
  onInsertPaletteItem,
  interactionEnabled = true,
  onClose,
  width,
}) => {
  const outline = useLiveDesignerOutline(document, bindingDefinitions);
  const selectedRowRef = React.useRef<HTMLButtonElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const dropTargetRef = React.useRef<LiveDesignerDropTarget | null>(null);
  const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = React.useState<LiveDesignerDropIndicator | null>(null);
  const [dragGhost, setDragGhost] = React.useState<{ label: string; x: number; y: number } | null>(null);

  React.useEffect(() => {
    selectedRowRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedNodeId]);

  const clearDragVisuals = React.useCallback(() => {
    dropTargetRef.current = null;
    setDraggingNodeId(null);
    setDropIndicator(null);
    setDragGhost(null);
  }, []);

  const updateDropFromPoint = React.useCallback((
    clientX: number,
    clientY: number,
    source: LiveDesignerDragSource,
    ghostLabel: string,
  ) => {
    const overlay = overlayRef.current;
    const list = listRef.current;
    if (!overlay || !list) {
      dropTargetRef.current = null;
      setDropIndicator(null);
      setDragGhost(null);
      return;
    }

    const overlayRect = overlay.getBoundingClientRect();
    setDragGhost({
      label: ghostLabel,
      x: clientX - overlayRect.left,
      y: clientY - overlayRect.top,
    });

    const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-outline-node-id]'));
    let hitEl: HTMLElement | null = null;
    let nearest: { el: HTMLElement; dist: number } | null = null;
    for (const rowEl of rows) {
      const rect = rowEl.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        hitEl = rowEl;
        break;
      }
      const dist = clientY < rect.top ? rect.top - clientY : clientY - rect.bottom;
      if (!nearest || dist < nearest.dist) {
        nearest = { el: rowEl, dist };
      }
    }
    if (!hitEl) {
      hitEl = nearest?.el ?? null;
    }

    const hitNodeId = hitEl?.getAttribute('data-outline-node-id') ?? null;
    const hitRect = hitEl ? measureRowRect(hitEl, overlay) : null;
    const pointerY = clientY - overlayRect.top;

    const nextTarget = resolveLiveDesignerDropTarget(
      document,
      source,
      hitNodeId,
      pointerY,
      hitRect,
    );

    if (!liveDesignerDropTargetsEqual(dropTargetRef.current, nextTarget)) {
      dropTargetRef.current = nextTarget;
    }

    if (nextTarget) {
      const anchorEl = list.querySelector<HTMLElement>(
        `[data-outline-node-id="${escapeSelectorIdent(nextTarget.anchorNodeId)}"]`,
      );
      if (!anchorEl) {
        setDropIndicator(null);
        return;
      }
      setDropIndicator(measureLiveDesignerDropIndicator(
        nextTarget.placement,
        measureRowRect(anchorEl, overlay),
      ));
      return;
    }

    if (hitRect) {
      setDropIndicator(measureLiveDesignerInvalidIndicator(hitRect));
      return;
    }

    setDropIndicator(null);
  }, [document]);

  const handleRowDragStart = React.useCallback((
    event: React.DragEvent<HTMLButtonElement>,
    row: LiveDesignerOutlineRow,
  ) => {
    if (!interactionEnabled || row.isRoot) {
      event.preventDefault();
      return;
    }

    event.stopPropagation();
    beginLiveDesignerExternalDrag({
      kind: 'node',
      nodeId: row.id,
      label: row.treeLabel,
    });
    event.dataTransfer.setData(LIVE_DESIGNER_NODE_DRAG_MIME, row.id);
    event.dataTransfer.setData('text/plain', row.id);
    event.dataTransfer.effectAllowed = 'move';
    setLiveDesignerDragImage(event.dataTransfer, row.treeLabel);
    setDraggingNodeId(row.id);
    onSelectNode(row.id);
  }, [interactionEnabled, onSelectNode]);

  const handleRowDragEnd = React.useCallback(() => {
    endLiveDesignerExternalDrag();
    clearDragVisuals();
  }, [clearDragVisuals]);

  const handleListDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!interactionEnabled || !hasLiveDesignerExternalDragType(event.dataTransfer.types)) {
      return;
    }

    const source = sourceFromExternalDrag();
    const drag = getLiveDesignerExternalDrag();
    if (!source || !drag) {
      return;
    }

    event.preventDefault();
    updateDropFromPoint(event.clientX, event.clientY, source, drag.label);
    event.dataTransfer.dropEffect = dropTargetRef.current
      ? (source.kind === 'palette' ? 'copy' : 'move')
      : 'none';
  }, [interactionEnabled, updateDropFromPoint]);

  const handleListDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const host = overlayRef.current;
    const related = event.relatedTarget;
    if (host && related instanceof Node && host.contains(related)) {
      return;
    }
    dropTargetRef.current = null;
    setDropIndicator(null);
    setDragGhost(null);
  }, []);

  const handleListDrop = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!interactionEnabled) {
      return;
    }

    const drag = getLiveDesignerExternalDrag();
    const target = dropTargetRef.current;
    event.preventDefault();
    clearDragVisuals();
    endLiveDesignerExternalDrag();

    if (!drag || !target) {
      return;
    }

    if (drag.kind === 'palette') {
      onInsertPaletteItem(drag.itemId, target.parentId, target.index);
      return;
    }

    if (drag.nodeId === document.rootNodeId
      || isLiveDesignerNoOpMove(document, drag.nodeId, target.parentId, target.index)) {
      onSelectNode(drag.nodeId);
      return;
    }

    onMoveNode(drag.nodeId, target.parentId, target.index);
    onSelectNode(drag.nodeId);
  }, [
    clearDragVisuals,
    document,
    interactionEnabled,
    onInsertPaletteItem,
    onMoveNode,
    onSelectNode,
  ]);

  const dropInvalid = dropIndicator?.kind === 'invalid';

  return (
    <aside
      className={cn('flex h-full min-h-0 shrink-0 flex-col border-r border-slate-200 bg-white', UI_CHROME_NO_SELECT_CLASS)}
      style={{ width }}
      data-testid="live-designer-outline-panel"
    >
      <LiveDesignerDockPanelHeader
        title="Outline"
        titleIcon={<ListTree className="h-3.5 w-3.5" />}
        closeAriaLabel="Close outline"
        onClose={onClose}
      />

      <div className={TOOLBOX_PANEL_SEARCH_HOST_CLASS}>
        <AppSearchBox
          value={outline.search}
          onChange={outline.setSearch}
          placeholder="outline…"
          ariaLabel="Search outline"
          className="!min-h-0 w-full gap-1.5 px-2 py-1 [&>svg:first-child]:h-3 [&>svg:first-child]:w-3"
        />
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          className={cn(
            'h-full overflow-auto py-1',
            draggingNodeId && (dropInvalid ? 'cursor-not-allowed' : 'cursor-grabbing'),
          )}
          data-testid="live-designer-outline-list"
          onDragOver={interactionEnabled ? handleListDragOver : undefined}
          onDragLeave={interactionEnabled ? handleListDragLeave : undefined}
          onDrop={interactionEnabled ? handleListDrop : undefined}
        >
          {outline.rows.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-slate-400">No matching nodes.</p>
          ) : (
            outline.rows.map((row) => {
              const selected = selectedNodeIds.includes(row.id) || selectedNodeId === row.id;
              const expanded = outline.expandedById[row.id] === true;
              const dragging = draggingNodeId === row.id;
              return (
                <div
                  key={row.id}
                  data-outline-node-id={row.id}
                  className={cn(
                    'flex min-h-7 items-center gap-0.5 pr-2',
                    row.isRoot && 'group/outline-root',
                    selected ? 'bg-cyan-50' : 'hover:bg-slate-50',
                    dragging && 'opacity-40',
                  )}
                  style={{ paddingInlineStart: `${8 + row.depth * 12}px` }}
                >
                  {row.hasChildren ? (
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                      aria-label={expanded ? 'Collapse' : 'Expand'}
                      onClick={() => outline.toggleCollapsed(row.id)}
                    >
                      {expanded
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <span className="inline-block h-5 w-5 shrink-0" aria-hidden />
                  )}
                  <button
                    ref={selected ? selectedRowRef : undefined}
                    type="button"
                    draggable={interactionEnabled && !row.isRoot}
                    className={cn(
                      'min-w-0 flex-1 truncate py-1 text-left text-[11px] leading-tight select-none',
                      interactionEnabled && !row.isRoot && 'cursor-grab active:cursor-grabbing',
                    )}
                    onClick={() => onSelectNode(row.id)}
                    onDoubleClick={() => onOpenProperties(row.id)}
                    onMouseDown={(event) => {
                      if (event.button === 0 && interactionEnabled && !row.isRoot) {
                        window.getSelection()?.removeAllRanges();
                      }
                    }}
                    onDragStart={(event) => handleRowDragStart(event, row)}
                    onDragEnd={handleRowDragEnd}
                  >
                    {renderRowLabel(row)}
                  </button>
                  {row.isRoot ? (
                    <span className="ms-auto flex shrink-0 items-center">
                      <AppButton
                        type="button"
                        className={cn(
                          ICON_ACTION_BUTTON_SM_CLASS,
                          'text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-600',
                          'group-hover/outline-root:opacity-100 group-focus-within/outline-root:opacity-100 focus-visible:opacity-100',
                        )}
                        aria-label="Expand all"
                        title="Expand all"
                        onClick={(event) => {
                          event.stopPropagation();
                          outline.expandAll();
                        }}
                      >
                        <ChevronsDown className="h-3 w-3" />
                      </AppButton>
                      <AppButton
                        type="button"
                        className={cn(
                          ICON_ACTION_BUTTON_SM_CLASS,
                          'text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-600',
                          'group-hover/outline-root:opacity-100 group-focus-within/outline-root:opacity-100 focus-visible:opacity-100',
                        )}
                        aria-label="Collapse all"
                        title="Collapse all"
                        onClick={(event) => {
                          event.stopPropagation();
                          outline.collapseAll();
                        }}
                      >
                        <ChevronsUp className="h-3 w-3" />
                      </AppButton>
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <div
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          aria-hidden
        >
          {dropIndicator ? <LiveDesignerDropMarker indicator={dropIndicator} /> : null}
          {dragGhost ? (
            <LiveDesignerDragGhost label={dragGhost.label} x={dragGhost.x} y={dragGhost.y} />
          ) : null}
        </div>
      </div>
    </aside>
  );
};
