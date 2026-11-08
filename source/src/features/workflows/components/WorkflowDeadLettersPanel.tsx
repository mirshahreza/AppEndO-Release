import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, RefreshCw, X, XCircle } from 'lucide-react';
import { FloatingPanelShell } from '../../../shared/ui/FloatingPanelShell';
import { AppButton, ConfirmDialogShell, UiSelect, UiTextarea } from '../../../shared/ui';
import { workflowRuntimeApi, WorkflowRuntimeApiError } from '../api/workflowRuntimeApi';
import { formatDisplayDateYmd } from '../../../shared/lib/gridDateFormat';
import type { WorkflowDeadLetterRecord, WorkflowDeadLetterStatus } from '../types';

const PANEL_BOUNDS = { minWidth: 420, maxWidth: 760, minHeight: 360, maximizeInset: 24 };

const STATUS_OPTIONS: ReadonlyArray<{ value: WorkflowDeadLetterStatus; label: string }> = [
  { value: 'OPEN', label: 'Open' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISCARDED', label: 'Discarded' },
];

const formatDate = (value: string | null): string => formatDisplayDateYmd(value, '—');

/**
 * Operator inbox for `WorkflowDeadLetter` (WFV2-12) — nodes that failed with retries exhausted and
 * no ON_ERROR edge to catch them. The model and `/api/workflow-runtime/dead-letters*` transport
 * existed since WFV2-12 with zero consuming UI (p-99/WFT-6 benchmark finding) — this panel is that
 * missing UI, not a new backend capability.
 */
export const WorkflowDeadLettersPanel: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const [status, setStatus] = useState<WorkflowDeadLetterStatus>('OPEN');
  const [items, setItems] = useState<WorkflowDeadLetterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [pendingAction, setPendingAction] = useState<{ item: WorkflowDeadLetterRecord; resolution: 'RESOLVED' | 'DISCARDED' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await workflowRuntimeApi.listDeadLetters(status);
      setItems(result.items);
    } catch (e) {
      setError(e instanceof WorkflowRuntimeApiError ? e.message : 'Failed to load dead letters.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const confirmAction = async () => {
    if (!pendingAction) return;
    const { item, resolution } = pendingAction;
    setBusyId(item.id);
    setError(null);
    try {
      await workflowRuntimeApi.resolveDeadLetter(item.id, {
        expectedStateVersion: item.stateVersion,
        resolution,
        resolutionNote: noteDrafts[item.id]?.trim() || null,
      });
      setPendingAction(null);
      await load();
    } catch (e) {
      setError(e instanceof WorkflowRuntimeApiError ? e.message : 'Failed to update dead letter.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <FloatingPanelShell
      open={open}
      onClose={onClose}
      title="Dead letters"
      titleIcon={<AlertTriangle className="h-4 w-4 text-rose-600" />}
      bounds={PANEL_BOUNDS}
      defaultWidth={620}
      defaultHeight={560}
      initialPosition="center"
      zIndexClassName="z-[93]"
    >
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
        <p className="rounded border border-rose-200 bg-rose-50/60 p-2 text-[11px] text-rose-800">
          A node lands here when its retries are exhausted and it has no ON_ERROR edge to catch the failure — the instance stays FAILED. Resolving here does not restart anything; use the instance&apos;s own retry/force-new-invocation for that.
        </p>

        <div className="flex items-center justify-between gap-2">
          <UiSelect size="sm" className="w-40 text-xs" value={status} onChange={(e) => setStatus(e.target.value as WorkflowDeadLetterStatus)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </UiSelect>
          <AppButton intent="secondary" size="sm" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </AppButton>
        </div>

        {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}

        <div className="flex flex-col gap-2">
          {loading ? <p className="text-xs text-slate-500">Loading…</p> : null}
          {!loading && items.length === 0 ? <p className="text-xs text-slate-500">No {status.toLowerCase()} dead letters.</p> : null}
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5 rounded border border-slate-200 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-slate-800">{item.nodeKey}</span>
                <span className="shrink-0 text-[10px] text-slate-500">{formatDate(item.createdAt)}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-slate-500">
                <span>instance #{item.workflowInstanceId}</span>
                <span>node #{item.nodeInstanceId}</span>
                {item.errorCode ? <span>{item.errorCode}</span> : null}
              </div>
              {item.errorMessage ? <p className="text-[11px] text-slate-700">{item.errorMessage}</p> : null}
              {item.evidenceJson ? (
                <details className="text-[10px] text-slate-500">
                  <summary className="cursor-pointer select-none">Evidence</summary>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-1.5 font-mono">{item.evidenceJson}</pre>
                </details>
              ) : null}

              {item.status === 'OPEN' ? (
                <>
                  <UiTextarea
                    size="sm"
                    aiAssist={false}
                    className="text-xs"
                    rows={1}
                    placeholder="Resolution note (optional)"
                    value={noteDrafts[item.id] ?? ''}
                    onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <div className="flex gap-1.5">
                    <AppButton
                      intent="primary"
                      size="sm"
                      disabled={busyId === item.id}
                      onClick={() => setPendingAction({ item, resolution: 'RESOLVED' })}
                    >
                      <Check className="h-3.5 w-3.5" /> Mark resolved
                    </AppButton>
                    <AppButton
                      intent="cancel"
                      size="sm"
                      disabled={busyId === item.id}
                      onClick={() => setPendingAction({ item, resolution: 'DISCARDED' })}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Discard
                    </AppButton>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                  <span className="font-semibold text-slate-600">{item.status === 'RESOLVED' ? 'Resolved' : 'Discarded'} · {formatDate(item.resolvedAt)}</span>
                  {item.resolutionNote ? <span>{item.resolutionNote}</span> : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialogShell
        open={pendingAction !== null}
        title={pendingAction?.resolution === 'RESOLVED' ? 'Mark dead letter resolved' : 'Discard dead letter'}
        onClose={() => setPendingAction(null)}
        onConfirm={() => void confirmAction()}
        confirmLabel={pendingAction?.resolution === 'RESOLVED' ? 'Mark resolved' : 'Discard'}
        confirmIntent={pendingAction?.resolution === 'RESOLVED' ? 'primary' : 'destructive-soft'}
      >
        <p className="text-sm text-slate-700">
          This only clears the operator inbox entry for node <span className="font-mono">{pendingAction?.item.nodeKey}</span> — it does not touch the failed instance itself. Continue?
        </p>
      </ConfirmDialogShell>
    </FloatingPanelShell>
  );
};
