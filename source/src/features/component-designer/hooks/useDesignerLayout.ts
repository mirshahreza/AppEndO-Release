import * as React from 'react';
import {
  useWorkspaceSplitRatioPanel,
  useWorkspaceVerticalSplitPanel,
  WORKSPACE_SPLIT_PANEL_KEYS,
} from '../../../shared/ui';
import type { DesignerAction, DesignerState } from '../../../domain/component-designer/types';

export type UseDesignerLayoutParams = {
  state: DesignerState;
  dispatch: React.Dispatch<DesignerAction>;
};

export type UseDesignerLayoutResult = {
  isCompactLayout: boolean;
  compactPanels: { palette: boolean; inspector: boolean };
  setCompactPanels: React.Dispatch<React.SetStateAction<{ palette: boolean; inspector: boolean }>>;
  paletteWidth: number;
  inspectorWidth: number;
  isCodeColumnVisible: boolean;
  isInspectorColumnVisible: boolean;
  designSplitRatio: number;
  isCodePanelCollapsed: boolean;
  isResizingPalette: boolean;
  isResizingInspector: boolean;
  isResizingDesignSplit: boolean;
  viewportClassName: string;
  showPalette: boolean;
  showDesign: boolean;
  showCode: boolean;
  showInspector: boolean;
  showDesktopDesignCodeSplit: boolean;
  shouldRenderCodePanel: boolean;
  desktopLayoutRef: React.RefObject<HTMLDivElement | null>;
  middleLayoutRef: React.RefObject<HTMLDivElement | null>;
  togglePalettePanel: () => void;
  toggleInspectorPanel: () => void;
  toggleCodePanel: () => void;
  toggleCodeColumnVisibility: () => void;
  toggleInspectorColumnVisibility: () => void;
  openInspectorForNode: (nodeId: string) => void;
  paletteSplitHandleProps: ReturnType<typeof useWorkspaceVerticalSplitPanel>['splitHandleProps'];
  inspectorSplitHandleProps: ReturnType<typeof useWorkspaceVerticalSplitPanel>['splitHandleProps'];
  designCodeSplitHandleProps: ReturnType<typeof useWorkspaceSplitRatioPanel>['splitHandleProps'];
};

export const useDesignerLayout = ({
  state,
  dispatch,
}: UseDesignerLayoutParams): UseDesignerLayoutResult => {
  const [isCompactLayout, setIsCompactLayout] = React.useState(false);
  const [compactPanels, setCompactPanels] = React.useState({
    palette: true,
    inspector: false,
  });
  const [isCodeColumnVisible, setIsCodeColumnVisible] = React.useState(false);
  const [isInspectorColumnVisible, setIsInspectorColumnVisible] = React.useState(false);

  const desktopLayoutRef = React.useRef<HTMLDivElement | null>(null);
  const middleLayoutRef = React.useRef<HTMLDivElement | null>(null);

  const paletteSplit = useWorkspaceVerticalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.designerPalette,
    defaultSize: 300,
    minSize: 180,
    maxSize: 580,
    measure: 'leading',
    containerRef: desktopLayoutRef,
    side: 'start',
  });

  const inspectorSplit = useWorkspaceVerticalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.designerInspector,
    defaultSize: 300,
    minSize: 220,
    maxSize: 520,
    measure: 'trailing',
    containerRef: desktopLayoutRef,
    side: 'end',
    defaultCollapsed: true,
  });

  const designCodeSplit = useWorkspaceSplitRatioPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.designerDesignCode,
    defaultRatio: 0.5,
    minLeadingPx: 40,
    minTrailingPx: 220,
    containerRef: middleLayoutRef,
    side: 'end',
    defaultCollapsed: true,
    collapsible: true,
  });

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setIsCompactLayout(false);
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 1279px)');
    const applyCompactMode = () => {
      setIsCompactLayout(mediaQuery.matches);
    };

    applyCompactMode();
    mediaQuery.addEventListener('change', applyCompactMode);
    return () => {
      mediaQuery.removeEventListener('change', applyCompactMode);
    };
  }, []);

  const viewportClassName =
    state.viewport.fillMode === 'fill-both'
      ? 'h-full w-full'
      : state.viewport.fillMode === 'fill-width'
        ? 'h-auto w-full'
        : state.viewport.fillMode === 'fill-height'
          ? 'h-full w-auto'
          : '';

  const showPalette = false;
  const showDesign = state.viewMode === 'design' || state.viewMode === 'split';
  const showCode = state.viewMode === 'code'
    || state.viewMode === 'split'
    || state.viewMode === 'nodetree'
    || (!isCompactLayout && isCodeColumnVisible);
  const showInspector = isCompactLayout ? compactPanels.inspector : isInspectorColumnVisible;
  const showDesktopDesignCodeSplit = !isCompactLayout && showDesign && showCode && isCodeColumnVisible;
  const shouldRenderCodePanel =
    showCode
    && (isCompactLayout || !showDesign || isCodeColumnVisible)
    && !(showDesktopDesignCodeSplit && designCodeSplit.collapsed);

  const toggleCodeColumnVisibility = React.useCallback(() => {
    if (isCodeColumnVisible) {
      setIsCodeColumnVisible(false);
      return;
    }

    setIsCodeColumnVisible(true);
    designCodeSplit.setCollapsed(false);
  }, [designCodeSplit, isCodeColumnVisible]);

  const toggleInspectorColumnVisibility = React.useCallback(() => {
    if (isInspectorColumnVisible) {
      setIsInspectorColumnVisible(false);
      return;
    }

    setIsInspectorColumnVisible(true);
    if (inspectorSplit.collapsed) {
      inspectorSplit.toggle();
    }
  }, [inspectorSplit, isInspectorColumnVisible]);

  const openInspectorForNode = React.useCallback((nodeId: string) => {
    dispatch({ type: 'select-node', nodeId });

    if (isCompactLayout) {
      setCompactPanels((previous) => ({ ...previous, inspector: true }));
      return;
    }

    setIsInspectorColumnVisible(true);
    if (inspectorSplit.collapsed) {
      inspectorSplit.toggle();
    }
  }, [dispatch, inspectorSplit, isCompactLayout]);

  return {
    isCompactLayout,
    compactPanels,
    setCompactPanels,
    paletteWidth: paletteSplit.size,
    inspectorWidth: inspectorSplit.size,
    isCodeColumnVisible,
    isInspectorColumnVisible,
    designSplitRatio: designCodeSplit.ratio,
    isCodePanelCollapsed: designCodeSplit.collapsed,
    isResizingPalette: paletteSplit.isResizing,
    isResizingInspector: inspectorSplit.isResizing,
    isResizingDesignSplit: designCodeSplit.isResizing,
    viewportClassName,
    showPalette,
    showDesign,
    showCode,
    showInspector,
    showDesktopDesignCodeSplit,
    shouldRenderCodePanel,
    desktopLayoutRef,
    middleLayoutRef,
    togglePalettePanel: paletteSplit.toggle,
    toggleInspectorPanel: inspectorSplit.toggle,
    toggleCodePanel: designCodeSplit.toggle,
    toggleCodeColumnVisibility,
    toggleInspectorColumnVisibility,
    openInspectorForNode,
    paletteSplitHandleProps: paletteSplit.splitHandleProps,
    inspectorSplitHandleProps: inspectorSplit.splitHandleProps,
    designCodeSplitHandleProps: designCodeSplit.splitHandleProps,
  };
};
