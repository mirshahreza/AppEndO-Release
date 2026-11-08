import React, { useCallback, useEffect, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { FloatingPanelShell } from '../../../shared/ui/FloatingPanelShell';
import { AppButton } from '../../../shared/ui';
import { workflowRuntimeApi, WorkflowRuntimeApiError } from '../api/workflowRuntimeApi';
import { formatDisplayDateYmd } from '../../../shared/lib/gridDateFormat';
import type { WorkItemSlaViolation } from '../types';

const PANEL_BOUNDS = { minWidth: 420, maxWidth: 760, minHeight: 360, maximizeInset: 24 };

const formatDate = (value: string | null): string => formatDisplayDateYmd(value, '—');

const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};

/**
 * HWF-4.5 — SLA Violations dashboard: reports on `dueAt` (HWF-2.1, pure metadata with zero automatic
 * behavior of its own) so operators can actually see the breaches that data was already recording.
 * Same "operator inbox for a data gap the model already supports" shape as
 * `WorkflowDeadLettersPanel.tsx`/WFV2-12 — read-only, no resolve/dismiss action, since a violation
 * here isn't a state to clear, just a fact about what already happened.
 */
export const WorkflowSlaViolationsPanel: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const [items, setItems] = useState<WorkItemSlaViolation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await workflowRuntimeApi.listSlaViolations();
      setItems(result.items);
    } catch (e) {
      setError(e instanceof WorkflowRuntimeApiError ? e.message : 'Failed to load SLA violations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <FloatingPanelShell
      open={open}
      onClose={onClose}
      title="SLA violations"
      titleIcon={<Clock className="h-4 w-4 text-amber-600" />}
      bounds={PANEL_BOUNDS}
      defaultWidth={620}
      defaultHeight={560}
      initialPosition="center"
      zIndexClassName="z-[93]"
    >
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
        <p className="rounded border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-800">
          Work Items whose due date (HWF-2.1) has passed while still open, or that were completed after their due date. Read-only — due dates are pure metadata with no automatic behavior; use Escalation Policy on the node for automatic action.
        </p>

        <div className="flex items-center justify-end">
          <AppButton intent="secondary" size="sm" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </AppButton>
        </div>

        {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}

        <div className="flex flex-col gap-2">
          {loading ? <p className="text-xs text-slate-500">Loading…</p> : null}
          {!loading && items.length === 0 ? <p className="text-xs text-slate-500">No SLA violations.</p> : null}
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5 rounded border border-slate-200 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">{item.titleText}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${item.breachKind === 'STILL_OPEN' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                  {item.breachKind === 'STILL_OPEN' ? 'Still open' : 'Completed late'} · {formatDuration(item.overdueMs)} over
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-slate-500">
                <span>instance #{item.workflowInstanceId}</span>
                <span>{item.workItemType}</span>
                <span>due {formatDate(item.dueAt)}</span>
                {item.completedAt ? <span>completed {formatDate(item.completedAt)}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </FloatingPanelShell>
  );
};
