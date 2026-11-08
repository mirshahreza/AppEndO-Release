import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  AppButton,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  ToolbarFilterRadioGroup,
  type ToolbarFilterRadioOption,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import type { WorkflowDefinitionDossier, WorkflowExecutionInstanceStatusFilter, WorkflowInstanceInspectTarget } from '../types';
import { formatWorkflowAuditDateTime } from '../lib/workflowAuditMetadata';
import { workflowRuntimeApi } from '../api/workflowRuntimeApi';

const STATUS_FILTER_OPTIONS: ReadonlyArray<ToolbarFilterRadioOption> = [
  { value: 'CREATED', label: 'Created' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'SUCCEEDED', label: 'Succeeded' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const instanceStatusPillClass = (status: string): string => {
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

const nodeStatusPillClass = (status: string): string => {
  switch (status) {
    case 'RUNNING':
    case 'PASSED':
    case 'SUCCEEDED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'SUSPENDED':
    case 'RETRYING':
    case 'WAITING':
    case 'WAITING_HUMAN':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'FAILED':
    case 'REJECTED':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'CANCELLED':
    case 'SKIPPED':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'CREATED':
    case 'PENDING':
    case 'READY':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{children}</h3>
);

const InstanceStatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold', instanceStatusPillClass(status))}>
    {status}
  </span>
);

const NodeStatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold', nodeStatusPillClass(status))}>
    {status}
  </span>
);

type DossierInstance = WorkflowDefinitionDossier['instances'][number];

/** Node statuses this section considers "stuck and worth an operator nudge" for the batch-retry action. */
const RETRYABLE_NODE_STATUSES = new Set(['RETRYING']);

export const DossierExecutionInstancesSection: React.FC<{
  instances: DossierInstance[];
  workflowDefinitionKey: string;
  statusFilter: WorkflowExecutionInstanceStatusFilter;
  onStatusFilterChange: (value: WorkflowExecutionInstanceStatusFilter) => void;
  onInspect: (target: WorkflowInstanceInspectTarget) => void;
  /** Called once after a batch retry pass finishes, so the caller can reload the dossier (statuses will have changed). */
  onInstancesMutated?: () => void;
}> = ({ instances, workflowDefinitionKey, statusFilter, onStatusFilterChange, onInspect, onInstancesMutated }) => {
  const [expandedInstanceId, setExpandedInstanceId] = useState<number | null>(null);
  const [batchRetrying, setBatchRetrying] = useState(false);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  const filteredInstances = useMemo(
    () => (!statusFilter ? instances : instances.filter((instance) => instance.status === statusFilter)),
    [instances, statusFilter],
  );

  const retryCandidateInstances = useMemo(
    () => filteredInstances.filter((instance) => instance.nodes.some((n) => RETRYABLE_NODE_STATUSES.has(n.status))),
    [filteredInstances],
  );

  /**
   * Batch retry (Operations console gap — no bulk action existed before). The list-level dossier
   * projection only carries `{semanticNodeKey, status}` per node (no id/stateVersion — the CAS
   * fields `retryNode` needs), so this fetches a real inspection per candidate instance first, same
   * as opening it individually would, then retries every currently-RETRYING node it finds. Runs
   * sequentially (not `Promise.all`) so a slow/failing instance can't stall the others indefinitely
   * and the running counts stay easy to reason about; this is an infrequent admin action, not a hot path.
   */
  const handleBatchRetry = async () => {
    setBatchRetrying(true);
    setBatchNotice(null);
    let retried = 0;
    let failed = 0;
    let instancesTouched = 0;
    try {
      for (const instance of retryCandidateInstances) {
        try {
          const inspection = await workflowRuntimeApi.inspect(instance.id);
          const stuckNodes = inspection.nodeInstances.filter((n) => RETRYABLE_NODE_STATUSES.has(n.status));
          if (stuckNodes.length === 0) continue;
          instancesTouched += 1;
          for (const node of stuckNodes) {
            try {
              await workflowRuntimeApi.retryNode(node.id, node.stateVersion);
              retried += 1;
            } catch {
              failed += 1;
            }
          }
        } catch {
          failed += 1;
        }
      }
      setBatchNotice(
        retried === 0 && failed === 0
          ? 'No stuck nodes found — nothing to retry.'
          : `Retried ${retried} node${retried === 1 ? '' : 's'} across ${instancesTouched} instance${instancesTouched === 1 ? '' : 's'}${failed > 0 ? `; ${failed} attempt${failed === 1 ? '' : 's'} failed` : ''}.`,
      );
    } finally {
      setBatchRetrying(false);
      onInstancesMutated?.();
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Execution instances</SectionTitle>
        <div className={cn(PAGE_TOOLBAR_SINGLE_ROW_CLASS, 'w-auto shrink-0 border-0 p-0')}>
          <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
            {retryCandidateInstances.length > 0 ? (
              <AppButton size="sm" intent="utility" disabled={batchRetrying} onClick={() => { void handleBatchRetry(); }}>
                <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', batchRetrying && 'animate-spin')} />
                {batchRetrying ? 'Retrying…' : `Retry stuck nodes (${retryCandidateInstances.length})`}
              </AppButton>
            ) : null}
            <ToolbarFilterRadioGroup
              value={statusFilter}
              options={STATUS_FILTER_OPTIONS}
              onChange={(value) => onStatusFilterChange(value as WorkflowExecutionInstanceStatusFilter)}
              ariaLabel="Filter execution instances by status"
            />
          </div>
        </div>
      </div>
      {batchNotice ? <p className="mt-1.5 text-[11px] font-medium text-slate-600">{batchNotice}</p> : null}

      {instances.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No instances have been started for this workflow.</p>
      ) : filteredInstances.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No instances match the selected status filter.</p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Revision</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">Nodes</th>
                  <th className="px-3 py-2">Waits</th>
                  <th className="px-3 py-2">Work items</th>
                  <th className="px-3 py-2">Traces</th>
                  <th className="px-3 py-2">Started</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredInstances.map((instance) => {
                  const expanded = expandedInstanceId === instance.id;
                  return (
                    <React.Fragment key={instance.id}>
                      <tr className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="px-3 py-2 font-mono">#{instance.id}</td>
                        <td className="px-3 py-2"><InstanceStatusBadge status={instance.status} /></td>
                        <td className="px-3 py-2">v{instance.revisionNumber}</td>
                        <td className="px-3 py-2">{instance.startType ?? instance.startedByType}</td>
                        <td className="px-3 py-2">{instance.activeNodeCount}/{instance.nodeCount}</td>
                        <td className="px-3 py-2">{instance.activeWaitCount}</td>
                        <td className="px-3 py-2">{instance.openWorkItemCount}</td>
                        <td className="px-3 py-2">{instance.traceCount}</td>
                        <td className="px-3 py-2">{formatWorkflowAuditDateTime(instance.createdAt)}</td>
                        <td className="px-3 py-2">{formatWorkflowAuditDateTime(instance.updatedAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="text-[10px] font-semibold text-primary-700 hover:underline"
                              onClick={() => onInspect({
                                id: instance.id,
                                workflowRevisionId: instance.workflowRevisionId,
                                revisionNumber: instance.revisionNumber,
                                workflowDefinitionKey,
                              })}
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              className="text-[10px] font-semibold text-slate-600 hover:underline"
                              onClick={() => setExpandedInstanceId(expanded ? null : instance.id)}
                            >
                              {expanded ? 'Hide nodes' : 'Nodes'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t border-slate-100 bg-slate-50/60">
                          <td colSpan={11} className="px-3 py-2">
                            <div className="flex flex-wrap gap-1.5">
                              {instance.nodes.length === 0 ? (
                                <span className="text-[11px] text-slate-500">No materialized nodes.</span>
                              ) : instance.nodes.map((node) => (
                                <span key={`${instance.id}-${node.semanticNodeKey}`} className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]">
                                  <span className="font-mono text-slate-700">{node.semanticNodeKey}</span>
                                  <NodeStatusBadge status={node.status} />
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-medium text-slate-600">
            {filteredInstances.length === instances.length
              ? `${instances.length} instance${instances.length === 1 ? '' : 's'}`
              : `${filteredInstances.length} of ${instances.length} instances`}
          </div>
        </div>
      )}
    </section>
  );
};
