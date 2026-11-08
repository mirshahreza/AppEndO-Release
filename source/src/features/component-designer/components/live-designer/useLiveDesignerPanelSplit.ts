import * as React from 'react';
import type { WorkspaceVerticalSplitHandleProps, WorkspaceVerticalSplitHandleSide } from '../../../../shared/ui/WorkspaceVerticalSplitHandle';
import {
  beginWorkspaceSplitMouseDrag,
  beginWorkspaceSplitPointerDrag,
} from '../../../../shared/ui/workspaceSplitDragSession';
import {
  clampWorkspaceSplitSize,
  persistWorkspaceSplitSizeState,
  readWorkspaceSplitSizeState,
  type WorkspaceSplitPanelKey,
} from '../../../../shared/ui/workspaceSplitStorage';

export type UseLiveDesignerPanelSplitOptions = {
  panelKey: WorkspaceSplitPanelKey;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  /**
   * `start` — panel sits to the left of the handle (outline).
   * `end` — panel sits to the right of the handle (properties / code).
   */
  side: WorkspaceVerticalSplitHandleSide;
};

/**
 * Panel-local width split for Live Designer.
 * Uses pointer delta (not container-edge absolute measure) so multiple trailing
 * panels can resize independently when open together.
 */
export function useLiveDesignerPanelSplit({
  panelKey,
  defaultSize,
  minSize,
  maxSize,
  side,
}: UseLiveDesignerPanelSplitOptions) {
  const [size, setSize] = React.useState(() => {
    const stored = readWorkspaceSplitSizeState(panelKey, {
      size: defaultSize,
      collapsed: false,
      expandedSize: defaultSize,
    });
    const preferred = stored.collapsed
      ? (stored.expandedSize || defaultSize)
      : (stored.size || stored.expandedSize || defaultSize);
    return clampWorkspaceSplitSize(preferred, minSize, maxSize);
  });
  const [isResizing, setIsResizing] = React.useState(false);
  const sizeRef = React.useRef(size);
  sizeRef.current = size;

  const persistSize = React.useCallback((nextSize: number) => {
    const clamped = clampWorkspaceSplitSize(nextSize, minSize, maxSize);
    sizeRef.current = clamped;
    setSize(clamped);
    persistWorkspaceSplitSizeState(panelKey, {
      size: clamped,
      collapsed: false,
      expandedSize: clamped,
    });
    return clamped;
  }, [maxSize, minSize, panelKey]);

  const applyDelta = React.useCallback((deltaX: number) => {
    const signed = side === 'start' ? deltaX : -deltaX;
    const next = clampWorkspaceSplitSize(sizeRef.current + signed, minSize, maxSize);
    sizeRef.current = next;
    setSize(next);
  }, [maxSize, minSize, side]);

  const finishDrag = React.useCallback(() => {
    setIsResizing(false);
    persistWorkspaceSplitSizeState(panelKey, {
      size: sizeRef.current,
      collapsed: false,
      expandedSize: sizeRef.current,
    });
  }, [panelKey]);

  const handleMouseDown = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizing(true);
    let lastX = event.clientX;
    beginWorkspaceSplitMouseDrag({
      onMove: (clientX) => {
        applyDelta(clientX - lastX);
        lastX = clientX;
      },
      onFinish: finishDrag,
    });
  }, [applyDelta, finishDrag]);

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const captureElement = event.currentTarget;
    const pointerId = event.pointerId;
    setIsResizing(true);
    let lastX = event.clientX;
    beginWorkspaceSplitPointerDrag({
      pointerId,
      captureElement,
      onMove: (clientX) => {
        applyDelta(clientX - lastX);
        lastX = clientX;
      },
      onFinish: finishDrag,
    });
  }, [applyDelta, finishDrag]);

  const splitHandleProps: WorkspaceVerticalSplitHandleProps = {
    side,
    collapsed: false,
    isResizing,
    onMouseDown: handleMouseDown,
    onPointerDown: handlePointerDown,
    displayClassName: 'block',
    title: 'Drag to resize panel',
  };

  return {
    size,
    isResizing,
    setSize: persistSize,
    splitHandleProps,
  };
}
