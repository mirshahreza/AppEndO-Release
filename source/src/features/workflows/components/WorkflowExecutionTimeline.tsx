import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import type { WorkflowNodeInstanceRecord, WorkflowProofEntry } from '../types';

/**
 * Operations console gap (no execution timeline/Gantt view existed before this) — a lightweight
 * per-node duration/overlap view built directly from the already-durable Proof trace evidence
 * (`createdAt` per row), so it needs no new backend endpoint. Each bar's span is the range between
 * the first and last Proof row this component finds naming that node instance — an honest
 * approximation from available evidence, not a claim of exact wall-clock attempt duration (a node
 * with only one trace row renders as a point/minimum-width bar, not a zero-width one).
 */
const statusBarClass = (status: string): string => {
  switch (status) {
    case 'RUNNING':
      return 'bg-blue-500';
    case 'SUCCEEDED':
      return 'bg-emerald-500';
    case 'FAILED':
      return 'bg-rose-500';
    case 'RETRYING':
    case 'WAITING':
    case 'WAITING_HUMAN':
      return 'bg-amber-500';
    case 'CANCELLED':
    case 'SKIPPED':
      return 'bg-slate-400';
    default:
      return 'bg-slate-300';
  }
};

const formatClock = (ms: number): string => {
  const date = new Date(ms);
  return date.toISOString().slice(11, 23);
};

type TimelineRow = { nodeInstanceId: number; nodeKey: string; status: string; startMs: number; endMs: number; eventCount: number };

export const WorkflowExecutionTimeline: React.FC<{
  proof: WorkflowProofEntry[];
  nodeInstances: WorkflowNodeInstanceRecord[];
  onSelectNode?: (nodeKey: string) => void;
}> = ({ proof, nodeInstances, onSelectNode }) => {
  const nodeById = useMemo(() => new Map(nodeInstances.map((n) => [n.id, n])), [nodeInstances]);

  const rows = useMemo<TimelineRow[]>(() => {
    const byNode = new Map<number, { startMs: number; endMs: number; eventCount: number }>();
    for (const entry of proof) {
      if (entry.nodeInstanceId === null) continue;
      const ms = entry.createdAt ? Date.parse(entry.createdAt) : NaN;
      if (Number.isNaN(ms)) continue;
      const existing = byNode.get(entry.nodeInstanceId);
      if (existing) {
        existing.startMs = Math.min(existing.startMs, ms);
        existing.endMs = Math.max(existing.endMs, ms);
        existing.eventCount += 1;
      } else {
        byNode.set(entry.nodeInstanceId, { startMs: ms, endMs: ms, eventCount: 1 });
      }
    }
    return Array.from(byNode.entries())
      .map(([nodeInstanceId, span]) => {
        const node = nodeById.get(nodeInstanceId);
        return { nodeInstanceId, nodeKey: node?.semanticNodeKey ?? `#${nodeInstanceId}`, status: node?.status ?? 'UNKNOWN', ...span };
      })
      .sort((a, b) => a.startMs - b.startMs);
  }, [proof, nodeById]);

  if (rows.length === 0) {
    return <p className="p-3 text-xs text-slate-500">No timed evidence yet — the timeline fills in as nodes are claimed and complete.</p>;
  }

  const rangeStart = Math.min(...rows.map((r) => r.startMs));
  const rangeEnd = Math.max(...rows.map((r) => r.endMs));
  const rangeMs = Math.max(1, rangeEnd - rangeStart);
  const MIN_WIDTH_PCT = 1.5;

  return (
    <div className="flex flex-col gap-1 p-3">
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-400">
        <span>{formatClock(rangeStart)}</span>
        <span>total span {(rangeMs / 1000).toFixed(2)}s</span>
        <span>{formatClock(rangeEnd)}</span>
      </div>
      {rows.map((row) => {
        const leftPct = ((row.startMs - rangeStart) / rangeMs) * 100;
        const widthPct = Math.max(MIN_WIDTH_PCT, ((row.endMs - row.startMs) / rangeMs) * 100);
        return (
          <button
            key={row.nodeInstanceId}
            type="button"
            onClick={() => onSelectNode?.(row.nodeKey)}
            className="group flex items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-slate-50"
            title={`${row.nodeKey} — ${row.eventCount} evidence row${row.eventCount === 1 ? '' : 's'}, ${((row.endMs - row.startMs) / 1000).toFixed(2)}s span`}
          >
            <span className="w-24 shrink-0 truncate font-mono text-[10px] text-slate-600 group-hover:text-primary-700">{row.nodeKey}</span>
            <span className="relative h-3 flex-1 rounded-sm bg-slate-100">
              <span
                className={cn('absolute top-0 h-3 rounded-sm', statusBarClass(row.status))}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
};
