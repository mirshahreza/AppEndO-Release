import * as React from 'react';
import type { DesignerCodeFormat } from '../../../domain/component-designer/codegen';
import { createInitialDesignerState, designerReducer } from '../../../domain/component-designer/state';
import type {
  DesignerAction,
  DesignerBindingDefinition,
  DesignerDiagnostic,
  DesignerNode,
  DesignerPaletteItem,
  DesignerState,
} from '../../../domain/component-designer/types';
import type { DesignerPreviewRuntimeState } from '../dialogs/types';
import type { OutlineTreeRow } from '../types';
import type { AppToastType } from '../../../shared/ui';

export type DesignerToast = { type: AppToastType; text: string };

const DESIGNER_TOAST_ERROR_PATTERN =
  /\b(fail|failed|error|errors|required|cannot|can't|rejected|invalid|not found|unable|denied|before|use only|issue|issues)\b/i;

const inferDesignerToastTone = (message: string): AppToastType =>
  (DESIGNER_TOAST_ERROR_PATTERN.test(message) ? 'error' : 'success');
import { useDesignerCode } from './useDesignerCode';
import { useDesignerInteractions } from './useDesignerInteractions';
import { useDesignerLayout, type UseDesignerLayoutResult } from './useDesignerLayout';
import { useDesignerOutline } from './useDesignerOutline';
import {
  useDesignerPalette,
  type ToolboxSize,
  type DesignerToolboxExpandableId,
  type DesignerToolboxGroup,
} from './useDesignerPalette';
import { useDesignerPreview } from './useDesignerPreview';
import type { DesignerPreviewContextState } from './useDesignerPreviewContext';
import type { DesignerCodeTab, DesignerDialogFlags } from './types';

export type UseDesignerStateParams = {
  getDialogFlags: () => DesignerDialogFlags;
  getPreviewPersistence?: () => {
    activeDraftId: string | null;
    hasUnsavedChanges: boolean;
  };
};

export type UseDesignerStateResult = {
  state: DesignerState;
  dispatch: React.Dispatch<DesignerAction>;
  paletteItems: DesignerPaletteItem[];
  paletteLoadError: string | null;
  activeCodeTab: DesignerCodeTab;
  setActiveCodeTab: React.Dispatch<React.SetStateAction<DesignerCodeTab>>;
  codeDraft: { tsx: string; tsxDirty: boolean };
  setCodeDraft: React.Dispatch<React.SetStateAction<{ tsx: string; tsxDirty: boolean }>>;
  setLastEditedFormat: React.Dispatch<React.SetStateAction<DesignerCodeFormat | null>>;
  resetCodeFromGenerated: () => void;
  loadCodeFromCompanionTsx: (
    tsx: string,
    snapshot?: {
      document: DesignerState['document'];
      bindingDefinitions: DesignerState['bindingDefinitions'];
    },
  ) => void;
  handleCodeTabKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  designerToast: DesignerToast | null;
  flashToolbarStatus: (message: string, tone?: AppToastType) => void;
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
  isToolboxOpen: boolean;
  setIsToolboxOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toolboxSearchQuery: string;
  setToolboxSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  toolboxPosition: { x: number; y: number };
  toolboxSize: ToolboxSize;
  toolboxMenuRef: React.RefObject<HTMLDivElement | null>;
  toolboxPanelRef: React.RefObject<HTMLDivElement | null>;
  handleOpenToolbox: () => void;
  togglePaletteCategory: (category: DesignerToolboxExpandableId) => void;
  expandedPaletteCategories: ReadonlySet<DesignerToolboxExpandableId>;
  recentlyUsedPaletteItems: DesignerPaletteItem[];
  recordRecentlyUsedPaletteItem: (itemId: string) => void;
  handleToolboxHeaderPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleToolboxHeaderPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleToolboxHeaderPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleToolboxResizePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleToolboxResizePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleToolboxResizePointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  previewState: DesignerPreviewRuntimeState;
  setPreviewState: React.Dispatch<React.SetStateAction<DesignerPreviewRuntimeState>>;
  isPreviewDialogOpen: boolean;
  setIsPreviewDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  previewSessionPath: string | null;
  handleRunPreview: () => Promise<void>;
  handleOpenOutlinePreview: () => Promise<void>;
  previewBindings: Record<string, DesignerBindingDefinition>;
  previewContext: DesignerPreviewContextState;
  simulatedPreviewRole: string;
  setSimulatedPreviewRole: React.Dispatch<React.SetStateAction<string>>;
  nodeTreeSearch: string;
  setNodeTreeSearch: React.Dispatch<React.SetStateAction<string>>;
  handleToggleNodeCollapse: (nodeId: string) => void;
  handleExpandAllNodes: () => void;
  handleCollapseAllNodes: () => void;
  outlineRows: OutlineTreeRow[];
  outlineExpandedById: Record<string, boolean>;
  visibleTreeNodeIds: ReadonlySet<string> | null;
  setNodeBindingField: (
    nodeId: string,
    bindingKey: string,
    updater: (definition: DesignerBindingDefinition) => DesignerBindingDefinition,
  ) => void;
  setGlobalBindingField: (
    bindingKey: string,
    updater: (definition: DesignerBindingDefinition) => DesignerBindingDefinition,
  ) => void;
  allDiagnostics: DesignerDiagnostic[];
  codeDiagnostics: DesignerDiagnostic[];
  diagnosticsByNodeId: Record<string, DesignerDiagnostic[]>;
  handleRemoveSelectedNode: (source?: 'canvas' | 'toolbar' | 'keyboard', nodeId?: string) => void;
  selectedNode: DesignerNode | null | undefined;
  rootNode: DesignerNode | undefined;
  hasCanvasNodes: boolean;
  canUndo: boolean;
  canRedo: boolean;
  generatedJson: string;
  generatedTsx: string;
  groupedPalette: Array<{ category: DesignerToolboxGroup; label: string; items: DesignerPaletteItem[] }>;
  filteredPalette: DesignerPaletteItem[];
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
  paletteSplitHandleProps: UseDesignerLayoutResult['paletteSplitHandleProps'];
  inspectorSplitHandleProps: UseDesignerLayoutResult['inspectorSplitHandleProps'];
  designCodeSplitHandleProps: UseDesignerLayoutResult['designCodeSplitHandleProps'];
};

export const useDesignerState = ({
  getDialogFlags,
  getPreviewPersistence,
}: UseDesignerStateParams): UseDesignerStateResult => {
  const [state, dispatch] = React.useReducer(designerReducer, undefined, createInitialDesignerState);
  const [designerToast, setDesignerToast] = React.useState<DesignerToast | null>(null);

  const flashToolbarStatus = React.useCallback((message: string, tone?: AppToastType) => {
    if (!message) {
      return;
    }

    setDesignerToast({ type: tone ?? inferDesignerToastTone(message), text: message });
  }, []);

  React.useEffect(() => {
    if (!designerToast) {
      return;
    }

    // Drop-rejection messages ("Drop rejected: …") fire mid-drag, while the user's attention is
    // on the cursor/drop target rather than the toolbar — the default duration is easy to miss,
    // which makes a rejected drop look like the dropped element silently failed to render rather
    // than never having been placed at all. Give these more time on screen.
    const duration = designerToast.text.startsWith('Drop rejected:') ? 6000 : 3200;
    const handle = window.setTimeout(() => {
      setDesignerToast(null);
    }, duration);

    return () => {
      window.clearTimeout(handle);
    };
  }, [designerToast]);

  const layout = useDesignerLayout({ state, dispatch });
  const palette = useDesignerPalette({ middleLayoutRef: layout.middleLayoutRef });
  const code = useDesignerCode({ state, dispatch });
  const [simulatedPreviewRole, setSimulatedPreviewRole] = React.useState('');
  const previewPersistence = getPreviewPersistence?.() ?? { activeDraftId: null, hasUnsavedChanges: false };
  const preview = useDesignerPreview({
    state,
    selectedNode: state.selectedNodeId ? state.document.nodes[state.selectedNodeId] : null,
    flashToolbarStatus,
    activeDraftId: previewPersistence.activeDraftId,
    hasUnsavedChanges: previewPersistence.hasUnsavedChanges,
    simulatedPreviewRole,
  });
  const outline = useDesignerOutline({ state, previewDiagnostics: preview.previewState.diagnostics });

  const selectedNode = state.selectedNodeId ? state.document.nodes[state.selectedNodeId] : null;
  const rootNode = state.document.nodes[state.document.rootNodeId];
  const hasCanvasNodes = state.document.nodes[state.document.rootNodeId]?.children.length > 0;
  const canUndo = state.history.past.length > 0;
  const canRedo = state.history.future.length > 0;

  const interactions = useDesignerInteractions({
    state,
    dispatch,
    selectedNode,
    previewDiagnostics: preview.previewState.diagnostics,
    getDialogFlags,
    flashToolbarStatus,
  });

  return {
    state,
    dispatch,
    paletteItems: palette.paletteItems,
    paletteLoadError: palette.paletteLoadError,
    activeCodeTab: code.activeCodeTab,
    setActiveCodeTab: code.setActiveCodeTab,
    codeDraft: code.codeDraft,
    setCodeDraft: code.setCodeDraft,
    setLastEditedFormat: code.setLastEditedFormat,
    resetCodeFromGenerated: code.resetCodeFromGenerated,
    loadCodeFromCompanionTsx: code.loadCodeFromCompanionTsx,
    handleCodeTabKeyDown: code.handleCodeTabKeyDown,
    designerToast,
    flashToolbarStatus,
    isCompactLayout: layout.isCompactLayout,
    compactPanels: layout.compactPanels,
    setCompactPanels: layout.setCompactPanels,
    paletteWidth: layout.paletteWidth,
    inspectorWidth: layout.inspectorWidth,
    isCodeColumnVisible: layout.isCodeColumnVisible,
    isInspectorColumnVisible: layout.isInspectorColumnVisible,
    designSplitRatio: layout.designSplitRatio,
    isCodePanelCollapsed: layout.isCodePanelCollapsed,
    isResizingPalette: layout.isResizingPalette,
    isResizingInspector: layout.isResizingInspector,
    isResizingDesignSplit: layout.isResizingDesignSplit,
    isToolboxOpen: palette.isToolboxOpen,
    setIsToolboxOpen: palette.setIsToolboxOpen,
    toolboxSearchQuery: palette.toolboxSearchQuery,
    setToolboxSearchQuery: palette.setToolboxSearchQuery,
    toolboxPosition: palette.toolboxPosition,
    toolboxSize: palette.toolboxSize,
    toolboxMenuRef: palette.toolboxMenuRef,
    toolboxPanelRef: palette.toolboxPanelRef,
    handleOpenToolbox: palette.handleOpenToolbox,
    togglePaletteCategory: palette.togglePaletteCategory,
    expandedPaletteCategories: palette.expandedPaletteCategories,
    recentlyUsedPaletteItems: palette.recentlyUsedPaletteItems,
    recordRecentlyUsedPaletteItem: palette.recordRecentlyUsedPaletteItem,
    handleToolboxHeaderPointerDown: palette.handleToolboxHeaderPointerDown,
    handleToolboxHeaderPointerMove: palette.handleToolboxHeaderPointerMove,
    handleToolboxHeaderPointerUp: palette.handleToolboxHeaderPointerUp,
    handleToolboxResizePointerDown: palette.handleToolboxResizePointerDown,
    handleToolboxResizePointerMove: palette.handleToolboxResizePointerMove,
    handleToolboxResizePointerUp: palette.handleToolboxResizePointerUp,
    previewState: preview.previewState,
    setPreviewState: preview.setPreviewState,
    isPreviewDialogOpen: preview.isPreviewDialogOpen,
    setIsPreviewDialogOpen: preview.setIsPreviewDialogOpen,
    previewSessionPath: preview.previewSessionPath,
    handleRunPreview: preview.handleRunPreview,
    handleOpenOutlinePreview: preview.handleOpenOutlinePreview,
    previewBindings: preview.previewBindings,
    previewContext: preview.previewContext,
    simulatedPreviewRole,
    setSimulatedPreviewRole,
    nodeTreeSearch: outline.nodeTreeSearch,
    setNodeTreeSearch: outline.setNodeTreeSearch,
    handleToggleNodeCollapse: outline.handleToggleNodeCollapse,
    handleExpandAllNodes: outline.handleExpandAllNodes,
    handleCollapseAllNodes: outline.handleCollapseAllNodes,
    outlineRows: outline.outlineRows,
    outlineExpandedById: outline.outlineExpandedById,
    visibleTreeNodeIds: outline.visibleTreeNodeIds,
    setNodeBindingField: interactions.setNodeBindingField,
    setGlobalBindingField: interactions.setGlobalBindingField,
    allDiagnostics: interactions.allDiagnostics,
    codeDiagnostics: code.codeDiagnostics,
    diagnosticsByNodeId: interactions.diagnosticsByNodeId,
    handleRemoveSelectedNode: interactions.handleRemoveSelectedNode,
    selectedNode,
    rootNode,
    hasCanvasNodes,
    canUndo,
    canRedo,
    generatedJson: code.generatedJson,
    generatedTsx: code.generatedTsx,
    groupedPalette: palette.groupedPalette,
    filteredPalette: palette.filteredPalette,
    viewportClassName: layout.viewportClassName,
    showPalette: layout.showPalette,
    showDesign: layout.showDesign,
    showCode: layout.showCode,
    showInspector: layout.showInspector,
    showDesktopDesignCodeSplit: layout.showDesktopDesignCodeSplit,
    shouldRenderCodePanel: layout.shouldRenderCodePanel,
    desktopLayoutRef: layout.desktopLayoutRef,
    middleLayoutRef: layout.middleLayoutRef,
    togglePalettePanel: layout.togglePalettePanel,
    toggleInspectorPanel: layout.toggleInspectorPanel,
    toggleCodePanel: layout.toggleCodePanel,
    toggleCodeColumnVisibility: layout.toggleCodeColumnVisibility,
    toggleInspectorColumnVisibility: layout.toggleInspectorColumnVisibility,
    openInspectorForNode: layout.openInspectorForNode,
    paletteSplitHandleProps: layout.paletteSplitHandleProps,
    inspectorSplitHandleProps: layout.inspectorSplitHandleProps,
    designCodeSplitHandleProps: layout.designCodeSplitHandleProps,
  };
};
