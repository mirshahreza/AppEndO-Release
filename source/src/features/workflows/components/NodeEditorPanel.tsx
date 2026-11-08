import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Braces, FormInput } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { STEP_WIZARD_STEP_CELL_CLASS } from '../../../shared/ui/surfaceClasses';
import { MonacoEditorPanel } from '../../server-functions/components/MonacoEditorPanel';
import type { WorkflowDataSourceOption, WorkflowEdgeApiOption, WorkflowModel, WorkflowNode, WorkflowSecretReference } from '../types';
import { NodeKindForm, NODE_KINDS_WITH_FORM } from './NodeKindForm';
import { buildOutputFieldPathsIndex, type ActionCatalogEntry } from './actionCatalogUtils';

export type NodeEditorViewMode = 'form' | 'json';

const NODE_JSON_MONACO_OPTIONS = {
  fontSize: 12,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  minimap: { enabled: false },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 8, bottom: 8 },
  wordWrap: 'on',
  domReadOnly: false,
  readOnly: false,
  glyphMargin: false,
  folding: true,
  lineDecorationsWidth: 4,
  renderLineHighlight: 'line',
} as const;

export type NodeEditorPanelHandle = {
  switchToForm: () => void;
  switchToJson: () => void;
  save: () => Promise<void>;
};

const viewHeaderCellClass = (active: boolean) => cn(
  STEP_WIZARD_STEP_CELL_CLASS,
  'flex-1 !flex-row gap-1.5 py-2',
  active ? 'bg-primary-subtle text-primary-700' : 'text-text-nav hover:bg-slate-50/80',
);

const viewHeaderFormIconClass = (active: boolean) => cn(
  'h-3.5 w-3.5 shrink-0',
  active ? 'text-indigo-600' : 'text-indigo-500',
);

const viewHeaderJsonIconClass = (active: boolean) => cn(
  'h-3.5 w-3.5 shrink-0',
  active ? 'text-cyan-600' : 'text-cyan-500',
);

export const NodeEditorViewHeader: React.FC<{
  view: NodeEditorViewMode;
  onSelectForm: () => void;
  onSelectJson: () => void;
}> = ({ view, onSelectForm, onSelectJson }) => (
  <div className="flex w-full bg-surface-shell">
    <button
      type="button"
      aria-current={view === 'form' ? 'true' : undefined}
      className={viewHeaderCellClass(view === 'form')}
      onClick={onSelectForm}
    >
      <FormInput className={viewHeaderFormIconClass(view === 'form')} aria-hidden />
      <span className="truncate text-[11px] font-semibold leading-tight">Form</span>
    </button>
    <button
      type="button"
      aria-current={view === 'json' ? 'true' : undefined}
      className={cn(viewHeaderCellClass(view === 'json'), 'last:border-e-0')}
      onClick={onSelectJson}
    >
      <Braces className={viewHeaderJsonIconClass(view === 'json')} aria-hidden />
      <span className="truncate text-[11px] font-semibold leading-tight">JSON</span>
    </button>
  </div>
);

/**
 * Node properties surface — rendered inside `NodePropertiesFloatingPanel`'s modal dialog (opened
 * on double-click / hover-properties-icon from `GraphCanvas`). A bespoke field-level form for the 10
 * kinds that carry at least one author-facing field (see `NodeKindForm.tsx`; PARALLEL_SPLIT is the
 * only kind with nothing to form) + a raw-JSON fallback (toggle "Form" / "JSON"). New nodes live in
 * `WorkflowPalette`; new edges are created via drag-to-connect (`EdgeSelectorPopover`). Every save
 * round-trips through `applyDraftOperations` (MODIFY_NODE), which re-validates the canonical AWM
 * schema.
 */
