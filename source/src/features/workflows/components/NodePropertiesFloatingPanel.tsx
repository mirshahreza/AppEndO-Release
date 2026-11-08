import React, { useMemo, useRef, useState } from 'react';
import { Check, Settings2 } from 'lucide-react';
import { AppButton, CreateEditModalShell, WorkspaceVerticalSplitHandle, useWorkspaceVerticalSplitPanel, WORKSPACE_SPLIT_PANEL_KEYS } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { kindColor } from './GraphCanvas';
import { NODE_KINDS_WITH_FORM } from './NodeKindForm';
import {
  NodeEditorPanel,
  NodeEditorViewHeader,
  type NodeEditorPanelHandle,
  type NodeEditorViewMode,
} from './NodeEditorPanel';
import type { DataFlowState, DataFlowStep } from '../lib/executionDataFlow';
import type { ActionCatalogEntry } from './actionCatalogUtils';
import type { NodeKind } from './nodeTemplates';
import type { WorkflowDataSourceOption, WorkflowEdgeApiOption, WorkflowModel, WorkflowNode, WorkflowSecretReference } from '../types';

const DATA_COLUMN_MIN = 220;
const DATA_COLUMN_MAX = 560;

const JsonPreviewBlock: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  const text = value === undefined ? '—' : JSON.stringify(value, null, 2);
  return (
    <div className="flex min-w-0 flex-col gap-[2px]">
      <span className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <pre className="max-h-full overflow-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] leading-relaxed text-slate-700">
        {text}
      </pre>
    </div>
  );
};

const findLatestNodeStep = (steps: DataFlowStep[] | undefined, nodeKey: string): DataFlowStep | undefined => {
  if (!steps) return undefined;
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step.kind === 'NODE' && step.nodeKey === nodeKey) return step;
  }
  return undefined;
};

/** Predecessor node keys for `nodeKey` — every edge feeding directly into it, in declaration order, deduped. */
const findPredecessorNodeKeys = (model: WorkflowModel, nodeKey: string): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const edge of model.edges) {
    if (edge.toNodeKey === nodeKey && !seen.has(edge.fromNodeKey)) {
      seen.add(edge.fromNodeKey);
      result.push(edge.fromNodeKey);
    }
  }
  return result;
};

const NoLiveDataNotice: React.FC<{ text: string }> = ({ text }) => (
  <p className="px-2 py-3 text-[11px] text-slate-400">{text}</p>
);

