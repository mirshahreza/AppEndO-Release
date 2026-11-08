import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Blocks, Bot, Braces, Lock, Play, Rocket, Save, Trash2, X } from 'lucide-react';
import { workflowsApi, WorkflowsApiError } from '../api/workflowsApi';
import { fetchDataSourcesList } from '../../../shared/api/queries/data-sources';
import { fetchPublishedEdgeApiOptions } from '../../../shared/api/queries/data-api';
import type { DesignerViewport, DesignerViewState, WorkflowDataSourceOption, WorkflowDesignerProjection, WorkflowEdgeApiOption, WorkflowModel, WorkflowNode, WorkflowSecretReference } from '../types';
import { AppButton, CanvasToolbar, ConfirmDialogShell, WorkspaceBackIcon } from '../../../shared/ui';
import { GraphCanvas } from './GraphCanvas';
import { buildEdgeStatusByKey, type ExecutionVisualState } from '../lib/executionVisualization';
import type { DataFlowState } from '../lib/executionDataFlow';
import {
  computeWorkflowGraphLayout,
  type WorkflowGraphLayoutMode,
} from '../lib/computeWorkflowGraphLayout';
import { WorkflowPalette } from './WorkflowPalette';
import { NodePropertiesFloatingPanel } from './NodePropertiesFloatingPanel';
import { WorkflowSecretReferencesPanel } from './WorkflowSecretReferencesPanel';
import { EdgeSelectorPopover } from './EdgeSelectorPopover';
import { WorkflowExecutePanel } from './WorkflowExecutePanel';
import { WorkflowExecuteFixtureDialog } from './WorkflowExecuteFixtureDialog';
import { buildDefaultWorkflowFixtureSetJson } from '../lib/buildDefaultWorkflowFixtureSet';
import { WorkflowPublishedSwitch } from './WorkflowPublishedSwitch';
import { WorkflowStartSettingsPanel } from './WorkflowStartSettingsPanel';
import { WorkflowWorkspaceMetadataFooter } from './WorkflowWorkspaceMetadataFooter';
import { WorkflowDossierButton } from './WorkflowDossierButton';
import { WorkflowDesignerAiPanel } from './WorkflowDesignerAiPanel';
import { buildDefaultNode, generateNodeKey } from './nodeTemplates';
import type { WorkflowNodeDragPayload } from './workflowDragPayload';
import { applyWorkflowDraftOperationsLocal } from '../lib/workflowDraftLocalApply';
import { buildRenameNodeOperations } from '../lib/buildRenameNodeOperations';
import { parseDesignerView, serializeDesignerView, isDesignerViewDirty } from '../lib/designerViewState';
import { isWorkflowPublished } from '../lib/workflowPublished';
import { allowedSelectorTypesForSource, type EdgeSelectorType } from './edgeSelectorRules';
import { useWorkflowEditorOverlayDeepLink } from '../hooks/useWorkflowEditorOverlayDeepLink';

type PendingConnection = { anchor: { x: number; y: number }; fromNodeKey: string; toNodeKey: string };
type PendingReconnect = PendingConnection & { edgeKey: string };

/**
 * Workflow authoring workspace. Semantic edits and designer layout stay local until the author
 * explicitly saves the draft with the header Save action.
 */
