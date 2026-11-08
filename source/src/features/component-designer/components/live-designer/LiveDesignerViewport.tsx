import * as React from 'react';
import { FoldVertical, UnfoldVertical } from 'lucide-react';
import type { DesignerCanvasFillMode, DesignerDocument } from '../../../../domain/component-designer/types';
import { cn } from '../../../../lib/utils';
import { CANVAS_STAGE_CLASS, SHADOW_RAISED } from '../../../../shared/ui/surfaceClasses';
import { pageGuideLocalProps } from '../../../../shared/ui/shell/pageGuide/pageGuideChrome';
import type { LiveDesignerContextMenuAction } from './LiveDesignerContextMenu';
import type { LiveDesignerInteractionMode } from './liveDesignerInteractionMode';
import { LiveDesignerSelectionOverlay } from './LiveDesignerSelectionOverlay';

const MIN_VIEWPORT_WIDTH = 320;
const MIN_VIEWPORT_HEIGHT = 240;
const DEFAULT_VIEWPORT_WIDTH = 1280;
const DEFAULT_VIEWPORT_HEIGHT = 800;

export type LiveDesignerViewportSize = {
  width: number;
  height: number;
};

export type LiveDesignerViewportProps = {
  children: React.ReactNode;
  className?: string;
  width?: number;
  height?: number;
  fillMode?: DesignerCanvasFillMode;
  onSizeChange?: (size: LiveDesignerViewportSize) => void;
  onFillModeChange?: (fillMode: DesignerCanvasFillMode) => void;
  selectedNodeId?: string | null;
  selectedNodeIds?: string[];
  rootNodeId?: string | null;
  document?: DesignerDocument | null;
  documentRevision?: string | number | null;
  interactionMode?: LiveDesignerInteractionMode;
  onHoverNodeIdChange?: (nodeId: string | null) => void;
  onSelectNodeId?: (nodeId: string | null) => void;
  onOpenProperties?: (nodeId: string) => void;
  onContextAction?: (action: LiveDesignerContextMenuAction, nodeId: string) => void;
  onMoveNode?: (nodeId: string, targetParentId: string, index?: number) => boolean;
  onInsertPaletteItem?: (itemId: string, parentId: string, index?: number) => boolean;
  onAddLayoutTrack?: (nodeId: string, axis: 'row' | 'column', place: 'before' | 'after') => void;
  canPaste?: boolean;
};

function clampSize(width: number, height: number): LiveDesignerViewportSize {
  return {
    width: Math.max(MIN_VIEWPORT_WIDTH, Math.round(width)),
    height: Math.max(MIN_VIEWPORT_HEIGHT, Math.round(height)),
  };
}

