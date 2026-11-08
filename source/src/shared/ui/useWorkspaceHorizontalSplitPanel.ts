import { useCallback, useRef, useState } from 'react';
import type { WorkspaceHorizontalSplitHandleProps } from './WorkspaceHorizontalSplitHandle';
import { beginWorkspaceSplitMouseDrag } from './workspaceSplitDragSession';
import {
  clampWorkspaceSplitSize,
  persistWorkspaceSplitSizeState,
  readWorkspaceSplitSizeState,
  type WorkspaceSplitPanelKey,
  type WorkspaceSplitSizeState,
} from './workspaceSplitStorage';

export type WorkspaceHorizontalSplitMeasure = 'leading' | 'trailing';

export type UseWorkspaceHorizontalSplitPanelOptions = {
  panelKey: WorkspaceSplitPanelKey;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  measure: WorkspaceHorizontalSplitMeasure;
  containerRef: React.RefObject<HTMLElement | null>;
  resolveSize?: (input: { clientY: number; rect: DOMRect }) => number;
  persist?: boolean;
  displayClassName?: string;
};

function normalizeHeightState(
  state: WorkspaceSplitSizeState,
  minSize: number,
  maxSize: number,
): WorkspaceSplitSizeState {
  const expandedSize = clampWorkspaceSplitSize(state.expandedSize || state.size, minSize, maxSize);
  const size = clampWorkspaceSplitSize(state.size || expandedSize, minSize, maxSize);

  return {
    size,
    collapsed: false,
    expandedSize,
  };
}

export function useWorkspaceHorizontalSplitPanel({
  panelKey,
  defaultSize,
  minSize,
  maxSize,
  measure,
  containerRef,
  resolveSize,
  persist = true,
  displayClassName,
}: UseWorkspaceHorizontalSplitPanelOptions) {
  const [state, setState] = useState<WorkspaceSplitSizeState>(() => normalizeHeightState(
    readWorkspaceSplitSizeState(panelKey, {
      size: defaultSize,
      collapsed: false,
      expandedSize: defaultSize,
    }),
    minSize,
    maxSize,
  ));
  const [isResizing, setIsResizing] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const commitState = useCallback((next: WorkspaceSplitSizeState) => {
    const normalized = normalizeHeightState(next, minSize, maxSize);
    stateRef.current = normalized;
    setState(normalized);
    if (persist) {
      persistWorkspaceSplitSizeState(panelKey, normalized);
    }
    return normalized;
  }, [maxSize, minSize, panelKey, persist]);

  const resolveDraggedSize = useCallback((clientY: number) => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }

    const rect = container.getBoundingClientRect();
    if (resolveSize) {
      return clampWorkspaceSplitSize(resolveSize({ clientY, rect }), minSize, maxSize);
    }

    const raw = measure === 'leading'
      ? clientY - rect.top
      : rect.bottom - clientY;
    return clampWorkspaceSplitSize(raw, minSize, maxSize);
  }, [containerRef, maxSize, measure, minSize, resolveSize]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const applyDrag = (clientY: number) => {
      const nextSize = resolveDraggedSize(clientY);
      if (nextSize === null) {
        return;
      }
      setState(() => {
        const normalized = normalizeHeightState({
          size: nextSize,
          collapsed: false,
          expandedSize: nextSize,
        }, minSize, maxSize);
        stateRef.current = normalized;
        return normalized;
      });
    };

    applyDrag(event.clientY);
    setIsResizing(true);

    beginWorkspaceSplitMouseDrag({
      onMove: (_clientX, clientY) => applyDrag(clientY),
      onFinish: () => {
        setIsResizing(false);
        if (persist) {
          persistWorkspaceSplitSizeState(panelKey, stateRef.current);
        }
      },
    });
  }, [maxSize, minSize, panelKey, persist, resolveDraggedSize]);

  const splitHandleProps: WorkspaceHorizontalSplitHandleProps = {
    isResizing,
    onMouseDown: handleMouseDown,
    displayClassName,
  };

  return {
    size: state.size,
    isResizing,
    handleMouseDown,
    splitHandleProps,
    setSize: (nextSize: number) => {
      commitState({
        size: nextSize,
        collapsed: false,
        expandedSize: nextSize,
      });
    },
  };
}
