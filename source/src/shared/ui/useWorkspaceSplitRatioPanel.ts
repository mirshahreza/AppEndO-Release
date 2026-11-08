import { useCallback, useRef, useState } from 'react';
import type { WorkspaceVerticalSplitHandleProps, WorkspaceVerticalSplitHandleSide } from './WorkspaceVerticalSplitHandle';
import { beginWorkspaceSplitMouseDrag } from './workspaceSplitDragSession';
import {
  clampWorkspaceSplitRatio,
  persistWorkspaceSplitRatioState,
  readWorkspaceSplitRatioState,
  type WorkspaceSplitPanelKey,
  type WorkspaceSplitRatioState,
} from './workspaceSplitStorage';

export type UseWorkspaceSplitRatioPanelOptions = {
  panelKey: WorkspaceSplitPanelKey;
  defaultRatio: number;
  minLeadingPx: number;
  minTrailingPx: number;
  containerRef: React.RefObject<HTMLElement | null>;
  side?: WorkspaceVerticalSplitHandleSide;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  persist?: boolean;
  displayClassName?: string;
};

function normalizeRatioState(
  state: WorkspaceSplitRatioState,
  minRatio: number,
  maxRatio: number,
): WorkspaceSplitRatioState {
  const expandedRatio = clampWorkspaceSplitRatio(state.expandedRatio || state.ratio, minRatio, maxRatio);
  const ratio = state.collapsed
    ? expandedRatio
    : clampWorkspaceSplitRatio(state.ratio || expandedRatio, minRatio, maxRatio);

  return {
    ratio,
    collapsed: state.collapsed,
    expandedRatio,
  };
}

export function useWorkspaceSplitRatioPanel({
  panelKey,
  defaultRatio,
  minLeadingPx,
  minTrailingPx,
  containerRef,
  side = 'end',
  defaultCollapsed = false,
  collapsible = false,
  persist = true,
  displayClassName,
}: UseWorkspaceSplitRatioPanelOptions) {
  const [state, setState] = useState<WorkspaceSplitRatioState>(() => readWorkspaceSplitRatioState(panelKey, {
    ratio: defaultRatio,
    collapsed: defaultCollapsed,
    expandedRatio: defaultRatio,
  }));
  const [isResizing, setIsResizing] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const commitState = useCallback((next: WorkspaceSplitRatioState) => {
    const container = containerRef.current;
    const rectWidth = container?.getBoundingClientRect().width ?? 0;
    const minRatio = rectWidth > 0 ? minLeadingPx / rectWidth : 0;
    const maxRatio = rectWidth > 0 ? 1 - (minTrailingPx / rectWidth) : 1;
    const normalized = normalizeRatioState(next, minRatio, maxRatio);
    stateRef.current = normalized;
    setState(normalized);
    if (persist) {
      persistWorkspaceSplitRatioState(panelKey, normalized);
    }
    return normalized;
  }, [containerRef, minLeadingPx, minTrailingPx, panelKey, persist]);

  const resolveDraggedRatio = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) {
      return null;
    }

    const minRatio = minLeadingPx / rect.width;
    const maxRatio = 1 - (minTrailingPx / rect.width);
    if (maxRatio <= minRatio) {
      return clampWorkspaceSplitRatio(defaultRatio, minRatio, maxRatio);
    }

    const relativeX = clientX - rect.left;
    const clampedX = Math.max(minLeadingPx, Math.min(rect.width - minTrailingPx, relativeX));
    return clampedX / rect.width;
  }, [containerRef, defaultRatio, minLeadingPx, minTrailingPx]);

  const toggle = useCallback(() => {
    if (!collapsible) {
      return;
    }

    const current = stateRef.current;
    if (!current.collapsed) {
      commitState({
        ratio: current.ratio,
        collapsed: true,
        expandedRatio: current.ratio > 0 && current.ratio < 1 ? current.ratio : current.expandedRatio,
      });
      return;
    }

    const restored = current.expandedRatio > 0 && current.expandedRatio < 1
      ? current.expandedRatio
      : defaultRatio;
    commitState({
      ratio: restored,
      collapsed: false,
      expandedRatio: restored,
    });
  }, [collapsible, commitState, defaultRatio]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const applyDrag = (clientX: number) => {
      const nextRatio = resolveDraggedRatio(clientX);
      if (nextRatio === null) {
        return;
      }

      setState(() => {
        const container = containerRef.current;
        const rectWidth = container?.getBoundingClientRect().width ?? 0;
        const minRatio = rectWidth > 0 ? minLeadingPx / rectWidth : 0;
        const maxRatio = rectWidth > 0 ? 1 - (minTrailingPx / rectWidth) : 1;
        const normalized = normalizeRatioState({
          ratio: nextRatio,
          collapsed: false,
          expandedRatio: nextRatio,
        }, minRatio, maxRatio);
        stateRef.current = normalized;
        return normalized;
      });
    };

    applyDrag(event.clientX);
    setIsResizing(true);

    beginWorkspaceSplitMouseDrag({
      onMove: (clientX) => applyDrag(clientX),
      onFinish: () => {
        setIsResizing(false);
        if (persist) {
          persistWorkspaceSplitRatioState(panelKey, stateRef.current);
        }
      },
    });
  }, [containerRef, minLeadingPx, minTrailingPx, panelKey, persist, resolveDraggedRatio]);

  const splitHandleProps: WorkspaceVerticalSplitHandleProps = {
    side,
    collapsed: state.collapsed,
    isResizing,
    onMouseDown: handleMouseDown,
    onToggle: collapsible ? toggle : undefined,
    displayClassName,
  };

  return {
    ratio: state.ratio,
    collapsed: state.collapsed,
    isResizing,
    toggle,
    handleMouseDown,
    splitHandleProps,
    setRatio: (ratio: number) => {
      commitState({
        ratio,
        collapsed: false,
        expandedRatio: ratio,
      });
    },
    setCollapsed: (collapsed: boolean) => {
      const current = stateRef.current;
      commitState({
        ratio: current.ratio,
        collapsed,
        expandedRatio: current.expandedRatio,
      });
    },
  };
}
