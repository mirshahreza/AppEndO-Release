import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import {
  AppButton,
  FloatingPanelShell,
  type FloatingPanelShellHandle,
  WorkspaceHorizontalSplitHandle,
  WORKSPACE_SPLIT_PANEL_KEYS,
  useWorkspaceHorizontalSplitPanel,
} from '../../../shared/ui';
import { MonacoEditorPanel } from '../../server-functions/components/MonacoEditorPanel';
import { workflowsApi, WorkflowsApiError } from '../api/workflowsApi';
import { buildDefaultWorkflowInputJson } from '../lib/buildDefaultWorkflowInput';
import {
  activeStepIdForEvidenceIndex,
  buildDataFlowFromSimulationEvidence,
  type DataFlowState,
} from '../lib/executionDataFlow';
import {
  inferFailedNodeKeyFromEvidence,
  reduceSimulationEvidence,
  type ExecutionVisualState,
} from '../lib/executionVisualization';
import type { JsonValue, WorkflowExecuteEvidenceEntry, WorkflowModel } from '../types';

const EXECUTION_REPLAY_STEP_MS = 320;

const WORKFLOW_INPUT_MONACO_OPTIONS = {
  fontSize: 12,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  minimap: { enabled: false },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 0, bottom: 0 },
  wordWrap: 'on',
  domReadOnly: false,
  readOnly: false,
  glyphMargin: false,
  folding: true,
  lineDecorationsWidth: 4,
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
} as const;

const EXECUTE_PANEL_BOUNDS = { minWidth: 420, maxWidth: 960, minHeight: 360, maximizeInset: 24 };

