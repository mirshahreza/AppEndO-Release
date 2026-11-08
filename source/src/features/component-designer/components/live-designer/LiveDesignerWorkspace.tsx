import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppRouteLoading } from '../../../../components/AppRouteLoading';
import { createDefaultDesignerViewport } from '../../../../domain/component-designer/state';
import type { DesignerBindingDefinitions, DesignerCanvasFillMode } from '../../../../domain/component-designer/types';
import {
  componentDesignerQueryKeys,
  createComponentDesignerVersion,
  invalidateDesignerPublishedViews,
  loadComponentDesignerVersion,
  updateComponentDesignerVersion,
} from '../../../../shared/api/queries/component-designer';
import { createStateFromNewLayoutPreset } from '../../../../domain/component-designer/layout-presets/newLayoutPresets';
import { isClientComponentEditSlug } from '../../../../shared/lib/clientComponentEditSlug';
import { DEFAULT_DRAFT_FOLDER } from '../../../../shared/lib/designerShellEntry';
import { canonicalizeDesignerItemSlug } from '../../../../shared/lib/designerComponentPath';
import { isBuiltInComponentId } from '../../../../domain/component-designer/layout-presets/builtInComponents';
import { AppButton, AppToast, WorkspaceVerticalSplitHandle, WORKSPACE_SPLIT_PANEL_KEYS, type FloatingPanelShellHandle } from '../../../../shared/ui';
import { STUDIO_SELECT_ALL_BLOCKED_EVENT } from '../../../../shared/ui/shell/studioNoSelect';
import { UI_CHROME_NO_SELECT_CLASS } from '../../../../shared/ui/surfaceClasses';
import {
  isDesignerSelectAllHotkey,
  isLiveDesignerNativeSelectAllTarget,
} from './liveDesignerSelectAllHotkey';
import { cn } from '../../../../lib/utils';
import { useAiSettingsQuery } from '../../../../shared/api/queries/aiModels';
import { isAiGloballyEnabled } from '../../../../shared/lib/aiAccess';
import { usePublishAiPageContext } from '../../../../shared/lib/aiPageContextStore';
import { useDesignerCode } from '../../hooks/useDesignerCode';
import { useLiveDesignerOverlayDeepLink } from '../../hooks/useLiveDesignerOverlayDeepLink';
import { useLiveDesignerShellHeader } from '../../hooks/useLiveDesignerShellHeader';
import {
  canPersistDesignerViewportPrefs,
  resolveDesignerViewportForComponent,
  writeDesignerViewportPrefs,
} from '../../lib/designerViewportPrefs';
import { buildClientComponentAiSnapshot } from '../../lib/clientComponentAiSnapshot';
import type { ClientComponentLayoutApplyPayload } from '../../lib/clientComponentAiAgentApply';
import { LIVE_DESIGNER_SAVE_BUSY_HOLD_MS, LiveDesignerBusyOverlay } from './LiveDesignerBusyOverlay';
import { ClientComponentAiPanel } from './ClientComponentAiPanel';
import { LiveDesignerCodePanel } from './LiveDesignerCodePanel';
import type { LiveDesignerContextMenuAction } from './LiveDesignerContextMenu';
import { LiveDesignerFooter } from './LiveDesignerFooter';
import type { LiveDesignerInteractionMode } from './liveDesignerInteractionMode';
import { LiveDesignerOutlinePanel } from './LiveDesignerOutlinePanel';
import { LiveDesignerPreview } from './LiveDesignerPreview';
import { LiveDesignerPropertiesPanel } from './LiveDesignerPropertiesPanel';
import { LiveDesignerToolbar } from './LiveDesignerToolbar';
import { LiveDesignerToolboxPanel } from './LiveDesignerToolboxPanel';
import { LiveDesignerDockColumn, LiveDesignerDockToggleRail } from './LiveDesignerDockToggleRail';
import { LiveDesignerViewport, type LiveDesignerViewportSize } from './LiveDesignerViewport';
import { isShellLayoutEditorContext } from '../../../../shared/lib/shellDocumentRuntime';
import { useLiveDesignerEditor } from './useLiveDesignerEditor';
import { useLiveDesignerPanelSplit } from './useLiveDesignerPanelSplit';