export const WorkflowEditorWorkspace: React.FC<{
  definitionId: number;
  onBack: () => void;
  onPublicationChanged?: () => void;
  dossierDefinitionId: number | null;
  onOpenDossier: (definitionId: number) => void;
  onCloseDossier: () => void;
}> = ({
  definitionId,
  onBack,
  onPublicationChanged,
  dossierDefinitionId,
  onOpenDossier,
}) => {
  const [projection, setProjection] = useState<WorkflowDesignerProjection | null>(null);
  const [localModel, setLocalModel] = useState<WorkflowModel | null>(null);
  const [view, setView] = useState<DesignerViewState>({ nodePositions: {} });
  const [initialViewport, setInitialViewport] = useState<DesignerViewport | undefined>(undefined);
  const [savedViewJson, setSavedViewJson] = useState('{"nodePositions":{}}');
  const [pendingOperations, setPendingOperations] = useState<unknown[]>([]);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [outputSchemaOpen, setOutputSchemaOpen] = useState(false);
  const [fixturesJson, setFixturesJson] = useState('{"fixtures":{}}');
  const [secretReferencesOpen, setSecretReferencesOpen] = useState(false);
  const [startSettingsOpen, setStartSettingsOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [secretReferences, setSecretReferences] = useState<WorkflowSecretReference[]>([]);
  const [dataSources, setDataSources] = useState<WorkflowDataSourceOption[]>([]);
  const [edgeApis, setEdgeApis] = useState<WorkflowEdgeApiOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [pendingReconnect, setPendingReconnect] = useState<PendingReconnect | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [executionVisualState, setExecutionVisualState] = useState<ExecutionVisualState | null>(null);
  const [dataFlowState, setDataFlowState] = useState<DataFlowState | null>(null);
  const [fitViewRequestId, setFitViewRequestId] = useState(0);
  const [activeLayoutMode, setActiveLayoutMode] = useState<WorkflowGraphLayoutMode | null>(null);

  const load = useCallback(async () => {
    const result = await workflowsApi.getProjection(definitionId);
    const p = result.projection as WorkflowDesignerProjection;
    const nextView = parseDesignerView(p.designerView?.viewJson);
    const canonicalViewJson = serializeDesignerView(nextView);
    setProjection(p);
    setLocalModel(p.model);
    setView(nextView);
    setInitialViewport(nextView.viewport);
    setSavedViewJson(canonicalViewJson);
    setPendingOperations([]);
    setActiveLayoutMode(null);
  }, [definitionId]);

  const loadSecretReferences = useCallback(async () => {
    const result = await workflowsApi.listSecretReferences();
    setSecretReferences(result.references);
  }, []);

  const loadDataSources = useCallback(async () => {
    const result = await fetchDataSourcesList();
    setDataSources(result.items.map((item) => ({ id: item.id, name: item.name, type: item.type })));
  }, []);

  const loadEdgeApis = useCallback(async () => {
    setEdgeApis(await fetchPublishedEdgeApiOptions());
  }, []);

  useEffect(() => {
    void load();
    void loadSecretReferences();
    void loadDataSources();
    void loadEdgeApis();
  }, [load, loadSecretReferences, loadDataSources, loadEdgeApis]);

  const viewDirty = useMemo(() => isDesignerViewDirty(view, savedViewJson), [savedViewJson, view]);
  const isDirty = pendingOperations.length > 0 || viewDirty;
  const readOnly = useMemo(() => (projection ? isWorkflowPublished(projection) : false), [projection]);

  useEffect(() => {
    if (readOnly) {
      setPaletteOpen(false);
      setPendingConnection(null);
      setPendingReconnect(null);
    }
  }, [readOnly]);

  const workingProjection = useMemo<WorkflowDesignerProjection | null>(() => {
    if (!projection || !localModel) return null;
    return { ...projection, model: localModel };
  }, [localModel, projection]);

  const defaultFixturesJson = useMemo(
    () => (localModel && projection
      ? buildDefaultWorkflowFixtureSetJson(localModel, projection.actionCatalog)
      : '{"fixtures":{}}'),
    [localModel, projection],
  );

  useEffect(() => {
    setFixturesJson(defaultFixturesJson);
  }, [defaultFixturesJson]);

  const selectedNode: WorkflowNode | null = useMemo(
    () => localModel?.nodes.find((node) => node.key === selectedNodeKey) ?? null,
    [localModel, selectedNodeKey],
  );
  const pendingConnectionFromNode: WorkflowNode | null = useMemo(
    () => (pendingConnection ? localModel?.nodes.find((node) => node.key === pendingConnection.fromNodeKey) ?? null : null),
    [localModel, pendingConnection],
  );
  const pendingReconnectFromNode: WorkflowNode | null = useMemo(
    () => (pendingReconnect ? localModel?.nodes.find((node) => node.key === pendingReconnect.fromNodeKey) ?? null : null),
    [localModel, pendingReconnect],
  );
  const pendingReconnectEdge = useMemo(
    () => (pendingReconnect ? localModel?.edges.find((edge) => edge.key === pendingReconnect.edgeKey) ?? null : null),
    [localModel, pendingReconnect],
  );

  const queueOps = useCallback((operations: unknown[]) => {
    if (readOnly || operations.length === 0) return;
    setPendingOperations((current) => [...current, ...operations]);
    setLocalModel((current) => (current ? applyWorkflowDraftOperationsLocal(current, operations) : current));
  }, [readOnly]);

  const updateView = useCallback((updater: DesignerViewState | ((current: DesignerViewState) => DesignerViewState)) => {
    if (readOnly) return;
    setView((current) => (typeof updater === 'function' ? updater(current) : updater));
  }, [readOnly]);

  const updateViewport = useCallback((viewport: DesignerViewport) => {
    updateView((current) => ({ ...current, viewport }));
  }, [updateView]);

  const saveDraft = useCallback(async () => {
    if (!projection || !isDirty || readOnly) return;
    setBusy(true);
    setNotice(null);
    try {
      let draftVersion = projection.draftVersion;
      if (pendingOperations.length > 0) {
        const result = await workflowsApi.applyDraftOperations(definitionId, draftVersion, pendingOperations);
        draftVersion = (result.record as { draftVersion: number }).draftVersion;
      }
      if (viewDirty) {
        await workflowsApi.saveDesignerView(definitionId, draftVersion, serializeDesignerView(view));
      }
      await load();
    } catch (error) {
      if (error instanceof WorkflowsApiError && error.code === 'WF_DEF_STALE_DRAFT_VERSION') {
        setNotice('Draft changed elsewhere — reloading latest version.');
        await load();
      } else {
        setNotice(error instanceof WorkflowsApiError ? `${error.code}: ${error.message}` : 'Save failed.');
      }
      throw error;
    } finally {
      setBusy(false);
    }
  }, [definitionId, isDirty, load, pendingOperations, projection, readOnly, view, viewDirty]);

  const openProperties = useCallback((nodeKey: string) => {
    setSelectedNodeKey(nodeKey);
    setPropertiesOpen(true);
  }, []);

  useWorkflowEditorOverlayDeepLink({
    enabled: Boolean(projection && localModel),
    definitionId,
    executeOpen,
    setExecuteOpen,
    secretReferencesOpen,
    setSecretReferencesOpen,
    startSettingsOpen,
    setStartSettingsOpen,
    paletteOpen,
    setPaletteOpen,
    aiPanelOpen,
    setAiPanelOpen,
    fixturesOpen: outputSchemaOpen,
    setFixturesOpen: setOutputSchemaOpen,
    propertiesOpen,
    setPropertiesOpen,
    selectedNodeKey,
    openProperties,
    dossierDefinitionId,
    openDossier: onOpenDossier,
  });

  const handleRenameNode = useCallback((nodeKey: string, newKey: string) => {
    if (readOnly || !localModel) return;
    try {
      const operations = buildRenameNodeOperations(localModel, nodeKey, newKey);
      if (operations.length === 0) {
        return;
      }
      queueOps(operations);
      updateView((current) => {
        const position = current.nodePositions[nodeKey];
        const { [nodeKey]: _removed, ...rest } = current.nodePositions;
        return {
          ...current,
          nodePositions: position === undefined
            ? rest
            : { ...rest, [newKey.trim()]: position },
        };
      });
      setSelectedNodeKey((current) => (current === nodeKey ? newKey.trim() : current));
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Rename failed.');
    }
  }, [localModel, queueOps, readOnly, updateView]);

  const handleBack = () => {
    if (isDirty) {
      setLeaveOpen(true);
      return;
    }
    onBack();
  };

  const handleDropNode = (payload: WorkflowNodeDragPayload, position: { x: number; y: number }) => {
    if (readOnly || !localModel) return;
    const existingKeys = localModel.nodes.map((node) => node.key);
    const key = generateNodeKey(payload.nodeKind, existingKeys);
    let node = buildDefaultNode(payload.nodeKind, key);
    if (payload.actionKey && node.kind === 'ACTION' && node.actionRef && typeof node.actionRef === 'object') {
      const actionRef = node.actionRef as { action?: { actionKey?: string; actionVersion?: string } };
      node = { ...node, actionRef: { ...node.actionRef, action: { ...actionRef.action, actionKey: payload.actionKey } } };
    }
    queueOps([{ operationSchemaVersion: '1', type: 'ADD_NODE', node }]);
    updateView((current) => ({ ...current, nodePositions: { ...current.nodePositions, [key]: position } }));
  };

  const handleReconnectEdge = (edgeKey: string, fromNodeKey: string, toNodeKey: string, anchor: { x: number; y: number }) => {
    if (readOnly || !localModel) return;
    const existing = localModel.edges.find((edge) => edge.key === edgeKey);
    const fromNode = localModel.nodes.find((node) => node.key === fromNodeKey);
    if (!existing || !fromNode) return;

    const selectorType = existing.selector.type as EdgeSelectorType;
    const allowed = allowedSelectorTypesForSource(fromNode);
    const sourceChanged = fromNodeKey !== existing.fromNodeKey;
    const replacement = { ...existing, fromNodeKey, toNodeKey };

    queueOps([{
      operationSchemaVersion: '1',
      type: 'MODIFY_EDGE',
      edgeKey,
      replacement,
    }]);

    if (sourceChanged && !allowed.includes(selectorType)) {
      setPendingReconnect({ edgeKey, fromNodeKey, toNodeKey, anchor });
    }
  };

  const handleDataFlowChange = useCallback((state: DataFlowState | null) => {
    setDataFlowState(state);
  }, []);

  const applyGraphLayout = useCallback((mode: WorkflowGraphLayoutMode) => {
    if (!localModel || readOnly) {
      return;
    }
    const nodePositions = computeWorkflowGraphLayout(localModel, mode);
    updateView((current) => ({ ...current, nodePositions }));
    setActiveLayoutMode(mode);
    setFitViewRequestId((current) => current + 1);
  }, [localModel, readOnly, updateView]);

  const handleApplyAiOperations = useCallback((operations: unknown[]) => {
    if (readOnly || !localModel) return;
    queueOps(operations);
    // `applyGraphLayout` would read the pre-update `localModel` from its own closure (React state
    // updates from `queueOps` above are not yet visible here), so any newly added node would be
    // laid out against the OLD graph and miss its position. Compute the next model directly instead.
    const nextModel = applyWorkflowDraftOperationsLocal(localModel, operations);
    const nodePositions = computeWorkflowGraphLayout(nextModel, 'horizontal');
    updateView((current) => ({ ...current, nodePositions }));
    setActiveLayoutMode('horizontal');
    setFitViewRequestId((current) => current + 1);
  }, [localModel, queueOps, readOnly, updateView]);

  const executionEdgeStatusByKey = useMemo(
    () => (executionVisualState ? buildEdgeStatusByKey(executionVisualState) : undefined),
    [executionVisualState],
  );

  if (!projection || !localModel || !workingProjection) {
    return <div className="p-6 text-sm text-slate-500">Loading workflow…</div>;
  }

  const existingEdgeKeys = localModel.edges.map((edge) => edge.key);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-slate-200 bg-white px-3 py-[9px]">
        <div className="flex min-h-8 min-w-0 items-center justify-between gap-2 font-sans text-xs font-semibold text-slate-500 select-none">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <WorkspaceBackIcon
              ariaLabel="Back to workflows list"
              title="Back to list"
              onClick={handleBack}
            />
            <span
              className="min-w-0 truncate font-mono text-xs font-semibold text-slate-700"
              title={projection.definition.key}
            >
              {projection.definition.key}
            </span>
            <WorkflowPublishedSwitch
              definitionId={definitionId}
              projection={workingProjection}
              disabled={busy || isDirty}
              onChanged={() => {
                void load();
                onPublicationChanged?.();
              }}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AppButton
              intent="primary"
              size="sm"
              disabled={!isDirty || busy || readOnly}
              onClick={() => { void saveDraft(); }}
              title={readOnly ? 'Unpublish workflow to edit' : isDirty ? 'Save draft changes' : 'No unsaved changes'}
            >
              <Save className="h-3.5 w-3.5" /> Save
            </AppButton>
          </div>
        </div>
      </header>

      {notice ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">{notice}</div> : null}
      {readOnly ? <div className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-600">Published workflow — read-only. Unpublish to edit.</div> : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden">
        <GraphCanvas
          model={localModel}
          view={view}
          initialViewport={initialViewport}
          viewportSessionKey={definitionId}
          fitViewRequestId={fitViewRequestId}
          activeLayoutMode={activeLayoutMode}
          onApplyLayout={applyGraphLayout}
          readOnly={readOnly}
          selectedNodeKey={selectedNodeKey}
          nodeStatusByKey={executionVisualState?.nodeStatusByKey}
          edgeStatusByKey={executionEdgeStatusByKey}
          endOverlay={(
            <>
              <CanvasToolbar.Group fullWidthButtons>
                <WorkflowDossierButton
                  definitionId={definitionId}
                  workflowKey={projection.definition.key}
                  variant="header"
                  disabled={busy}
                  onOpen={() => onOpenDossier(definitionId)}
                />
                <AppButton intent={paletteOpen ? 'toggle-on' : 'toggle-off'} size="sm" disabled={readOnly || busy} title={readOnly ? 'Unpublish workflow to edit' : undefined} onClick={() => setPaletteOpen((v) => !v)}>
                  <Blocks className="h-3.5 w-3.5" /> Toolbox
                </AppButton>
              </CanvasToolbar.Group>
              <CanvasToolbar.Group fullWidthButtons>
                <AppButton intent={secretReferencesOpen ? 'toggle-on' : 'toggle-off'} size="sm" disabled={busy} onClick={() => setSecretReferencesOpen((v) => !v)}>
                  <Lock className="h-3.5 w-3.5" /> Secrets
                </AppButton>
                <AppButton intent={startSettingsOpen ? 'toggle-on' : 'toggle-off'} size="sm" disabled={busy} onClick={() => setStartSettingsOpen((v) => !v)}>
                  <Rocket className="h-3.5 w-3.5" /> Start
                </AppButton>
              </CanvasToolbar.Group>
              <CanvasToolbar.Group layout="stack" fullWidthButtons>
                <AppButton
                  intent={executeOpen ? 'toggle-on' : 'toggle-off'}
                  size="sm"
                  disabled={isDirty || busy}
                  title={isDirty ? 'Save draft before executing' : undefined}
                  onClick={() => setExecuteOpen((v) => !v)}
                >
                  <Play className="h-3.5 w-3.5" /> Execute
                </AppButton>
                <AppButton
                  intent={outputSchemaOpen ? 'toggle-on' : 'toggle-off'}
                  size="sm"
                  disabled={isDirty || busy}
                  title={isDirty ? 'Save draft before editing output schema' : 'Simulated node outcomes for execute runs'}
                  onClick={() => setOutputSchemaOpen(true)}
                >
                  <Braces className="h-3.5 w-3.5" /> Output Schema
                </AppButton>
                <AppButton
                  intent={aiPanelOpen ? 'toggle-on' : 'toggle-off'}
                  size="sm"
                  onClick={() => setAiPanelOpen((v) => !v)}
                  title="Ask the AI assistant about this workflow"
                >
                  <Bot className="h-3.5 w-3.5" /> AI Assistant
                </AppButton>
              </CanvasToolbar.Group>
            </>
          )}
          onSelectNode={setSelectedNodeKey}
          onMoveNode={(nodeKey, position) => {
            setActiveLayoutMode(null);
            updateView((current) => ({
              ...current,
              nodePositions: { ...current.nodePositions, [nodeKey]: position },
            }));
          }}
          onViewportChange={updateViewport}
          onRemoveEdge={(edgeKey) => queueOps([{ operationSchemaVersion: '1', type: 'REMOVE_EDGE', edgeKey }])}
          onReconnectEdge={handleReconnectEdge}
          onDropNode={handleDropNode}
          onConnectNodes={(fromNodeKey, toNodeKey, anchor) => setPendingConnection({ fromNodeKey, toNodeKey, anchor })}
          onOpenNodeProperties={openProperties}
          onRenameNode={handleRenameNode}
          onRemoveNode={(nodeKey) => {
            queueOps([{ operationSchemaVersion: '1', type: 'REMOVE_NODE', nodeKey }]);
            setSelectedNodeKey(null);
            setPropertiesOpen(false);
          }}
        />
        </div>
        {aiPanelOpen ? (
          <WorkflowDesignerAiPanel
            model={localModel}
            actionCatalog={projection.actionCatalog}
            readOnly={readOnly}
            onApplyOperations={handleApplyAiOperations}
          />
        ) : null}
      </div>

      <WorkflowSecretReferencesPanel
        open={secretReferencesOpen}
        onClose={() => setSecretReferencesOpen(false)}
        onChanged={() => void loadSecretReferences()}
      />

      <WorkflowStartSettingsPanel
        open={startSettingsOpen}
        onClose={() => setStartSettingsOpen(false)}
        definitionId={definitionId}
        projection={workingProjection}
        start={localModel.start}
        readOnly={readOnly}
        onSave={(start) => queueOps([{ operationSchemaVersion: '1', type: 'CHANGE_START', start }])}
      />

      <WorkflowPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        existingKeys={localModel.nodes.map((node) => node.key)}
        actionCatalog={projection.actionCatalog}
        onAddNode={(node) => queueOps([{ operationSchemaVersion: '1', type: 'ADD_NODE', node }])}
      />

      <NodePropertiesFloatingPanel
        open={propertiesOpen && !!selectedNode}
        onClose={() => setPropertiesOpen(false)}
        definitionId={definitionId}
        model={localModel}
        selectedNode={selectedNode}
        actionCatalog={projection.actionCatalog}
        secretReferences={secretReferences}
        dataSources={dataSources}
        edgeApis={edgeApis}
        dataFlowState={dataFlowState}
        busy={busy}
        readOnly={readOnly}
        onModifyNode={(nodeKey, replacement) => queueOps([{ operationSchemaVersion: '1', type: 'MODIFY_NODE', nodeKey, replacement }])}
      />

      {pendingConnection && pendingConnectionFromNode ? (
        <EdgeSelectorPopover
          anchor={pendingConnection.anchor}
          fromNode={pendingConnectionFromNode}
          toNodeKey={pendingConnection.toNodeKey}
          definitionId={definitionId}
          existingEdgeKeys={existingEdgeKeys}
          onSubmit={(edge) => {
            queueOps([{ operationSchemaVersion: '1', type: 'ADD_EDGE', edge }]);
            setPendingConnection(null);
          }}
          onClose={() => setPendingConnection(null)}
        />
      ) : null}

      {pendingReconnect && pendingReconnectFromNode && pendingReconnectEdge ? (
        <EdgeSelectorPopover
          mode="reconnect"
          edgeKey={pendingReconnect.edgeKey}
          initialSelector={pendingReconnectEdge.selector}
          anchor={pendingReconnect.anchor}
          fromNode={pendingReconnectFromNode}
          toNodeKey={pendingReconnect.toNodeKey}
          definitionId={definitionId}
          existingEdgeKeys={existingEdgeKeys}
          onSubmit={(edge) => {
            queueOps([{
              operationSchemaVersion: '1',
              type: 'MODIFY_EDGE',
              edgeKey: edge.key,
              replacement: edge,
            }]);
            setPendingReconnect(null);
          }}
          onClose={() => setPendingReconnect(null)}
        />
      ) : null}

      <WorkflowExecuteFixtureDialog
        open={outputSchemaOpen}
        onClose={() => setOutputSchemaOpen(false)}
        value={fixturesJson}
        onChange={setFixturesJson}
        documentKey={`workflow-fixtures-${definitionId}-${projection.draftVersion}`}
      />

      <WorkflowExecutePanel
        open={executeOpen}
        onClose={() => setExecuteOpen(false)}
        definitionId={definitionId}
        draftVersion={projection.draftVersion}
        model={localModel}
        fixturesJson={fixturesJson}
        onExecutionVisualChange={setExecutionVisualState}
        onDataFlowChange={handleDataFlowChange}
      />

      <ConfirmDialogShell
        open={leaveOpen}
        title="Unsaved changes"
        onClose={() => setLeaveOpen(false)}
        hideCancel
        hideConfirm
        footer={(
          <>
            <AppButton intent="cancel" size="sm" onClick={() => setLeaveOpen(false)} disabled={busy}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </AppButton>
            <AppButton intent="destructive-soft" size="sm" onClick={() => { setLeaveOpen(false); onBack(); }} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" />
              Don&apos;t save
            </AppButton>
            <AppButton
              intent="primary"
              size="sm"
              disabled={busy}
              onClick={() => {
                void saveDraft()
                  .then(() => {
                    setLeaveOpen(false);
                    onBack();
                  })
                  .catch(() => {
                    // saveDraft surfaces the error banner; keep the dialog open.
                  });
              }}
            >
              <Save className="h-3.5 w-3.5" /> Save
            </AppButton>
          </>
        )}
      >
        <p className="text-sm text-slate-700">You have unsaved draft changes. Save before leaving this workflow?</p>
      </ConfirmDialogShell>

      <WorkflowWorkspaceMetadataFooter
        createdAt={projection.definition.createdAt}
        createdBy={projection.definition.createdBy}
        updatedAt={projection.definition.updatedAt}
        updatedBy={projection.definition.updatedBy}
        publicationStatus={projection.publicationStatus}
      />
    </div>
  );
};