export const LiveDesignerViewport: React.FC<LiveDesignerViewportProps> = ({
  children,
  className,
  width = DEFAULT_VIEWPORT_WIDTH,
  height = DEFAULT_VIEWPORT_HEIGHT,
  fillMode = 'manual',
  onSizeChange,
  onFillModeChange,
  selectedNodeId = null,
  selectedNodeIds = [],
  rootNodeId = null,
  document = null,
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
  const [size, setSize] = React.useState<LiveDesignerViewportSize>(() => (
    clampSize(width, height)
  ));
  const [isResizing, setIsResizing] = React.useState(false);
  const [isHoveringResize, setIsHoveringResize] = React.useState(false);
  const sizeRef = React.useRef(size);
  sizeRef.current = size;
  const frameRef = React.useRef<HTMLDivElement>(null);
  const onSizeChangeRef = React.useRef(onSizeChange);
  onSizeChangeRef.current = onSizeChange;
  const onFillModeChangeRef = React.useRef(onFillModeChange);
  onFillModeChangeRef.current = onFillModeChange;
  const dragRef = React.useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const fillHeight = fillMode === 'fill-height' || fillMode === 'fill-both';
  const fillingLayout = fillHeight && !isResizing;

  React.useEffect(() => {
    if (isResizing) {
      return;
    }
    if (fillHeight) {
      setSize((current) => clampSize(width, current.height));
      return;
    }
    setSize(clampSize(width, height));
  }, [fillHeight, height, isResizing, width]);

  React.useEffect(() => {
    if (!isResizing) {
      return;
    }
    const next = clampSize(width, height);
    if (next.width === sizeRef.current.width && next.height === sizeRef.current.height) {
      setIsResizing(false);
    }
  }, [height, isResizing, width]);

  React.useEffect(() => {
    if (!fillingLayout || typeof ResizeObserver === 'undefined') {
      return;
    }

    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const contentRect = entries[0]?.contentRect;
      if (!contentRect) {
        return;
      }
      const next = clampSize(sizeRef.current.width, contentRect.height);
      const current = sizeRef.current;
      if (next.width === current.width && next.height === current.height) {
        return;
      }
      setSize(next);
      onSizeChangeRef.current?.(next);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [fillingLayout]);

  const showSizeLabel = isResizing || isHoveringResize || fillHeight;
  const selectionEnabled = Boolean(
    document
    && onHoverNodeIdChange
    && onSelectNodeId
    && onContextAction
    && onMoveNode,
  );

  const beginCornerResize = React.useCallback((clientX: number, clientY: number) => {
    if (fillHeight) {
      onFillModeChangeRef.current?.('manual');
    }
    const frame = frameRef.current;
    const measuredHeight = frame?.offsetHeight ?? 0;
    const startWidth = size.width;
    const startHeight = fillHeight && measuredHeight > 0 ? measuredHeight : size.height;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startWidth,
      startHeight,
    };
    setSize(clampSize(startWidth, startHeight));
    setIsResizing(true);
  }, [fillHeight, size.height, size.width]);

  const handleCornerPointerDown = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    beginCornerResize(event.clientX, event.clientY);
  }, [beginCornerResize]);

  const handleCornerPointerMove = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) {
      return;
    }

    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;
    setSize(clampSize(
      dragRef.current.startWidth + deltaX,
      dragRef.current.startHeight + deltaY,
    ));
  }, []);

  const endCornerResize = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) {
      return;
    }

    dragRef.current = null;
    const next = sizeRef.current;
    if (onSizeChangeRef.current) {
      onSizeChangeRef.current(next);
    } else {
      setIsResizing(false);
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleToggleFill = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onFillModeChangeRef.current?.(fillHeight ? 'manual' : 'fill-height');
  }, [fillHeight]);

  const fillToggleLabel = fillHeight ? 'Restore canvas height' : 'Fill canvas height 100%';

  return (
    <div
      className={cn(
        'absolute inset-0 flex min-h-0 min-w-0 flex-col p-3',
        CANVAS_STAGE_CLASS,
        fillingLayout ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto',
        className,
      )}
      data-testid="live-designer-canvas-stage"
    >
      <div
        ref={frameRef}
        className={cn(
          'relative min-h-0 overflow-hidden rounded-none border border-dashed border-slate-400/70 bg-white',
          SHADOW_RAISED,
          fillingLayout ? 'h-full max-h-full self-start' : 'self-start',
        )}
        style={{ width: size.width, height: fillingLayout ? undefined : size.height }}
        data-testid="live-designer-viewport"
        data-width={size.width}
        data-height={size.height}
        data-fill={fillHeight ? 'height' : 'manual'}
      >
        <div className="relative h-full min-h-0 w-full overflow-hidden">
          {children}
          {selectionEnabled && document ? (
            <LiveDesignerSelectionOverlay
              selectedNodeId={selectedNodeId}
              selectedNodeIds={selectedNodeIds}
              rootNodeId={rootNodeId}
              document={document}
              documentRevision={documentRevision}
              interactionMode={interactionMode}
              onHoverNodeIdChange={onHoverNodeIdChange!}
              onSelectNodeId={onSelectNodeId!}
              onOpenProperties={onOpenProperties}
              onContextAction={onContextAction!}
              onMoveNode={onMoveNode!}
              onInsertPaletteItem={onInsertPaletteItem}
              onAddLayoutTrack={onAddLayoutTrack}
              canPaste={canPaste}
            />
          ) : null}
        </div>

        <div
          className="absolute bottom-0 right-0 z-10 flex flex-col items-end"
          onMouseEnter={() => setIsHoveringResize(true)}
          onMouseLeave={() => {
            if (!isResizing) {
              setIsHoveringResize(false);
            }
          }}
        >
          {showSizeLabel ? (
            <span
              aria-label="Viewport size"
              className="mb-0.5 rounded-md border border-slate-200 bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm whitespace-nowrap"
            >
              <span>{size.width}px</span>
              <span className="mx-0.5 text-slate-400">x</span>
              {fillHeight ? (
                <span>100%</span>
              ) : (
                <span>{size.height}px</span>
              )}
            </span>
          ) : null}
          <div className="flex items-end">
            <button
              type="button"
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-none border border-slate-300 bg-white/90 text-slate-500 hover:bg-cyan-50 hover:text-cyan-700',
                fillHeight ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : '',
              )}
              aria-label={fillToggleLabel}
              aria-pressed={fillHeight}
              title={fillToggleLabel}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={handleToggleFill}
              {...pageGuideLocalProps(
                'Canvas height 100%',
                'Fills the canvas height to the designer area. Width stays fixed. Click again to restore the last height.',
                21,
              )}
            >
              {fillHeight
                ? <FoldVertical className="h-3 w-3" strokeWidth={2.25} />
                : <UnfoldVertical className="h-3 w-3" strokeWidth={2.25} />}
            </button>
            <button
              type="button"
              className="h-4 w-4 cursor-se-resize rounded-none border border-s-0 border-slate-300 bg-white/90 text-slate-500 hover:bg-cyan-50 hover:text-cyan-700"
              aria-label="Resize viewport from bottom-right corner"
              onPointerDown={handleCornerPointerDown}
              onPointerMove={handleCornerPointerMove}
              onPointerUp={endCornerResize}
              onPointerCancel={endCornerResize}
            >
              <span className="pointer-events-none block text-[9px] leading-none">\\</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
