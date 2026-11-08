import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { WorkflowProofEntry } from '../types';

/**
 * p-99/WFT-11 (scoped down per explicit decision: enrich the existing timeline/inspector with the
 * full recorded trace detail, rather than building a separate step-by-step variable-reconstruction
 * replay engine — the trace evidence records structural facts, not a per-step variable snapshot, so
 * a byte-perfect "scrub time and see every variable" debugger isn't cleanly buildable from what's
 * durably recorded today). Every field rendered here was already loaded by `WorkflowInstanceInspectPanel`
 * for the Gantt timeline — this is a pure frontend read of already-fetched `WorkflowProofEntry[]`, no
 * new endpoint, no new capture, no schema change.
 */

const traceTypeToneClass = (traceType: string): string => {
  if (traceType.includes('FAILED') || traceType === 'ENGINE_INVARIANT') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (traceType.includes('CANCELLED') || traceType === 'EVENT_FINAL_UNMATCHED') return 'border-slate-300 bg-slate-100 text-slate-600';
  if (traceType.includes('SUCCEEDED') || traceType.includes('COMPLETED') || traceType.includes('SATISFIED') || traceType.includes('WON') || traceType.includes('CLAIMED')) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (traceType.includes('RETRY') || traceType.includes('TIMED_OUT') || traceType.includes('EXPIRED') || traceType === 'UNKNOWN') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-white text-slate-600';
};