const PredecessorOutputColumn: React.FC<{ model: WorkflowModel; nodeKey: string; dataFlowState: DataFlowState | null }> = ({ model, nodeKey, dataFlowState }) => {
  const predecessorKeys = useMemo(() => findPredecessorNodeKeys(model, nodeKey), [model, nodeKey]);

  if (predecessorKeys.length === 0) {
    return <NoLiveDataNotice text="This is a start node — no incoming node feeds it." />;
  }

  return (
    <div className="flex flex-col gap-3 p-2">
      {predecessorKeys.map((predKey) => {
        const step = findLatestNodeStep(dataFlowState?.steps, predKey);
        return (
          <div key={predKey} className="flex flex-col gap-1">
            <span className="truncate text-xs font-semibold text-slate-800">{predKey}</span>
            {step ? (
              <JsonPreviewBlock label="Output" value={step.produced} />
            ) : (
              <NoLiveDataNotice text="Run Execute (simulation) to see this node's real output here." />
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Modal dialog for editing a workflow node. Opened on double-click or the node's hover properties
 * icon (`GraphCanvas.tsx`), closed explicitly — a plain single click on a node only highlights it
 * (`WorkflowEditorWorkspace`'s `selectedNodeKey`), it does not force this dialog open.
 *
 * Uses a 2-column layout: left = the immediately-preceding node's real output (from the last
 * Execute/simulation run, `dataFlowState` — empty-state if none has run yet), right = the node
 * editor. A draggable splitter lets the user resize the input column within the dialog.
 */
export const NodePropertiesFloatingPanel: React.FC<{
  open: boolean;
  onClose: () => void;
  definitionId: number;
  model: WorkflowModel;
  selectedNode: WorkflowNode | null;
  actionCatalog: ActionCatalogEntry[];
  secretReferences?: WorkflowSecretReference[];
  dataSources?: WorkflowDataSourceOption[];
  edgeApis?: WorkflowEdgeApiOption[];
  dataFlowState: DataFlowState | null;
  onModifyNode: (nodeKey: string, replacement: WorkflowNode) => Promise<void>;
  busy: boolean;
  readOnly?: boolean;
}> = ({
  open,
  onClose,
  definitionId,
  model,
  selectedNode,
  actionCatalog,
  secretReferences,
  dataSources,
  edgeApis,
  dataFlowState,
  onModifyNode,
  busy,
  readOnly = false,
}) => {
  const [view, setView] = useState<NodeEditorViewMode>('form');
  const editorRef = useRef<NodeEditorPanelHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const showViewToggle = selectedNode != null && NODE_KINDS_WITH_FORM.has(selectedNode.kind as NodeKind);

  const leftSplit = useWorkspaceVerticalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.workflowNodePropertiesInput,
    defaultSize: 280,
    minSize: DATA_COLUMN_MIN,
    maxSize: DATA_COLUMN_MAX,
    measure: 'leading',
    containerRef,
    side: 'start',
  });

  if (!open) {
    return null;
  }

  const titleLabel = selectedNode ? `${selectedNode.key} (${selectedNode.kind})` : 'Node properties';

  return (
    <CreateEditModalShell
      size="maximized"
      title={(
        <span className="flex min-w-0 items-center gap-1.5">
          <Settings2
            className="h-4 w-4 shrink-0"
            style={{ color: selectedNode ? kindColor(selectedNode.kind) : undefined }}
            aria-hidden
          />
          <span className="truncate">{titleLabel}</span>
        </span>
      )}
      gradient={false}
      shellClassName="flex min-h-0 flex-col overflow-hidden"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0 !p-0"
      footerClassName="!mt-0 !justify-center"
      onClose={onClose}
      onBackdropClick={onClose}
      footer={selectedNode ? (
        <AppButton
          intent="primary"
          size="sm"
          className="!px-[37px]"
          disabled={busy || readOnly}
          title={readOnly ? 'Unpublish workflow to edit' : undefined}
          onClick={() => { void editorRef.current?.save(); }}
        >
          <Check className="h-3.5 w-3.5" />
          Apply Changes
        </AppButton>
      ) : undefined}
    >
      <div
        ref={containerRef}
        className={cn(
          'flex min-h-0 flex-1 flex-row overflow-hidden',
          leftSplit.isResizing && 'select-none',
        )}
      >
        <div
          className="hidden min-h-0 shrink-0 flex-col overflow-y-auto border-e border-slate-200 bg-white xl:flex"
          style={{ width: `${leftSplit.size}px` }}
        >
          <div className="border-b border-slate-200 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Input — from previous node
          </div>
          {selectedNode ? (
            <PredecessorOutputColumn model={model} nodeKey={selectedNode.key} dataFlowState={dataFlowState} />
          ) : null}
        </div>

        <WorkspaceVerticalSplitHandle {...leftSplit.splitHandleProps} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {showViewToggle ? (
            <NodeEditorViewHeader
              view={view}
              onSelectForm={() => editorRef.current?.switchToForm()}
              onSelectJson={() => editorRef.current?.switchToJson()}
            />
          ) : null}
          <div className="min-h-0 flex-1 overflow-hidden">
            <NodeEditorPanel
              ref={editorRef}
              definitionId={definitionId}
              model={model}
              selectedNode={selectedNode}
              actionCatalog={actionCatalog}
              secretReferences={secretReferences}
              dataSources={dataSources}
              edgeApis={edgeApis}
              view={view}
              onViewChange={setView}
              onModifyNode={onModifyNode}
            />
          </div>
        </div>
      </div>
    </CreateEditModalShell>
  );
};
