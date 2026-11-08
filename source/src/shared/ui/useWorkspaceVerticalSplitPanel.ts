import { useCallback, useRef, useState } from 'react';
import type { WorkspaceVerticalSplitHandleProps, WorkspaceVerticalSplitHandleSide } from './WorkspaceVerticalSplitHandle';
import { WORKSPACE_SPLIT_COLLAPSED_WIDTH_PX } from './WorkspaceVerticalSplitHandle';
import {
  beginWorkspaceSplitMouseDrag,
  beginWorkspaceSplitPointerDrag,
} from './workspaceSplitDragSession';
import {
  clampWorkspaceSplitSize,
  persistWorkspaceSplitSizeState,
  readWorkspaceSplitSizeState,
  type WorkspaceSplitPanelKey,
  type WorkspaceSplitSizeState,
} from './workspaceSplitStorage';

export type WorkspaceVerticalSplitMeasure = 'leading' | 'trailing';

export type UseWorkspaceVerticalSplitPanelOptions = {
  panelKey: WorkspaceSplitPanelKey;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  measure: WorkspaceVerticalSplitMeasure;
  containerRef: React.RefObject<HTMLElement | null>;
  side: WorkspaceVerticalSplitHandleSide;
  defaultCollapsed?: boolean;
  collapsedThreshold?: number;
  collapsible?: boolean;
  persist?: boolean;
  displayClassName?: string;
};

function resolveEffectiveSize(state: WorkspaceSplitSizeState, collapsedThreshold: number): number {
  if (state.collapsed || state.size <= collapsedThreshold) {
    return 0;
  }
  return state.size;
}

function normalizeSizeState(
  state: WorkspaceSplitSizeState,
  minSize: number,
  maxSize: number,
  collapsedThreshold: number,
): WorkspaceSplitSizeState {
  const expandedSize = clampWorkspaceSplitSize(state.expandedSize || state.size, minSize, maxSize);
  const collapsed = state.collapsed || state.size <= collapsedThreshold;
  const size = collapsed
    ? 0
    : clampWorkspaceSplitSize(state.size || expandedSize, minSize, maxSize);

  return {
    size,
    collapsed,
    expandedSize,
  };
}

export function useWorkspaceVerticalSplitPanel({
  panelKey,
  defaultSize,
  minSize,
  maxSize,
  measure,
  containerRef,
  side,
  defaultCollapsed = false,
  collapsedThreshold = WORKSPACE_SPLIT_COLLAPSED_WIDTH_PX,
  collapsible = true,
  persist = true,
  displayClassName,
}: UseWorkspaceVerticalSplitPanelOptions) {
  const [state, setState] = useState<WorkspaceSplitSizeState>(() => normalizeSizeState(
    readWorkspaceSplitSizeState(panelKey, {
      size: defaultCollapsed ? 0 : defaultSize,
      collapsed: defaultCollapsed,
      expandedSize: defaultSize,
    }),
    minSize,
    maxSize,
    collapsedThreshold,
  ));
  const [isResizing, setIsResizing] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const commitState = useCallback((next: WorkspaceSplitSizeState) => {
    const normalized = normalizeSizeState(next, minSize, maxSize, collapsedThreshold);
    stateRef.current = normalized;
    setState(normalized);
    if (persist) {
      persistWorkspaceSplitSizeState(panelKey, normalized);
    }
    return normalized;
  }, [collapsedThreshold, maxSize, minSize, panelKey, persist]);

  const collapsed = state.collapsed || state.size <= collapsedThreshold;
  const size = resolveEffectiveSize(state, collapsedThreshold);

  const toggle = useCallback(() => {
    if (!collapsible) {
      return;
    }

    const current = stateRef.current;
    const isCollapsed = current.collapsed || current.size <= collapsedThreshold;
    if (!isCollapsed && current.size > collapsedThreshold) {
      commitState({
        size: 0,
        collapsed: true,
        expandedSize: current.size,
      });
      return;
    }

    const restored = current.expandedSize > collapsedThreshold
      ? current.expandedSize
      : defaultSize;
    commitState({
      size: restored,
      collapsed: false,
      expandedSize: restored,
    });
  }, [collapsible, collapsedThreshold, commitState, defaultSize]);

  const resolveDraggedSize = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }

    const rect = container.getBoundingClientRect();
    const raw = measure === 'leading'
      ? clientX - rect.left
      : rect.right - clientX;
    return clampWorkspaceSplitSize(raw, minSize, maxSize);
  }, [containerRef, maxSize, measure, minSize]);

  const startDrag = useCallback((clientX: number) => {
    const nextSize = resolveDraggedSize(clientX);
    if (nextSize === null) {
      return;
    }

    commitState({
      size: nextSize,
      collapsed: false,
      expandedSize: nextSize,
    });
  }, [commitState, resolveDraggedSize]);

  const applyDragX = useCallback((clientX: number) => {
    const nextSize = resolveDraggedSize(clientX);
    if (nextSize === null) {
      return;
    }
    setState(() => {
      const normalized = normalizeSizeState({
        size: nextSize,
        collapsed: false,
        expandedSize: nextSize,
      }, minSize, maxSize, collapsedThreshold);
      stateRef.current = normalized;
      return normalized;
    });
  }, [collapsedThreshold, maxSize, minSize, resolveDraggedSize]);

  const finishDrag = useCallback(() => {
    setIsResizing(false);
    if (persist) {
      persistWorkspaceSplitSizeState(panelKey, stateRef.current);
    }
  }, [panelKey, persist]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    startDrag(event.clientX);
    setIsResizing(true);

    beginWorkspaceSplitMouseDrag({
      onMove: (clientX) => applyDragX(clientX),
      onFinish: finishDrag,
    });
  }, [applyDragX, finishDrag, startDrag]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const captureElement = event.currentTarget;
    const pointerId = event.pointerId;
    startDrag(event.clientX);
    setIsResizing(true);

    beginWorkspaceSplitPointerDrag({
      pointerId,
      captureElement,
      onMove: (clientX) => applyDragX(clientX),
      onFinish: finishDrag,
    });
  }, [applyDragX, finishDrag, startDrag]);

  const splitHandleProps: WorkspaceVerticalSplitHandleProps = {
    side,
    collapsed,
    isResizing,
    onMouseDown: handleMouseDown,
    onPointerDown: handlePointerDown,
    onToggle: collapsible ? toggle : undefined,
    displayClassName,
  };

  return {
    size,
    collapsed,
    isResizing,
    toggle,
    handleMouseDown,
    handlePointerDown,
    splitHandleProps,
    setSize: (nextSize: number) => {
      commitState({
        size: nextSize,
        collapsed: nextSize <= collapsedThreshold,
        expandedSize: nextSize > collapsedThreshold ? nextSize : stateRef.current.expandedSize,
      });
    },
  };
}