const safeParse = (json: string | null): Record<string, unknown> | null => {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const truncate = (value: string, max = 80): string => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

/** One short, human-readable line per trace type — falls back to the raw type name for anything not
 * explicitly handled here (a closed but growing registry — see `traceTypes.ts`). */
function summarize(traceType: string, core: Record<string, unknown> | null, diagnostic: Record<string, unknown> | null): string {
  const s = (v: unknown): string => (v === undefined || v === null ? '?' : typeof v === 'string' ? v : JSON.stringify(v));
  switch (traceType) {
    case 'EXPRESSION_EVALUATED': {
      const result = core?.result as { kind?: string; typedResult?: unknown; failureCode?: string } | undefined;
      return result?.kind === 'FAILURE' ? `evaluation failed — ${s(result.failureCode)}` : `= ${truncate(s(result?.typedResult))}`;
    }
    case 'EDGE_SELECTED':
      return `${s(core?.selectionMode)} → ${s(core?.selectedEdgeKey ?? core?.edgeKey)} (${truncate(s(core?.selectionReason), 60)})`;
    case 'WAIT_CREATED':
      return `${s(core?.waitType)}${core?.eventName ? ` on "${s(core.eventName)}"` : ''}${core?.dueAt ? ` due ${s(core.dueAt)}` : ''}${core?.timeoutAt ? ` timeout ${s(core.timeoutAt)}` : ''}`;
    case 'WAIT_SATISFIED':
    case 'WAIT_EXPIRED':
    case 'WAIT_CANCELLED':
      return `${s(core?.waitType)} — ${s(core?.winnerReason)}`;
    case 'EVENT_CORRELATED':
      return `"${s(core?.eventName)}" matched (candidate #${s(core?.candidateOrderPosition)})`;
    case 'EVENT_FINAL_UNMATCHED':
      return `"${s(core?.eventName)}" never matched — recheck window ended ${s(core?.recheckUntil)}`;
    case 'ACTION_RESOLVED':
      return `${s(core?.actionKey)}@${s(core?.actionVersion)} via ${s(core?.selectedProviderId)}@${s(core?.selectedProviderVersion)} (${s(core?.bindingMode)})`;
    case 'ACTION_ATTEMPT_STARTED':
    case 'ACTION_ATTEMPT_SUCCEEDED':
    case 'ACTION_ATTEMPT_CANCELLED':
      return `attempt #${s(core?.attemptNumber)} — ${s(core?.providerIdentity)}`;
    case 'ACTION_ATTEMPT_FAILED':
    case 'ACTION_ATTEMPT_UNKNOWN':
      return `attempt #${s(core?.attemptNumber)} — ${s(core?.machineErrorCode)}`;
    case 'ACTION_RETRY_SCHEDULED':
      return `attempt #${s(core?.attemptNumber)} next eligible ${s(core?.nextEligibleAt)} (${s(core?.matchedRetrySelectorIdentity)})`;
    case 'PARALLEL_SPLIT_CREATED':
    case 'PARALLEL_JOIN_ARRIVAL':
    case 'PARALLEL_JOIN_WON':
    case 'PARALLEL_SIBLINGS_CANCELLED':
      return `split "${s(core?.splitNodeKey)}" → join "${s(core?.joinNodeKey)}"`;
    case 'WORK_ITEM_CREATED':
    case 'WORK_ITEM_CLAIMED':
    case 'WORK_ITEM_REASSIGNED':
    case 'WORK_ITEM_CANCELLED':
    case 'WORK_ITEM_FAILED':
      return `${s(core?.workItemType)} — ${s(core?.transitionType)} (${s(core?.actorType)})`;
    case 'WORK_ITEM_COMPLETED':
      return `${s(core?.workItemType)} — outcome "${s(core?.outcomeKey)}"`;
    case 'WORK_ITEM_ESCALATION_STARTED':
    case 'WORK_ITEM_ESCALATION_SUCCEEDED':
    case 'WORK_ITEM_ESCALATION_FAILED':
      return `${s(core?.workItemType)} escalation`;
    case 'RECOVERY_CLAIMED':
      return `${s(core?.recoveryPathClassification)} — prior lease expiry ${s(core?.priorLeaseExpiry)}`;
    case 'SUBFLOW_STARTED':
      return 'child instance started';
    case 'SUBFLOW_COMPLETED':
      return diagnostic?.childInstanceStatus ? `child instance ${s(diagnostic.childInstanceStatus)}` : 'child instance completed';
    case 'LATE_ACTION_RESULT_IGNORED':
      return `ignored — ${s(core?.ignoredSettlementClassification)} (attempt persisted ${s(core?.persistedTerminalAttemptStatus)})`;
    case 'INSTANCE_FAILED':
    case 'ENGINE_INVARIANT':
      return `${s(core?.machineErrorCode)} — caused by ${s(core?.causalIdentity)}`;
    case 'COMPENSATION_STARTED':
    case 'COMPENSATION_SUCCEEDED':
      return `${s(core?.compensatedNodeKey)} — ${s(core?.actionKey)}@${s(core?.actionVersion)}`;
    case 'COMPENSATION_FAILED':
      return `${s(core?.compensatedNodeKey)} — ${s(core?.errorCode)}`;
    case 'SAGA_COMPENSATION_COMPLETED':
      return `${s(core?.compensatedCount)} compensated, ${s(core?.failedCount)} failed`;
    default:
      return '';
  }
}

const formatClock = (iso: string | null): string => {
  if (!iso) return '';
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(11, 23);
};

const TraceRow: React.FC<{ entry: WorkflowProofEntry }> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  const core = safeParse(entry.corePayloadJson);
  const diagnostic = safeParse(entry.diagnosticPayloadJson);
  const summary = summarize(entry.traceType, core, diagnostic);
  const hasDetail = core !== null || diagnostic !== null;

  return (
    <li className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className={cn('flex w-full items-start gap-1.5 px-2 py-1.5 text-left', hasDetail && 'hover:bg-slate-50')}
        disabled={!hasDetail}
      >
        {hasDetail ? (
          expanded ? <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" /> : <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
        ) : (
          <span className="mt-0.5 h-3 w-3 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded border px-1 py-0 text-[9px] font-semibold uppercase tracking-wide', traceTypeToneClass(entry.traceType))}>{entry.traceType}</span>
            <span className="font-mono text-[9px] text-slate-400">#{entry.sequenceNumber}</span>
            {entry.createdAt ? <span className="font-mono text-[9px] text-slate-400">{formatClock(entry.createdAt)}</span> : null}
          </div>
          {summary ? <p className="mt-0.5 truncate text-[11px] text-slate-600">{summary}</p> : null}
        </div>
      </button>
      {expanded ? (
        <div className="space-y-1 px-2 pb-2 ps-6">
          {core ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Core evidence</div>
              <pre className="overflow-x-auto rounded bg-slate-50 p-1.5 font-mono text-[10px] text-slate-700">{JSON.stringify(core, null, 2)}</pre>
            </div>
          ) : null}
          {diagnostic ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Diagnostic</div>
              <pre className="overflow-x-auto rounded bg-slate-50 p-1.5 font-mono text-[10px] text-slate-700">{JSON.stringify(diagnostic, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
};

/** Chronological (by `sequenceNumber`) trace log for one node instance — every durable evidence row
 * AppEndO recorded for it, with a one-line human summary and an expandable raw-JSON view per row. */
export const WorkflowNodeTraceLog: React.FC<{ entries: WorkflowProofEntry[] }> = ({ entries }) => {
  const sorted = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  if (sorted.length === 0) {
    return <p className="px-2 py-1.5 text-[11px] text-slate-400">No trace evidence recorded for this node yet.</p>;
  }

  return (
    <ul className="rounded border border-slate-100">
      {sorted.map((entry) => (
        <TraceRow key={`${entry.sequenceNumber}`} entry={entry} />
      ))}
    </ul>
  );
};
