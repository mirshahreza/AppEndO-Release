import * as React from 'react';
import { resolveLayoutStructureHint, type LayoutTrackAxis } from '../../../../domain/component-designer/layoutStructure';
import { resolveOutlinePrimaryLabel } from '../../../../domain/component-designer/outlineNodeDisplay';
import type { DesignerDocument } from '../../../../domain/component-designer/types';
import { cn } from '../../../../lib/utils';
import { LiveDesignerDragGhost, LiveDesignerDropMarker } from './LiveDesignerDropMarker';
import { LiveDesignerLayoutChrome } from './LiveDesignerLayoutChrome';
import {
  LiveDesignerContextMenu,
  type LiveDesignerContextMenuAction,
  type LiveDesignerContextMenuState,
} from './LiveDesignerContextMenu';
import {
  acquireLiveDesignerDragSelectionLock,
  endLiveDesignerExternalDrag,
  getLiveDesignerExternalDrag,
  hasLiveDesignerExternalDragType,
  releaseLiveDesignerDragSelectionLock,
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
import type { LiveDesignerInteractionMode } from './liveDesignerInteractionMode';
import {
  hitTestLiveDesignerNode,
  liveDesignerOutlineNodeExists,
  measureLiveDesignerNodeHost,
  type LiveDesignerOutlineRect,
} from './liveDesignerHitTest';

function escapeSelectorIdent(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const DRAG_THRESHOLD_PX = 5;

export type LiveDesignerSelectionOverlayProps = {
  selectedNodeId: string | null;
  selectedNodeIds?: string[];
  rootNodeId?: string | null;
  document: DesignerDocument;
  /** Bumps when the document mutates so outlines remeasure after prop edits. */
  documentRevision?: string | number | null;
  interactionMode?: LiveDesignerInteractionMode;
  onHoverNodeIdChange: (nodeId: string | null) => void;
  onSelectNodeId: (nodeId: string | null) => void;
  onOpenProperties?: (nodeId: string) => void;
  onContextAction: (action: LiveDesignerContextMenuAction, nodeId: string) => void;
  onMoveNode: (nodeId: string, targetParentId: string, index?: number) => boolean;
  onInsertPaletteItem?: (itemId: string, parentId: string, index?: number) => boolean;
  onAddLayoutTrack?: (nodeId: string, axis: LayoutTrackAxis, place: 'before' | 'after') => void;
  canPaste?: boolean;
};

type OutlineState = {
  nodeId: string;
  rect: LiveDesignerOutlineRect;
};

type DragSession = {
  nodeId: string;
  startX: number;
  startY: number;
  active: boolean;
  suppressClick: boolean;
};

function sourceFromExternalDrag(): LiveDesignerDragSource | null {
  const drag = getLiveDesignerExternalDrag();
  if (!drag) {
    return null;
  }
  return drag.kind === 'palette'
    ? { kind: 'palette', itemId: drag.itemId }
    : { kind: 'node', nodeId: drag.nodeId };
}

function resolveSelectedNodeIds(
  selectedNodeId: string | null,
  selectedNodeIds: string[] | undefined,
): string[] {
  if (selectedNodeIds && selectedNodeIds.length > 0) {
    return selectedNodeIds;
  }
  return selectedNodeId ? [selectedNodeId] : [];
}

export const LiveDesignerSelectionOverlay: React.FC<LiveDesignerSelectionOverlayProps> = ({
  selectedNodeId,
  selectedNodeIds,
  rootNodeId = null,
  document,
  documentRevision = null,
  interactionMode = 'inspect',
  onHoverNodeIdChange,
  onSelectNodeId,
  onOpenProperties,
  onContextAction,
  onMoveNode,
  onInsertPaletteItem,
  onAddLayoutTrack,
  canPaste = false,
}) => {
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<DragSession | null>(null);
  const overlaySelectionLockRef = React.useRef(false);
  const dropTargetRef = React.useRef<LiveDesignerDropTarget | null>(null);
  const [hoverOutline, setHoverOutline] = React.useState<OutlineState | null>(null);
  const [selectedOutlines, setSelectedOutlines] = React.useState<OutlineState[]>([]);
  const [contextMenu, setContextMenu] = React.useState<LiveDesignerContextMenuState | null>(null);
  const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);
  const [externalDragActive, setExternalDragActive] = React.useState(false);
  const [dropIndicator, setDropIndicator] = React.useState<LiveDesignerDropIndicator | null>(null);
  const [dragGhost, setDragGhost] = React.useState<{ label: string; x: number; y: number } | null>(null);
  const isInspect = interactionMode === 'inspect';

  const clearDragVisuals = React.useCallback(() => {
    if (overlaySelectionLockRef.current) {
      releaseLiveDesignerDragSelectionLock();
      overlaySelectionLockRef.current = false;
    }
    dropTargetRef.current = null;
    setDraggingNodeId(null);
    setExternalDragActive(false);
    setDropIndicator(null);
    setDragGhost(null);
  }, []);

  React.useEffect(() => () => {
    if (overlaySelectionLockRef.current) {
      releaseLiveDesignerDragSelectionLock();
      overlaySelectionLockRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    if (isInspect) {
      return;
    }
    dragRef.current = null;
    clearDragVisuals();
    setContextMenu(null);
    setHoverOutline(null);
    setSelectedOutlines([]);
    onHoverNodeIdChange(null);
  }, [clearDragVisuals, isInspect, onHoverNodeIdChange]);

  const resolveOutline = React.useCallback((nodeId: string | null): OutlineState | null => {
    const overlay = overlayRef.current;
    if (!overlay || !nodeId) {
      return null;
    }

    const surface = overlay.parentElement;
    if (!surface) {
      return null;
    }

    const host = surface.querySelector(`[data-designer-node-id="${escapeSelectorIdent(nodeId)}"]`);
    if (!host) {
      return null;
    }

    const rect = measureLiveDesignerNodeHost(host, surface);
    if (!rect) {
      return null;
    }

    return { nodeId, rect };
  }, []);

  const refreshSelectedOutline = React.useCallback(() => {
    const ids = resolveSelectedNodeIds(selectedNodeId, selectedNodeIds);
    if (!isInspect) {
      setSelectedOutlines([]);
      return;
    }
    setSelectedOutlines(
      ids
        .filter((id) => liveDesignerOutlineNodeExists(id, document.nodes))
        .map((id) => resolveOutline(id))
        .filter((outline): outline is OutlineState => Boolean(outline)),
    );
  }, [document.nodes, isInspect, resolveOutline, selectedNodeId, selectedNodeIds]);

  const pruneHoverOutline = React.useCallback(() => {
    setHoverOutline((current) => {
      if (!current || !liveDesignerOutlineNodeExists(current.nodeId, document.nodes)) {
        return null;
      }
      return resolveOutline(current.nodeId);
    });
  }, [document.nodes, resolveOutline]);

  React.useLayoutEffect(() => {
    refreshSelectedOutline();
    pruneHoverOutline();
  }, [documentRevision, pruneHoverOutline, refreshSelectedOutline]);

  React.useEffect(() => {
    const surface = overlayRef.current?.parentElement;
    if (!surface) {
      return undefined;
    }

    const handle = () => {
      refreshSelectedOutline();
      pruneHoverOutline();
    };

    surface.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      surface.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [pruneHoverOutline, refreshSelectedOutline]);

  React.useEffect(() => {
    if (!isInspect) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (dragRef.current?.active) {
        dragRef.current = null;
        clearDragVisuals();
        return;
      }

      if (contextMenu) {
        setContextMenu(null);
        return;
      }

      onSelectNodeId(null);
      onHoverNodeIdChange(null);
      setHoverOutline(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearDragVisuals, contextMenu, isInspect, onHoverNodeIdChange, onSelectNodeId]);

  const updateDropFromPoint = React.useCallback((
    clientX: number,
    clientY: number,
    source: LiveDesignerDragSource,
    ghostLabel: string,
  ) => {
    const overlay = overlayRef.current;
    const surface = overlay?.parentElement;
    if (!overlay || !surface) {
      dropTargetRef.current = null;
      setDropIndicator(null);
      setDragGhost(null);
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    setDragGhost({
      label: ghostLabel,
      x: clientX - surfaceRect.left,
      y: clientY - surfaceRect.top,
    });

    const hit = hitTestLiveDesignerNode(clientX, clientY, overlay);
    const hitOutline = hit ? resolveOutline(hit.nodeId) : null;
    const pointerYInSurface = clientY - surfaceRect.top;

    const nextTarget = resolveLiveDesignerDropTarget(
      document,
      source,
      hit?.nodeId ?? null,
      pointerYInSurface,
      hitOutline?.rect ?? null,
    );

    if (!liveDesignerDropTargetsEqual(dropTargetRef.current, nextTarget)) {
      dropTargetRef.current = nextTarget;
    }

    if (nextTarget) {
      const anchorOutline = resolveOutline(nextTarget.anchorNodeId);
      if (!anchorOutline) {
        setDropIndicator(null);
        return;
      }
      setDropIndicator(measureLiveDesignerDropIndicator(nextTarget.placement, anchorOutline.rect));
      return;
    }

    if (hitOutline) {
      setDropIndicator(measureLiveDesignerInvalidIndicator(hitOutline.rect));
      return;
    }

    setDropIndicator(null);
  }, [document, resolveOutline]);

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isInspect || contextMenu || event.button !== 0) {
      return;
    }

    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    if ((event.target as Element | null)?.closest?.('[data-testid="live-designer-layout-chrome"]')) {
      dragRef.current = null;
      return;
    }

    const hit = hitTestLiveDesignerNode(event.clientX, event.clientY, overlay);
    if (!hit || hit.nodeId === rootNodeId) {
      dragRef.current = null;
      return;
    }

    dragRef.current = {
      nodeId: hit.nodeId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      suppressClick: false,
    };
  }, [contextMenu, isInspect, rootNodeId]);

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isInspect || contextMenu) {
      return;
    }

    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    const session = dragRef.current;
    if (session) {
      const dx = event.clientX - session.startX;
      const dy = event.clientY - session.startY;
      if (!session.active && (Math.abs(dx) >= DRAG_THRESHOLD_PX || Math.abs(dy) >= DRAG_THRESHOLD_PX)) {
        session.active = true;
        session.suppressClick = true;
        if (!overlaySelectionLockRef.current) {
          acquireLiveDesignerDragSelectionLock();
          overlaySelectionLockRef.current = true;
        }
        setDraggingNodeId(session.nodeId);
        onSelectNodeId(session.nodeId);
        onHoverNodeIdChange(session.nodeId);
        setHoverOutline(null);
        try {
          overlay.setPointerCapture(event.pointerId);
        } catch {
          // ignore capture failures
        }
      }

      if (session.active) {
        const node = document.nodes[session.nodeId];
        const label = node
          ? resolveOutlinePrimaryLabel(node)
          : 'Move';
        updateDropFromPoint(event.clientX, event.clientY, { kind: 'node', nodeId: session.nodeId }, label);
        return;
      }
    }

    const hit = hitTestLiveDesignerNode(event.clientX, event.clientY, overlay);
    const effectiveId = hit?.nodeId ?? null;
    onHoverNodeIdChange(effectiveId);

    if (!effectiveId || !hit) {
      setHoverOutline(null);
      return;
    }

    const surface = overlay.parentElement;
    if (!surface) {
      setHoverOutline(null);
      return;
    }

    const rect = measureLiveDesignerNodeHost(hit.host, surface);
    setHoverOutline(rect ? { nodeId: effectiveId, rect } : null);
  }, [contextMenu, document.nodes, isInspect, onHoverNodeIdChange, onSelectNodeId, updateDropFromPoint]);

  const endDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    const session = dragRef.current;
    dragRef.current = null;

    if (overlay && overlay.hasPointerCapture(event.pointerId)) {
      overlay.releasePointerCapture(event.pointerId);
    }

    if (!session?.active) {
      clearDragVisuals();
      return;
    }

    const target = dropTargetRef.current;
    clearDragVisuals();

    if (!target) {
      return;
    }

    if (isLiveDesignerNoOpMove(document, session.nodeId, target.parentId, target.index)) {
      onSelectNodeId(session.nodeId);
      return;
    }

    onMoveNode(session.nodeId, target.parentId, target.index);
    onSelectNodeId(session.nodeId);
  }, [clearDragVisuals, document, onMoveNode, onSelectNodeId]);

  const handlePointerLeave = React.useCallback(() => {
    if (!isInspect || contextMenu || dragRef.current?.active) {
      return;
    }
    onHoverNodeIdChange(null);
    setHoverOutline(null);
  }, [contextMenu, isInspect, onHoverNodeIdChange]);

  const handleExternalDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!isInspect || !hasLiveDesignerExternalDragType(event.dataTransfer.types)) {
      return;
    }

    const source = sourceFromExternalDrag();
    const drag = getLiveDesignerExternalDrag();
    if (!source || !drag) {
      return;
    }

    event.preventDefault();
    setExternalDragActive(true);
    updateDropFromPoint(event.clientX, event.clientY, source, drag.label);
    event.dataTransfer.dropEffect = dropTargetRef.current
      ? (source.kind === 'palette' ? 'copy' : 'move')
      : 'none';
  }, [isInspect, updateDropFromPoint]);

  const handleExternalDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    const related = event.relatedTarget;
    if (overlay && related instanceof Node && overlay.contains(related)) {
      return;
    }
    dropTargetRef.current = null;
    setDropIndicator(null);
    setDragGhost(null);
    setExternalDragActive(false);
  }, []);

  const handleExternalDrop = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!isInspect) {
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
      onInsertPaletteItem?.(drag.itemId, target.parentId, target.index);
      return;
    }

    if (drag.nodeId === rootNodeId || isLiveDesignerNoOpMove(document, drag.nodeId, target.parentId, target.index)) {
      onSelectNodeId(drag.nodeId);
      return;
    }

    onMoveNode(drag.nodeId, target.parentId, target.index);
    onSelectNodeId(drag.nodeId);
  }, [clearDragVisuals, document, isInspect, onInsertPaletteItem, onMoveNode, onSelectNodeId, rootNodeId]);

  React.useEffect(() => {
    const onDragEnd = () => {
      if (dragRef.current?.active) {
        return;
      }
      clearDragVisuals();
    };
    window.addEventListener('dragend', onDragEnd);
    return () => window.removeEventListener('dragend', onDragEnd);
  }, [clearDragVisuals]);

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isInspect) {
      return;
    }

    if (dragRef.current?.suppressClick) {
      dragRef.current = null;
      return;
    }

    if (contextMenu) {
      setContextMenu(null);
      return;
    }

    if (event.detail > 1) {
      return;
    }

    if ((event.target as Element | null)?.closest?.('[data-testid="live-designer-layout-chrome"]')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    const hit = hitTestLiveDesignerNode(event.clientX, event.clientY, overlay);
    if (!hit) {
      onSelectNodeId(null);
      return;
    }

    onSelectNodeId(hit.nodeId);
  }, [contextMenu, isInspect, onSelectNodeId]);

  const handleDoubleClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isInspect || draggingNodeId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);

    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    const hit = hitTestLiveDesignerNode(event.clientX, event.clientY, overlay);
    if (!hit) {
      return;
    }

    onSelectNodeId(hit.nodeId);
    onHoverNodeIdChange(hit.nodeId);
    onOpenProperties?.(hit.nodeId);
  }, [draggingNodeId, isInspect, onHoverNodeIdChange, onOpenProperties, onSelectNodeId]);

  const handleContextMenu = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isInspect || draggingNodeId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    const hit = hitTestLiveDesignerNode(event.clientX, event.clientY, overlay);
    if (!hit) {
      setContextMenu(null);
      onSelectNodeId(null);
      return;
    }

    onSelectNodeId(hit.nodeId);
    onHoverNodeIdChange(hit.nodeId);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: hit.nodeId,
    });
  }, [draggingNodeId, isInspect, onHoverNodeIdChange, onSelectNodeId]);

  const isDragging = Boolean(draggingNodeId || externalDragActive);
  const dropInvalid = dropIndicator?.kind === 'invalid';
  const liveHoverOutline = liveDesignerOutlineNodeExists(hoverOutline?.nodeId, document.nodes)
    ? hoverOutline
    : null;
  const liveSelectedOutlines = selectedOutlines.filter((outline) => (
    liveDesignerOutlineNodeExists(outline.nodeId, document.nodes)
    && outline.rect.width > 0
    && outline.rect.height > 0
  ));
  const selectedIdSet = new Set(liveSelectedOutlines.map((outline) => outline.nodeId));
  const liveSelectedOutline = liveSelectedOutlines.find((outline) => outline.nodeId === selectedNodeId)
    ?? liveSelectedOutlines[0]
    ?? null;
  const showHover = isInspect
    && !isDragging
    && !contextMenu
    && liveHoverOutline
    && !selectedIdSet.has(liveHoverOutline.nodeId)
    && liveHoverOutline.rect.width > 0
    && liveHoverOutline.rect.height > 0;

  const chromeSourceId = isInspect && !isDragging && !contextMenu
    ? (liveHoverOutline?.nodeId ?? liveSelectedOutline?.nodeId ?? null)
    : null;
  const layoutHint = chromeSourceId
    ? resolveLayoutStructureHint(document.nodes, chromeSourceId, { includeNestedPieces: true })
    : null;
  const layoutChromeNodeId = layoutHint
    ? (layoutHint.hoveredChildId ?? layoutHint.hostNodeId)
    : null;
  const layoutChromeOutline = layoutChromeNodeId
    ? (
      (liveHoverOutline?.nodeId === layoutChromeNodeId ? liveHoverOutline : null)
      ?? (liveSelectedOutline?.nodeId === layoutChromeNodeId ? liveSelectedOutline : null)
      ?? resolveOutline(layoutChromeNodeId)
    )
    : null;
  const showLayoutChrome = Boolean(
    onAddLayoutTrack
    && layoutHint
    && layoutChromeOutline
    && layoutChromeOutline.rect.width > 0
    && layoutChromeOutline.rect.height > 0
    && (layoutHint.canAddColumn || layoutHint.canAddRow),
  );

  return (
    <>
      <div
        ref={overlayRef}
        className={cn(
          'absolute inset-0 z-[5] select-none',
          !isInspect && 'pointer-events-none',
          isInspect && isDragging && (dropInvalid ? 'cursor-not-allowed' : 'cursor-grabbing'),
          isInspect && !isDragging && (liveHoverOutline ? 'cursor-grab' : 'cursor-crosshair'),
        )}
        data-testid="live-designer-selection-overlay"
        data-interaction-mode={interactionMode}
        data-dragging={isDragging ? 'true' : 'false'}
        onPointerDown={isInspect ? handlePointerDown : undefined}
        onPointerMove={isInspect ? handlePointerMove : undefined}
        onPointerUp={isInspect ? endDrag : undefined}
        onPointerCancel={isInspect ? endDrag : undefined}
        onPointerLeave={isInspect ? handlePointerLeave : undefined}
        onDragOver={isInspect ? handleExternalDragOver : undefined}
        onDragLeave={isInspect ? handleExternalDragLeave : undefined}
        onDrop={isInspect ? handleExternalDrop : undefined}
        onClick={isInspect ? handleClick : undefined}
        onDoubleClick={isInspect ? handleDoubleClick : undefined}
        onContextMenu={isInspect ? handleContextMenu : undefined}
      >
        {showHover && liveHoverOutline ? (
          <div
            aria-hidden
            className="pointer-events-none absolute border border-dashed border-cyan-400/90 bg-cyan-400/5"
            style={{
              top: liveHoverOutline.rect.top,
              left: liveHoverOutline.rect.left,
              width: liveHoverOutline.rect.width,
              height: liveHoverOutline.rect.height,
            }}
            data-testid="live-designer-hover-outline"
          />
        ) : null}

        {isInspect
          ? liveSelectedOutlines.map((outline) => (
            <div
              key={outline.nodeId}
              aria-hidden
              className={cn(
                'pointer-events-none absolute border-2 border-cyan-500 bg-cyan-500/5',
                'shadow-[0_0_0_1px_rgba(6,182,212,0.25)]',
                draggingNodeId === outline.nodeId && 'opacity-40',
              )}
              style={{
                top: outline.rect.top,
                left: outline.rect.left,
                width: outline.rect.width,
                height: outline.rect.height,
              }}
              data-testid="live-designer-selected-outline"
              data-node-id={outline.nodeId}
            />
          ))
          : null}

        {showLayoutChrome && layoutHint && layoutChromeOutline && layoutChromeNodeId ? (
          <LiveDesignerLayoutChrome
            rect={layoutChromeOutline.rect}
            hint={layoutHint}
            onAddTrack={(axis, place) => {
              onAddLayoutTrack?.(layoutChromeNodeId, axis, place);
            }}
          />
        ) : null}

        {dropIndicator ? <LiveDesignerDropMarker indicator={dropIndicator} /> : null}
        {dragGhost && draggingNodeId ? (
          <LiveDesignerDragGhost label={dragGhost.label} x={dragGhost.x} y={dragGhost.y} />
        ) : null}
      </div>

      {isInspect ? (
        <LiveDesignerContextMenu
          menu={contextMenu}
          canDelete={Boolean(contextMenu && contextMenu.nodeId !== rootNodeId)}
          canDuplicate={Boolean(contextMenu && contextMenu.nodeId !== rootNodeId)}
          canCopy={Boolean(contextMenu && contextMenu.nodeId !== rootNodeId)}
          canPaste={canPaste}
          onClose={() => setContextMenu(null)}
          onAction={onContextAction}
        />
      ) : null}
    </>
  );
};