export const NodeEditorPanel = forwardRef<NodeEditorPanelHandle, {
  definitionId: number;
  model: WorkflowModel;
  selectedNode: WorkflowNode | null;
  actionCatalog: ActionCatalogEntry[];
  secretReferences?: WorkflowSecretReference[];
  dataSources?: WorkflowDataSourceOption[];
  edgeApis?: WorkflowEdgeApiOption[];
  view: NodeEditorViewMode;
  onViewChange: (view: NodeEditorViewMode) => void;
  onModifyNode: (nodeKey: string, replacement: WorkflowNode) => Promise<void>;
}>(({ definitionId, model, selectedNode, actionCatalog, secretReferences, dataSources, edgeApis, view, onViewChange, onModifyNode }, ref) => {
  const [draftNode, setDraftNode] = useState<WorkflowNode | null>(null);
  const [nodeJson, setNodeJson] = useState('');
  const [error, setError] = useState<string | null>(null);

  const outputFieldPathsIndex = useMemo(() => buildOutputFieldPathsIndex(model, actionCatalog), [model, actionCatalog]);
  const getOutputFieldPaths = useCallback((nodeKey: string) => outputFieldPathsIndex[nodeKey] ?? [], [outputFieldPathsIndex]);
  const getOutputFieldNames = useCallback((nodeKey: string) => (outputFieldPathsIndex[nodeKey] ?? []).filter((segments) => segments.length === 1).map((segments) => segments[0]!), [outputFieldPathsIndex]);

  useEffect(() => {
    setDraftNode(selectedNode);
    setNodeJson(selectedNode ? JSON.stringify(selectedNode, null, 2) : '');
    onViewChange(selectedNode && NODE_KINDS_WITH_FORM.has(selectedNode.kind) ? 'form' : 'json');
    setError(null);
  }, [onViewChange, selectedNode]);

  const switchToJson = useCallback(() => {
    if (draftNode) setNodeJson(JSON.stringify(draftNode, null, 2));
    onViewChange('json');
  }, [draftNode, onViewChange]);

  const switchToForm = useCallback(() => {
    try {
      if (view === 'json') setDraftNode(JSON.parse(nodeJson) as WorkflowNode);
      setError(null);
      onViewChange('form');
    } catch {
      setError('Invalid JSON — fix it before switching to the form view.');
    }
  }, [nodeJson, onViewChange, view]);

  const saveNode = useCallback(async () => {
    if (!selectedNode) return;
    try {
      const parsed = view === 'json' ? (JSON.parse(nodeJson) as WorkflowNode) : draftNode;
      if (!parsed) return;
      if (parsed.key !== selectedNode.key) {
        setError('MODIFY_NODE cannot rename a key — remove and re-add instead.');
        return;
      }
      setError(null);
      await onModifyNode(selectedNode.key, parsed);
    } catch {
      setError('Invalid JSON.');
    }
  }, [draftNode, nodeJson, onModifyNode, selectedNode, view]);

  useImperativeHandle(ref, () => ({ switchToForm, switchToJson, save: saveNode }), [switchToForm, switchToJson, saveNode]);

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col text-sm',
        view === 'form' ? 'overflow-y-auto p-3' : 'overflow-hidden',
      )}
    >
      {selectedNode && draftNode ? (
        view === 'form' ? (
          <div className="flex flex-col gap-2">
            <NodeKindForm node={draftNode} model={model} definitionId={definitionId} actionCatalog={actionCatalog} onChange={setDraftNode} getOutputFieldNames={getOutputFieldNames} getOutputFieldPaths={getOutputFieldPaths} secretReferences={secretReferences} dataSources={dataSources} edgeApis={edgeApis} />
            {error ? <div className="text-xs text-red-600">{error}</div> : null}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {error ? (
              <div className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
                {error}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-hidden" data-floating-panel-drag-exclude>
              <MonacoEditorPanel
                documentKey={`workflow-node-json-${definitionId}-${selectedNode.key}`}
                defaultLanguage="json"
                language="json"
                value={nodeJson}
                onChange={(next) => setNodeJson(next ?? '')}
                options={NODE_JSON_MONACO_OPTIONS}
              />
            </div>
          </div>
        )
      ) : (
        <p className="text-xs text-slate-500">Click a node in the canvas to edit it.</p>
      )}
    </div>
  );
});

NodeEditorPanel.displayName = 'NodeEditorPanel';
