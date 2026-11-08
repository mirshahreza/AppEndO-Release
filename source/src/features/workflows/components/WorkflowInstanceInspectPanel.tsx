import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppButton, ConfirmDialogShell } from '../../../shared/ui';
import { workflowsApi } from '../api/workflowsApi';
import { workflowProofApi, workflowRuntimeApi, WorkflowRuntimeApiError } from '../api/workflowRuntimeApi';
import type { WorkflowInstanceInspectTarget, WorkflowInstanceInspection, WorkflowModel, WorkflowProofEntry } from '../types';
import { GraphCanvas, type NodeRuntimeStatus } from './GraphCanvas';
import { buildEdgeStatusByKey, reduceProofAndNodeInstances } from '../lib/executionVisualization';
import { WorkflowExecutionTimeline } from './WorkflowExecutionTimeline';
import { WorkflowNodeTraceLog } from './WorkflowNodeTraceLog';

type PendingAction = { kind: 'cancel' } | { kind: 'force-new-invocation'; nodeInstanceId: number };

const statusPillClass = (status: string): string => {
  switch (status) {
    case 'RUNNING':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'SUSPENDED':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'SUCCEEDED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'FAILED':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'CANCELLED':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
};

export const WorkflowInstanceInspectPanel: React.FC<{
  instance: WorkflowInstanceInspectTarget;
  onBack: () => void;
  onInstanceMutated?: () => void;
}> = ({ instance, onBack, onInstanceMutated }) => {
  const [inspection, setInspection] = useState<WorkflowInstanceInspection | null>(null);
  const [model, setModel] = useState<WorkflowModel | null>(null);
  const [proof, setProof] = useState<WorkflowProofEntry[]>([]);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'timeline'>('graph');

  const load = useCallback(async () => {
    const [inspectResult, revisionResult, proofResult] = await Promise.all([
      workflowRuntimeApi.inspect(instance.id),
      workflowsApi.getRevision(instance.workflowRevisionId),
      workflowProofApi.getProof(instance.id),
    ]);
    setInspection(inspectResult);
    setModel(JSON.parse(revisionResult.revision.definitionJson) as WorkflowModel);
    setProof(proofResult.entries);
  }, [instance.id, instance.workflowRevisionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isLiveInstance = inspection?.instance.status === 'RUNNING' || inspection?.instance.status === 'CREATED';

  useEffect(() => {
    if (!isLiveInstance) return;
    const intervalId = setInterval(() => {
      void load();
    }, 1500);
    return () => clearInterval(intervalId);
  }, [isLiveInstance, load]);

  const executionVisualState = useMemo(
    () => (inspection ? reduceProofAndNodeInstances(proof, inspection.nodeInstances) : null),
    [inspection, proof],
  );

  const nodeStatusByKey = useMemo<Record<string, NodeRuntimeStatus>>(
    () => executionVisualState?.nodeStatusByKey ?? {},
    [executionVisualState],
  );

  const edgeStatusByKey = useMemo(
    () => (executionVisualState ? buildEdgeStatusByKey(executionVisualState) : undefined),
    [executionVisualState],
  );

  const selectedNode = useMemo(
    () => inspection?.nodeInstances.find((n) => n.semanticNodeKey === selectedNodeKey) ?? null,
    [inspection, selectedNodeKey],
  );
  const selectedNodeAttempts = selectedNode ? inspection?.attemptsByNodeInstanceId[selectedNode.id] ?? [] : [];
  const selectedNodeTrace = useMemo(
    () => (selectedNode ? proof.filter((entry) => entry.nodeInstanceId === selectedNode.id) : []),
    [proof, selectedNode],
  );

  const withBusyGuard = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await load();
      onInstanceMutated?.();
    } catch (error) {
      if (error instanceof WorkflowRuntimeApiError && error.code === 'WF_EXEC_STALE_STATE_VERSION') {
        setNotice('State changed elsewhere — reloading latest.');
        await load();
        onInstanceMutated?.();
      } else {
        setNotice(error instanceof WorkflowRuntimeApiError ? `${error.code}: ${error.message}` : 'Operation failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!inspection || !model) {
    return <div className="flex h-48 items-center justify-center p-6 text-sm text-slate-500">Loading instance…</div>;
  }

  const { instance: liveInstance } = inspection;
  const canSuspend = liveInstance.status === 'RUNNING';
  const canResume = liveInstance.status === 'SUSPENDED';
  const canCancel = liveInstance.status === 'CREATED' || liveInstance.status === 'RUNNING' || liveInstance.status === 'SUSPENDED';

  return (
    <div className="flex min-h-[32rem] flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <button type="button" onClick={onBack} className="shrink-0 self-start text-xs text-slate-500 hover:underline">
            ← 360° view
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-slate-900">
              <span className="truncate">{instance.workflowDefinitionKey}</span>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${statusPillClass(liveInstance.status)}`}>{liveInstance.status}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              instance #{liveInstance.id} · revision v{instance.revisionNumber} · stateVersion {liveInstance.stateVersion}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <div className="flex rounded-md border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`rounded px-2 py-1 text-[11px] font-semibold ${viewMode === 'graph' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Graph
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`rounded px-2 py-1 text-[11px] font-semibold ${viewMode === 'timeline' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Timeline
            </button>
          </div>
          <AppButton size="sm" intent="secondary" disabled={busy || !canSuspend} onClick={() => withBusyGuard(() => workflowRuntimeApi.suspend(liveInstance.id, liveInstance.stateVersion).then(() => undefined))}>
            Suspend
          </AppButton>
          <AppButton size="sm" intent="primary" disabled={busy || !canResume} onClick={() => withBusyGuard(() => workflowRuntimeApi.resume(liveInstance.id, liveInstance.stateVersion).then(() => undefined))}>
            Resume
          </AppButton>
          <AppButton size="sm" intent="destructive" disabled={busy || !canCancel} onClick={() => setPendingAction({ kind: 'cancel' })}>
            Cancel
          </AppButton>
        </div>
      </header>

      {notice ? <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">{notice}</div> : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {viewMode === 'graph' ? (
            <GraphCanvas
              model={model}
              view={{ nodePositions: {} }}
              selectedNodeKey={selectedNodeKey}
              onSelectNode={setSelectedNodeKey}
              onMoveNode={() => undefined}
              onRemoveEdge={() => undefined}
              readOnly
              nodeStatusByKey={nodeStatusByKey}
              edgeStatusByKey={edgeStatusByKey}
            />
          ) : (
            <div className="w-full">
              <WorkflowExecutionTimeline proof={proof} nodeInstances={inspection.nodeInstances} onSelectNode={setSelectedNodeKey} />
            </div>
          )}
        </div>

        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white lg:w-96">
          {selectedNode ? (
            <section className="p-3 text-sm">
              <h3 className="mb-1 font-semibold text-slate-700">Node: {selectedNode.semanticNodeKey}</h3>
              <div className="mb-2 text-xs text-slate-500">
                status <span className={`rounded border px-1 py-0.5 font-semibold ${statusPillClass(selectedNode.status)}`}>{selectedNode.status}</span> · stateVersion {selectedNode.stateVersion}
              </div>
              {selectedNode.status === 'RETRYING' ? (
                <AppButton size="sm" intent="primary" disabled={busy} onClick={() => withBusyGuard(() => workflowRuntimeApi.retryNode(selectedNode.id, selectedNode.stateVersion).then(() => undefined))}>
                  Retry now
                </AppButton>
              ) : null}
              {selectedNode.status === 'RUNNING' ? (
                <AppButton size="sm" intent="warning" disabled={busy} onClick={() => setPendingAction({ kind: 'force-new-invocation', nodeInstanceId: selectedNode.id })}>
                  Force new invocation…
                </AppButton>
              ) : null}
              {selectedNodeAttempts.length > 0 ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-700">Attempts</div>
                  <ul className="mt-1 space-y-1">
                    {selectedNodeAttempts.map((attempt) => (
                      <li key={attempt.id} className="font-mono text-[11px] text-slate-600">
                        #{attempt.id} {attempt.status}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-700">Trace</div>
                <div className="mt-1">
                  <WorkflowNodeTraceLog entries={selectedNodeTrace} />
                </div>
              </div>
            </section>
          ) : (
            <div className="p-3 text-xs text-slate-500">Click a node in the graph or timeline to inspect it.</div>
          )}
        </aside>
      </div>

      {pendingAction?.kind === 'cancel' ? (
        <ConfirmDialogShell
          title="Cancel this instance?"
          confirmIntent="destructive"
          confirmLabel="Cancel instance"
          isConfirming={busy}
          onClose={() => setPendingAction(null)}
          onConfirm={() => {
            void withBusyGuard(() => workflowRuntimeApi.cancel(liveInstance.id, liveInstance.stateVersion).then(() => undefined)).then(() => setPendingAction(null));
          }}
        >
          This cancels every non-terminal node, active wait and active Work Item on this instance. This cannot be undone.
        </ConfirmDialogShell>
      ) : null}

      {pendingAction?.kind === 'force-new-invocation' ? (
        <ConfirmDialogShell
          title="Force a new invocation?"
          confirmIntent="destructive"
          confirmLabel="Force new invocation"
          isConfirming={busy}
          onClose={() => setPendingAction(null)}
          onConfirm={() => {
            const action = pendingAction;
            void withBusyGuard(() => workflowRuntimeApi.forceNewInvocation(action.nodeInstanceId, `operator-${Date.now()}`).then(() => undefined)).then(() => setPendingAction(null));
          }}
        >
          The prior attempt may have already produced a real external effect. This cancels it and dispatches a fresh attempt with a new logical-invocation identity — a duplicate effect is possible.
        </ConfirmDialogShell>
      ) : null}
    </div>
  );
};