export type LiveDesignerWorkspaceProps = {
  componentPath: string;
  /** Preferred lookup — same identity classic designer uses from the catalog. */
  draftId?: string | null;
  onBack: () => void;
};

function resolveLiveDesignerErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return 'Saved component is unavailable. Save the component in the classic designer and try again.';
}

function isDesignerVersionNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Version not found');
}

type ToastState = { type: 'success' | 'error' | 'info'; text: string };

/** Success/info toasts leave on their own. Errors stay until the operator dismisses them. */
export const LIVE_DESIGNER_TOAST_AUTO_DISMISS_MS = 2000;

export const LiveDesignerWorkspace: React.FC<LiveDesignerWorkspaceProps> = ({
  componentPath,
  draftId = null,
  onBack,
}) => {
  const queryClient = useQueryClient();
  const editor = useLiveDesignerEditor();
  const code = useDesignerCode({
    state: editor.state,
    dispatch: editor.dispatch,
  });
  const outlineSplit = useLiveDesignerPanelSplit({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.liveDesignerOutline,
    defaultSize: 288,
    minSize: 180,
    maxSize: 480,
    side: 'start',
  });
  const propertiesSplit = useLiveDesignerPanelSplit({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.liveDesignerProperties,
    defaultSize: 320,
    minSize: 240,
    maxSize: 560,
    side: 'end',
  });
  const codeSplit = useLiveDesignerPanelSplit({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.liveDesignerCode,
    defaultSize: 420,
    minSize: 280,
    maxSize: 1200,
    side: 'end',
  });
  const [outlineOpen, setOutlineOpen] = React.useState(false);
  const [codeOpen, setCodeOpen] = React.useState(false);
  const [propertiesOpen, setPropertiesOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [interactionMode, setInteractionMode] = React.useState<LiveDesignerInteractionMode>('inspect');
  const [isSaving, setIsSaving] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const [workingDraftId, setWorkingDraftId] = React.useState<string | null>(null);
  const hydratedLookupRef = React.useRef<string | null>(null);
  const provisionAttemptedRef = React.useRef(false);
  const [isProvisioningDraft, setIsProvisioningDraft] = React.useState(false);
  const toolboxPanelRef = React.useRef<FloatingPanelShellHandle>(null);

  useLiveDesignerOverlayDeepLink({
    enabled: Boolean(canonicalizeDesignerItemSlug(componentPath) || componentPath.trim()),
    outlineOpen,
    setOutlineOpen,
    propertiesOpen,
    setPropertiesOpen,
    codeOpen,
    setCodeOpen,
    aiOpen,
    setAiOpen,
  });

  const canonicalPath = canonicalizeDesignerItemSlug(componentPath) || componentPath.trim();
  const lookupKey = (draftId?.trim() || canonicalPath).trim();

  React.useEffect(() => {
    setWorkingDraftId(null);
    provisionAttemptedRef.current = false;
  }, [lookupKey]);

  const draftQuery = useQuery({
    queryKey: [...componentDesignerQueryKeys.all, 'live-designer', lookupKey] as const,
    queryFn: async () => {
      if (draftId?.trim()) {
        return loadComponentDesignerVersion(draftId.trim());
      }

      if (!componentPath.trim()) {
        throw new Error('Missing component path for Live Designer.');
      }

      return loadComponentDesignerVersion(canonicalPath);
    },
    enabled: lookupKey.length > 0,
  });

  React.useEffect(() => {
    if (!draftQuery.data?.document || !lookupKey) {
      return;
    }

    if (hydratedLookupRef.current === lookupKey) {
      return;
    }

    hydratedLookupRef.current = lookupKey;
    const componentKey = canonicalizeDesignerItemSlug(draftQuery.data.name || componentPath);
    const restoredViewport = resolveDesignerViewportForComponent(
      componentKey,
      draftQuery.data.workspace?.viewport ?? null,
    ) ?? createDefaultDesignerViewport();
    editor.hydrate(
      draftQuery.data.document,
      (draftQuery.data.bindingDefinitions ?? {}) as DesignerBindingDefinitions,
      restoredViewport,
    );
    code.resetCodeFromGenerated();
    setPropertiesOpen(false);
    setOutlineOpen(false);
  }, [code.resetCodeFromGenerated, componentPath, draftQuery.data, editor.hydrate, lookupKey]);

  React.useEffect(() => {
    if (!editor.ready || hydratedLookupRef.current !== lookupKey) {
      return;
    }

    const componentKey = canonicalizeDesignerItemSlug(draftQuery.data?.name || componentPath);
    const stateKey = canonicalizeDesignerItemSlug(editor.state.document.name);
    if (!canPersistDesignerViewportPrefs(componentKey) || componentKey !== stateKey) {
      return;
    }

    writeDesignerViewportPrefs(componentKey, editor.state.viewport);
  }, [
    componentPath,
    draftQuery.data?.name,
    editor.ready,
    editor.state.document.name,
    editor.state.viewport,
    lookupKey,
  ]);

  const resolvedDraftId = workingDraftId ?? draftQuery.data?.id ?? draftId?.trim() ?? null;
  const isResolvedBuiltIn = Boolean(resolvedDraftId && isBuiltInComponentId(resolvedDraftId));
  const componentLabel = draftQuery.data?.name ?? canonicalizeDesignerItemSlug(componentPath);
  const aiSettingsQuery = useAiSettingsQuery();
  const showAi = isAiGloballyEnabled(aiSettingsQuery.data?.enabled);

  useLiveDesignerShellHeader({
    enabled: Boolean(componentPath.trim() || draftId?.trim()),
  });

  usePublishAiPageContext({
    layoutId: resolvedDraftId,
    selectedNodeId: editor.selectedNodeId,
    draftDirty: editor.isDirty,
    viewport: {
      preset: editor.state.viewport.preset,
      width: editor.state.viewport.width,
      height: editor.state.viewport.height,
      fillMode: editor.state.viewport.fillMode,
    },
  });

  const document = editor.document;
  React.useEffect(() => {
    if (draftId?.trim() || isBuiltInComponentId(lookupKey)) {
      return;
    }
    if (!draftQuery.isError || editor.document || provisionAttemptedRef.current) {
      return;
    }
    if (!isDesignerVersionNotFoundError(draftQuery.error)) {
      return;
    }
    const name = canonicalizeDesignerItemSlug(canonicalPath) || canonicalPath.trim();
    if (!isClientComponentEditSlug(name)) {
      return;
    }

    provisionAttemptedRef.current = true;
    setIsProvisioningDraft(true);
    void (async () => {
      try {
        const { state } = createStateFromNewLayoutPreset('blank');
        await createComponentDesignerVersion({
          name,
          folder: DEFAULT_DRAFT_FOLDER,
          document: { ...state.document, name },
          bindingDefinitions: state.bindingDefinitions,
          workspace: { viewport: state.viewport },
        });
        await queryClient.invalidateQueries({ queryKey: componentDesignerQueryKeys.drafts() });
        await queryClient.invalidateQueries({
          queryKey: [...componentDesignerQueryKeys.all, 'live-designer', lookupKey],
        });
      } catch {
        // Error surface stays on draftQuery after refetch settles.
      } finally {
        setIsProvisioningDraft(false);
      }
    })();
  }, [
    canonicalPath,
    draftId,
    draftQuery.error,
    draftQuery.isError,
    editor.document,
    lookupKey,
    queryClient,
  ]);

  const showShellLayoutControls = isShellLayoutEditorContext(document, componentPath);
  const insertParentId = editor.resolveInsertParentId() ?? document?.rootNodeId ?? 'root';

  const handleMonacoChange = React.useCallback((value: string) => {
    editor.dispatch({ type: 'clear-sync-diagnostics' });
    code.setLastEditedFormat('tsx');
    code.setCodeDraft((previous) => ({
      ...previous,
      tsx: value,
      tsxDirty: true,
    }));
  }, [code.setCodeDraft, code.setLastEditedFormat, editor.dispatch]);

  const selectionLabel = React.useMemo(() => {
    if (!document) {
      return null;
    }
    if (editor.selectedNodeIds.length > 1) {
      return `${editor.selectedNodeIds.length} objects`;
    }
    const selectedId = editor.selectedNodeId;
    if (!selectedId) {
      return null;
    }
    const node = document.nodes[selectedId];
    if (!node) {
      return selectedId;
    }
    return `${node.type} · ${selectedId}`;
  }, [document, editor.selectedNodeId, editor.selectedNodeIds]);

  const handleDeleteSelected = React.useCallback((nodeId?: string | null) => {
    const targetIds = nodeId
      ? [nodeId]
      : editor.selectedNodeIds;
    if (!editor.removeNodes(targetIds)) {
      setToast({ type: 'info', text: 'That node cannot be deleted.' });
      return;
    }
    setPropertiesOpen(false);
  }, [editor]);

  const handleDuplicateSelected = React.useCallback((nodeId?: string | null) => {
    if (!editor.duplicateNode(nodeId)) {
      setToast({ type: 'info', text: 'That node cannot be duplicated.' });
    }
  }, [editor]);

  const handleCopySelected = React.useCallback((nodeId?: string | null) => {
    if (!editor.copyNode(nodeId)) {
      setToast({ type: 'info', text: 'That node cannot be copied.' });
    }
  }, [editor]);

  const handlePaste = React.useCallback(async () => {
    if (!(await editor.pasteNode())) {
      setToast({ type: 'info', text: 'Nothing to paste here.' });
    }
  }, [editor]);

  const handleContextAction = React.useCallback((
    action: LiveDesignerContextMenuAction,
    nodeId: string,
  ) => {
    if (action === 'delete') {
      handleDeleteSelected(nodeId);
      return;
    }
    if (action === 'duplicate') {
      editor.selectNode(nodeId);
      handleDuplicateSelected(nodeId);
      return;
    }
    if (action === 'copy') {
      editor.selectNode(nodeId);
      handleCopySelected(nodeId);
      return;
    }
    if (action === 'paste') {
      editor.selectNode(nodeId);
      void handlePaste();
      return;
    }
    if (action === 'properties') {
      editor.selectNode(nodeId);
      setPropertiesOpen(true);
    }
  }, [editor, handleCopySelected, handleDeleteSelected, handleDuplicateSelected, handlePaste]);

  const handleOpenProperties = React.useCallback((nodeId: string) => {
    editor.selectNode(nodeId);
    setPropertiesOpen(true);
  }, [editor]);

  const handleInteractionModeChange = React.useCallback((mode: LiveDesignerInteractionMode) => {
    setInteractionMode(mode);
    if (mode !== 'interact') {
      return;
    }
    editor.selectNode(null);
    editor.hoverNode(null);
    setPropertiesOpen(false);
  }, [editor]);

  React.useEffect(() => {
    if (!propertiesOpen) {
      return;
    }
    toolboxPanelRef.current?.minimize();
  }, [propertiesOpen]);

  const handleInsertPaletteItem = React.useCallback((
    itemId: string,
    parentId?: string | null,
    index?: number,
  ) => {
    if (!editor.insertPaletteItem(itemId, parentId, index)) {
      setToast({ type: 'info', text: 'Cannot insert that component here.' });
    }
  }, [editor]);

  const handleViewportSizeChange = React.useCallback((size: LiveDesignerViewportSize) => {
    editor.dispatch({ type: 'resize-canvas', width: size.width, height: size.height });
  }, [editor]);

  const handleViewportFillModeChange = React.useCallback((fillMode: DesignerCanvasFillMode) => {
    editor.dispatch({ type: 'set-fill-mode', fillMode });
  }, [editor]);

  const handleApplyAiLayout = React.useCallback((payload: ClientComponentLayoutApplyPayload) => {
    if (!document) {
      return;
    }
    editor.applyDocument({
      ...payload.document,
      id: document.id,
      name: document.name,
    }, payload.bindingDefinitions);
    code.resetCodeFromGenerated();
  }, [code, document, editor]);

  const handleSave = React.useCallback(async () => {
    if (!document || !resolvedDraftId || isSaving) {
      return;
    }

    if (!editor.isDirty && !isResolvedBuiltIn) {
      return;
    }

    setIsSaving(true);
    let nextToast: ToastState | null = null;
    try {
      const saved = await updateComponentDesignerVersion(resolvedDraftId, {
        name: componentLabel,
        document,
        bindingDefinitions: editor.bindingDefinitions,
      });
      if (saved.id && saved.id !== resolvedDraftId) {
        setWorkingDraftId(saved.id);
      }
      editor.markSaved(
        saved.document,
        (saved.bindingDefinitions ?? {}) as DesignerBindingDefinitions,
      );
      code.resetCodeFromGenerated();
      void queryClient.invalidateQueries({ queryKey: componentDesignerQueryKeys.drafts() });
      void queryClient.invalidateQueries({
        queryKey: [...componentDesignerQueryKeys.all, 'live-designer', lookupKey],
      });
      invalidateDesignerPublishedViews(queryClient, {
        shellKey: saved.name,
        pageSlug: saved.name,
      });
      nextToast = { type: 'success', text: 'Saved.' };
    } catch (error) {
      nextToast = {
        type: 'error',
        text: error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Failed to save draft.',
      };
    } finally {
      await new Promise((resolve) => {
        window.setTimeout(resolve, LIVE_DESIGNER_SAVE_BUSY_HOLD_MS);
      });
      setIsSaving(false);
    }
    if (nextToast) {
      setToast(nextToast);
    }
  }, [code.resetCodeFromGenerated, componentLabel, document, editor, isResolvedBuiltIn, isSaving, lookupKey, queryClient, resolvedDraftId]);

  React.useEffect(() => {
    const selectAllCanvasObjects = () => {
      window.getSelection()?.removeAllRanges();
      if (interactionMode === 'inspect') {
        editor.selectAllNodes();
      }
    };

    const onStudioSelectAllBlocked = () => {
      selectAllCanvasObjects();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const inEditable = target instanceof Element
        && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

      if (isDesignerSelectAllHotkey(event)) {
        if (isLiveDesignerNativeSelectAllTarget(target)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (target instanceof HTMLElement) {
          target.blur();
        }
        selectAllCanvasObjects();
        return;
      }

      // Allow Save while Monaco/input is focused; block other designer shortcuts there.
      if (inEditable) {
        if (mod && key === 's') {
          event.preventDefault();
          void handleSave();
        }
        return;
      }

      if (!mod && !event.altKey) {
        if (key === 'i') {
          event.preventDefault();
          setInteractionMode('inspect');
          return;
        }
        if (key === 'p') {
          event.preventDefault();
          handleInteractionModeChange('interact');
          return;
        }
        if (event.key === 'Escape' && interactionMode === 'interact') {
          event.preventDefault();
          setInteractionMode('inspect');
          return;
        }
      }

      if (mod && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        editor.undo();
        return;
      }
      if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        editor.redo();
        return;
      }
      if (mod && key === 's') {
        event.preventDefault();
        void handleSave();
        return;
      }

      if (interactionMode !== 'inspect') {
        return;
      }

      if (mod && key === 'd') {
        if (!editor.canDuplicateSelected) {
          return;
        }
        event.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if (mod && key === 'c') {
        if (!editor.canCopySelected) {
          return;
        }
        event.preventDefault();
        handleCopySelected();
        return;
      }
      if (mod && key === 'v') {
        event.preventDefault();
        void handlePaste();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!editor.canDeleteSelected) {
          return;
        }
        event.preventDefault();
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.document.addEventListener(STUDIO_SELECT_ALL_BLOCKED_EVENT, onStudioSelectAllBlocked);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.document.removeEventListener(STUDIO_SELECT_ALL_BLOCKED_EVENT, onStudioSelectAllBlocked);
    };
  }, [
    editor,
    handleCopySelected,
    handleDeleteSelected,
    handleDuplicateSelected,
    handlePaste,
    handleInteractionModeChange,
    handleSave,
    interactionMode,
  ]);

  if (!lookupKey) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center bg-white p-6">
        <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
          Missing component path for Live Designer.
        </div>
        <AppButton className="mt-3" size="sm" intent="secondary" onClick={onBack}>
          Back to list
        </AppButton>
      </div>
    );
  }

  if (
    isProvisioningDraft
    || draftQuery.isPending
    || (draftQuery.isFetching && !draftQuery.data && !document)
  ) {
    return <AppRouteLoading label={isProvisioningDraft ? 'Creating component…' : undefined} />;
  }

  if ((draftQuery.isError && !document) || !document) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center bg-white p-6">
        <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
          <p>{resolveLiveDesignerErrorMessage(draftQuery.error)}</p>
          <p className="mt-2 font-mono text-[11px] text-rose-500/80">
            {componentPath || lookupKey}
          </p>
        </div>
        <AppButton className="mt-3" size="sm" intent="secondary" onClick={onBack}>
          Back to list
        </AppButton>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 w-full overflow-hidden bg-white"
      data-testid="live-designer-workspace"
    >
      <div
        className={cn(
          'relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          UI_CHROME_NO_SELECT_CLASS,
          '[&_[data-testid=live-designer-code-panel]]:select-text',
        )}
      >
        {toast ? (
          <AppToast
            type={toast.type}
            text={toast.text}
            durationMs={toast.type === 'error' ? 0 : LIVE_DESIGNER_TOAST_AUTO_DISMISS_MS}
            onDismiss={() => setToast(null)}
          />
        ) : null}

        <LiveDesignerBusyOverlay open={isSaving} label="Saving…" />

        <LiveDesignerToolbar
          onBack={onBack}
          itemLabel={componentLabel}
          onSave={() => { void handleSave(); }}
          onUndo={editor.undo}
          onRedo={editor.redo}
          canSave={(editor.isDirty || isResolvedBuiltIn) && Boolean(resolvedDraftId)}
          isSaving={isSaving}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          showAi={showAi}
          aiOpen={aiOpen}
          onToggleAi={() => setAiOpen((open) => !open)}
        />

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <LiveDesignerDockColumn testId="live-designer-outline-dock" toolboxMinimizeBeside>
            <LiveDesignerDockToggleRail
              label="Outline"
              hint="Shows the tree of controls on this layout so you can select nested nodes."
              open={outlineOpen}
              onToggle={() => setOutlineOpen((value) => !value)}
              side="start"
            />
            {outlineOpen ? (
              <>
                <LiveDesignerOutlinePanel
                  document={document}
                  bindingDefinitions={editor.bindingDefinitions}
                  selectedNodeId={interactionMode === 'inspect' ? editor.selectedNodeId : null}
                  selectedNodeIds={interactionMode === 'inspect' ? editor.selectedNodeIds : []}
                  onSelectNode={editor.selectNode}
                  onOpenProperties={handleOpenProperties}
                  onMoveNode={editor.moveNode}
                  onInsertPaletteItem={handleInsertPaletteItem}
                  interactionEnabled={interactionMode === 'inspect'}
                  onClose={() => setOutlineOpen(false)}
                  width={outlineSplit.size}
                />
                <WorkspaceVerticalSplitHandle {...outlineSplit.splitHandleProps} />
              </>
            ) : null}
          </LiveDesignerDockColumn>

          <LiveDesignerToolboxPanel
            ref={toolboxPanelRef}
            document={document}
            insertParentId={insertParentId}
            onInsertItem={handleInsertPaletteItem}
          />

          <div className={cn('relative min-h-0 min-w-0 flex-1 overflow-hidden', UI_CHROME_NO_SELECT_CLASS)}>
            <LiveDesignerViewport
              width={editor.state.viewport.width}
              height={editor.state.viewport.height}
              fillMode={editor.state.viewport.fillMode}
              onSizeChange={handleViewportSizeChange}
              onFillModeChange={handleViewportFillModeChange}
              selectedNodeId={interactionMode === 'inspect' ? editor.selectedNodeId : null}
              selectedNodeIds={interactionMode === 'inspect' ? editor.selectedNodeIds : []}
              rootNodeId={document.rootNodeId}
              document={document}
              documentRevision={editor.documentRevision}
              interactionMode={interactionMode}
              onHoverNodeIdChange={editor.hoverNode}
              onSelectNodeId={editor.selectNode}
              onOpenProperties={handleOpenProperties}
              onContextAction={handleContextAction}
              onMoveNode={editor.moveNode}
              onInsertPaletteItem={(itemId, parentId, index) => {
                handleInsertPaletteItem(itemId, parentId, index);
              }}
              onAddLayoutTrack={(nodeId, axis, place) => {
                editor.dispatch({ type: 'add-layout-track', nodeId, axis, place });
              }}
              canPaste={editor.hasClipboard && interactionMode === 'inspect'}
            >
              <LiveDesignerPreview
                document={document}
                bindingDefinitions={editor.bindingDefinitions}
                interactive={interactionMode === 'interact'}
                viewportPreset={editor.state.viewport.preset}
              />
            </LiveDesignerViewport>
          </div>

          <LiveDesignerDockColumn testId="live-designer-properties-dock" toolboxRestoreBefore>
            {propertiesOpen ? (
              <>
                <WorkspaceVerticalSplitHandle {...propertiesSplit.splitHandleProps} />
                <LiveDesignerPropertiesPanel
                  node={interactionMode === 'inspect' && editor.selectedNodeId
                    ? document.nodes[editor.selectedNodeId] ?? null
                    : null}
                  document={document}
                  bindingDefinitions={editor.bindingDefinitions}
                  dispatch={editor.dispatch}
                  onClose={() => setPropertiesOpen(false)}
                  onSelectNode={editor.selectNode}
                  width={propertiesSplit.size}
                  viewportPreset={editor.state.viewport.preset}
                  showShellLayout={showShellLayoutControls}
                />
              </>
            ) : null}
            <LiveDesignerDockToggleRail
              label="Properties"
              hint="Shows the selected node’s properties beside the canvas."
              open={propertiesOpen}
              onToggle={() => setPropertiesOpen((value) => !value)}
              side="end"
            />
          </LiveDesignerDockColumn>

          <LiveDesignerDockColumn testId="live-designer-code-dock">
            {codeOpen ? (
              <>
                <WorkspaceVerticalSplitHandle {...codeSplit.splitHandleProps} />
                <LiveDesignerCodePanel
                  documentKey={document.id}
                  value={code.codeDraft.tsx}
                  diagnostics={code.codeDiagnostics}
                  onChange={handleMonacoChange}
                  onClose={() => setCodeOpen(false)}
                  width={codeSplit.size}
                />
              </>
            ) : null}
            <LiveDesignerDockToggleRail
              label="Code"
              hint="Shows the generated source for this layout as a read-only reference."
              open={codeOpen}
              onToggle={() => setCodeOpen((value) => !value)}
              side="end"
            />
          </LiveDesignerDockColumn>
        </div>

        <LiveDesignerFooter
          selectionLabel={interactionMode === 'inspect' ? selectionLabel : null}
          isDirty={editor.isDirty}
          interactionMode={interactionMode}
          onInteractionModeChange={handleInteractionModeChange}
          diagnostics={document.diagnostics}
          onSelectDiagnosticNode={(nodeId) => {
            handleInteractionModeChange('inspect');
            editor.selectNode(nodeId);
            setPropertiesOpen(true);
          }}
        />
      </div>

      {showAi ? (
        <div
          className={aiOpen ? 'flex h-full min-h-0 shrink-0 items-stretch' : 'hidden'}
          data-testid="live-designer-ai-dock"
        >
          <ClientComponentAiPanel
            key={resolvedDraftId ?? lookupKey}
            readSnapshot={() => buildClientComponentAiSnapshot({
              name: componentLabel,
              layoutId: resolvedDraftId,
              selectedNodeId: editor.selectedNodeId,
              readOnly: false,
              document,
              bindingDefinitions: editor.bindingDefinitions,
            })}
            readOnly={false}
            layoutId={resolvedDraftId}
            componentName={componentLabel}
            selectedNodeId={editor.selectedNodeId}
            onApplyLayout={handleApplyAiLayout}
            codeDiffBaseline={JSON.stringify({
              document,
              bindingDefinitions: editor.bindingDefinitions,
            }, null, 2)}
          />
        </div>
      ) : null}
    </div>
  );
};