function formatRunError(err: unknown): string {
  if (err instanceof WorkflowsApiError) {
    return err.code && !err.code.startsWith('HTTP_') ? `${err.code}: ${err.message}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Invalid JSON or workflow execution error.';
}

type WorkflowExecutePanelProps = {
  open: boolean;
  onClose: () => void;
  definitionId: number;
  draftVersion: number;
  model: WorkflowModel;
  fixturesJson: string;
  onExecutionVisualChange?: (state: ExecutionVisualState | null) => void;
  onDataFlowChange?: (state: DataFlowState | null) => void;
};

export const WorkflowExecutePanel: React.FC<WorkflowExecutePanelProps> = ({
  open,
  onClose,
  definitionId,
  draftVersion,
  model,
  fixturesJson,
  onExecutionVisualChange,
  onDataFlowChange,
}) => {
  const panelRef = useRef<FloatingPanelShellHandle>(null);
  const autoMinimizedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultWorkflowInputJson = useMemo(() => buildDefaultWorkflowInputJson(model), [model]);
  const [workflowInputJson, setWorkflowInputJson] = useState(defaultWorkflowInputJson);
  const [busy, setBusy] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [outcome, setOutcome] = useState<unknown>(null);
  const [evidence, setEvidence] = useState<WorkflowExecuteEvidenceEntry[]>([]);
  const [missing, setMissing] = useState<Array<{ nodeKey: string; resolvedActionRef?: { actionKey: string; actionVersion: string } }>>([]);
  const [error, setError] = useState<string | null>(null);

  const inputHeightSplit = useWorkspaceHorizontalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.workflowExecuteInputHeight,
    defaultSize: 220,
    minSize: 120,
    maxSize: 720,
    measure: 'leading',
    containerRef,
    displayClassName: 'block',
  });

  useEffect(() => {
    if (!open) return;
    setWorkflowInputJson(defaultWorkflowInputJson);
    setOutcome(null);
    setEvidence([]);
    setMissing([]);
    setError(null);
  }, [defaultWorkflowInputJson, definitionId, draftVersion, open]);

  useEffect(
    () => () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
      }
    },
    [],
  );

  const replayEvidence = useCallback((entries: WorkflowExecuteEvidenceEntry[], runOutcome: unknown, workflowInput: unknown) => {
    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }

    const steps = buildDataFlowFromSimulationEvidence(entries, { workflowInput: workflowInput as JsonValue, outcome: runOutcome });
    if (entries.length === 0) {
      setIsReplaying(false);
      onExecutionVisualChange?.(null);
      onDataFlowChange?.(null);
      return;
    }

    setIsReplaying(true);

    const failedNodeKey = runOutcome && typeof runOutcome === 'object' && (runOutcome as { status?: string }).status === 'FAILED'
      ? inferFailedNodeKeyFromEvidence(entries)
      : null;

    const publishReplay = (evidenceIndex: number) => {
      onExecutionVisualChange?.(reduceSimulationEvidence(entries, evidenceIndex, {
        markFailedNodeKey: evidenceIndex >= entries.length ? failedNodeKey : null,
      }));
      onDataFlowChange?.({
        steps,
        activeStepId: activeStepIdForEvidenceIndex(steps, evidenceIndex),
      });
    };

    let step = 0;
    const tick = () => {
      step += 1;
      publishReplay(step);
      if (step < entries.length) {
        replayTimerRef.current = setTimeout(tick, EXECUTION_REPLAY_STEP_MS);
      } else {
        setIsReplaying(false);
      }
    };

    publishReplay(0);
    replayTimerRef.current = setTimeout(tick, EXECUTION_REPLAY_STEP_MS);
  }, [onDataFlowChange, onExecutionVisualChange]);

  const run = useCallback(async () => {
    setBusy(true);
    setIsReplaying(false);
    setError(null);
    setOutcome(null);
    setEvidence([]);
    setMissing([]);
    onExecutionVisualChange?.(null);
    onDataFlowChange?.(null);
    try {
      const workflowInput = JSON.parse(workflowInputJson);
      const fixtureSet = JSON.parse(fixturesJson);
      const result = await workflowsApi.runWorkflowExecute({
        source: { type: 'DRAFT', workflowDefinitionId: definitionId, expectedDraftVersion: draftVersion },
        mode: { type: 'FULL', workflowInput },
        fixtureSet,
      });
      setOutcome(result.outcome);
      const nextEvidence = result.evidence as WorkflowExecuteEvidenceEntry[];
      setEvidence(nextEvidence);
      setMissing(result.missingFixturePaths as typeof missing);
      replayEvidence(nextEvidence, result.outcome, workflowInput);
    } catch (err) {
      setError(formatRunError(err));
      onExecutionVisualChange?.(null);
      onDataFlowChange?.(null);
    } finally {
      setBusy(false);
    }
  }, [definitionId, draftVersion, fixturesJson, onDataFlowChange, onExecutionVisualChange, replayEvidence, workflowInputJson]);

  const isRunning = busy || isReplaying;

  useEffect(() => {
    if (!open) {
      autoMinimizedRef.current = false;
      return;
    }

    if (isRunning) {
      if (!autoMinimizedRef.current) {
        panelRef.current?.minimize();
        autoMinimizedRef.current = true;
      }
      return;
    }

    if (autoMinimizedRef.current) {
      panelRef.current?.restore();
      autoMinimizedRef.current = false;
    }
  }, [isRunning, open]);

  return (
    <FloatingPanelShell
      ref={panelRef}
      open={open}
      onClose={() => {
        if (replayTimerRef.current) {
          clearTimeout(replayTimerRef.current);
          replayTimerRef.current = null;
        }
        setIsReplaying(false);
        autoMinimizedRef.current = false;
        onClose();
      }}
      title="Execute"
      titleIcon={<Play className="h-4 w-4 text-indigo-600" />}
      headerExtra={isRunning ? <Loader2 className="ms-2 h-3.5 w-3.5 animate-spin text-indigo-600" aria-hidden /> : undefined}
      bounds={EXECUTE_PANEL_BOUNDS}
      defaultWidth={520}
      defaultHeight={620}
      initialPosition="center"
      minimizedAnchor="bottom-left"
      zIndexClassName="z-[91]"
      headerClassName="h-10 px-3"
      titleClassName="text-sm font-semibold text-slate-800"
      dragFromHeaderOnly
      footer={(
        <div className="flex justify-end px-3 py-2">
          <AppButton intent="primary" size="sm" disabled={busy} onClick={() => { void run(); }}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Execute Workflow
          </AppButton>
        </div>
      )}
    >
      <div
        ref={containerRef}
        className={`flex h-full min-h-0 flex-col overflow-hidden ${inputHeightSplit.isResizing ? 'select-none' : ''}`}
      >
        <section
          className="flex min-h-0 flex-col overflow-hidden border-b border-slate-200"
          style={{ height: `${inputHeightSplit.size}px` }}
        >
          <div className="flex shrink-0 items-center border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <span className="ps-[4px] text-xs font-semibold text-slate-700">Workflow input (JSON)</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden" data-floating-panel-drag-exclude>
            <MonacoEditorPanel
              documentKey={`workflow-input-${definitionId}-${draftVersion}`}
              defaultLanguage="json"
              language="json"
              value={workflowInputJson}
              onChange={(value) => setWorkflowInputJson(value ?? '')}
              options={WORKFLOW_INPUT_MONACO_OPTIONS}
            />
          </div>
        </section>

        <WorkspaceHorizontalSplitHandle
          {...inputHeightSplit.splitHandleProps}
          displayClassName="block"
          title="Drag to resize input and output panes"
        />

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <span className="ps-[4px] text-xs font-semibold text-slate-700">Output</span>
          </div>
          <div className="flex min-h-0 flex-1 select-text flex-col gap-2 overflow-y-auto p-3 pt-2">
            {error ? (
              <pre className="whitespace-pre-wrap break-words rounded border border-red-200 bg-red-50 p-2 font-mono text-xs text-red-700">{error}</pre>
            ) : null}

            {missing.length > 0 ? (
              <pre className="whitespace-pre-wrap break-words rounded border border-amber-300 bg-amber-50 p-2 font-mono text-xs text-amber-800">
                {`Missing fixtures: ${missing.map((entry) => `${entry.nodeKey}${entry.resolvedActionRef ? ` (${entry.resolvedActionRef.actionKey}@${entry.resolvedActionRef.actionVersion})` : ''}`).join(', ')}`}
              </pre>
            ) : null}

            {outcome ? (
              <pre className="whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs">{JSON.stringify(outcome, null, 2)}</pre>
            ) : !error ? (
              <p className="text-xs text-slate-500">Execute the workflow to see the outcome here.</p>
            ) : null}

            {evidence.length > 0 ? (
              <div>
                <div className="text-xs font-semibold text-slate-700">Execution trace</div>
                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-slate-600">
                  {evidence.map((entry) => `#${entry.sequence} ${entry.type}${entry.nodeKey ? ` [${entry.nodeKey}]` : ''}`).join('\n')}
                </pre>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </FloatingPanelShell>
  );
};
