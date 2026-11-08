import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { AppButton, CreateEditModalShell, TOOLBAR_FILTER_RADIO_ALL_VALUE } from '../../../shared/ui';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import { cn } from '../../../lib/utils';
import { workflowsApi, WorkflowsApiError } from '../api/workflowsApi';
import type { WorkflowDefinitionDossier, WorkflowExecutionInstanceStatus, WorkflowExecutionInstanceStatusFilter, WorkflowInstanceInspectTarget } from '../types';
import { formatWorkflowAuditActor, formatWorkflowAuditDateTime } from '../lib/workflowAuditMetadata';
import { workflowPublishedLabel } from './workflowPublishedBadge';
import { WORKFLOW_DOSSIER_VIEW_TITLE, WorkflowDossierIcon } from './workflowDossierPresentation';
import { DossierExecutionInstancesSection } from './DossierExecutionInstancesSection';
import { WorkflowInstanceInspectPanel } from './WorkflowInstanceInspectPanel';

const EXECUTION_INSTANCE_STATUSES = new Set<WorkflowExecutionInstanceStatus>(['CREATED', 'RUNNING', 'SUSPENDED', 'SUCCEEDED', 'FAILED', 'CANCELLED']);

const statusPillClass = (status: string): string => {
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

const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-0.5 text-sm font-bold text-slate-900">{value}</div>
    {hint ? <div className="mt-0.5 text-[10px] font-medium text-slate-500">{hint}</div> : null}
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold', statusPillClass(status))}>
    {status}
  </span>
);

const AuditLine: React.FC<{ label: string; actor: string | null; at: string | null }> = ({ label, actor, at }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-0.5 text-sm font-bold text-slate-900">{formatWorkflowAuditActor(actor)}</div>
    <div className="mt-0.5 text-[10px] font-medium text-slate-500">{formatWorkflowAuditDateTime(at)}</div>
  </div>
);

const DossierBody: React.FC<{
  dossier: WorkflowDefinitionDossier;
  onInspectInstance: (target: WorkflowInstanceInspectTarget) => void;
  onInstancesMutated?: () => void;
}> = ({ dossier, onInspectInstance, onInstancesMutated }) => {
  const [instanceStatusFilter, setInstanceStatusFilter] = useState<WorkflowExecutionInstanceStatusFilter>(TOOLBAR_FILTER_RADIO_ALL_VALUE);
  const { definition, publication, publicationStatus, instanceSummary, revisions, instances, simulations, validationReports } = dossier;
  const showLastPublished = Boolean(publicationStatus.lastPublishedAt || publicationStatus.lastPublishedBy);
  const showLastUnpublished = Boolean(publicationStatus.lastUnpublishedAt || publicationStatus.lastUnpublishedBy);

  return (
    <div className="space-y-5 p-4 text-sm">
      <section>
        <SectionTitle>Record</SectionTitle>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <AuditLine label="Created" actor={definition.createdBy} at={definition.createdAt} />
          <AuditLine label="Last edited" actor={definition.updatedBy} at={definition.updatedAt} />
          {showLastPublished ? (
            <AuditLine
              label={publicationStatus.isPublished ? 'Published' : 'Last published'}
              actor={publicationStatus.lastPublishedBy}
              at={publicationStatus.lastPublishedAt}
            />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Published</div>
              <div className="mt-0.5 text-sm font-bold text-slate-500">Never published</div>
              <div className="mt-0.5 text-[10px] font-medium text-slate-500">No live revision has been released yet.</div>
            </div>
          )}
          {showLastUnpublished ? (
            <AuditLine label="Unpublished" actor={publicationStatus.lastUnpublishedBy} at={publicationStatus.lastUnpublishedAt} />
          ) : publicationStatus.isPublished && publication ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Live revision</div>
              <div className="mt-0.5 text-sm font-bold text-slate-900">Revision #{publication.revisionNumber}</div>
              <div className="mt-0.5 text-[10px] font-medium text-emerald-700">Draft v{publication.sourceDraftVersion}</div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Unpublished</div>
              <div className="mt-0.5 text-sm font-bold text-slate-500">—</div>
              <div className="mt-0.5 text-[10px] font-medium text-slate-500">No unpublish event recorded.</div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Published" value={workflowPublishedLabel(definition.isPublished)} />
        <StatCard label="Draft version" value={`v${definition.draftVersion}`} hint={`${definition.nodeCount} nodes · ${definition.edgeCount} edges`} />
        <StatCard label="Revisions" value={revisions.length} hint={definition.currentPublishedRevisionId ? `current #${revisions.find((r) => r.isCurrent)?.revisionNumber ?? '—'}` : 'none published'} />
        <StatCard label="Instances" value={instanceSummary.total} hint={`${instanceSummary.nonTerminal} active now`} />
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
          <SectionTitle>Identity</SectionTitle>
          <dl className="mt-2 space-y-1 text-xs text-slate-700">
            <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-slate-500">Scope</dt><dd className="font-mono">{definition.scopeKey}</dd></div>
            <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-slate-500">Key</dt><dd className="font-mono">{definition.key}</dd></div>
            <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-slate-500">Lifecycle</dt><dd><StatusBadge status={definition.lifecycleStatus} /></dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
          <SectionTitle>Lineage</SectionTitle>
          <dl className="mt-2 space-y-1 text-xs text-slate-700">
            <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-slate-500">Mode</dt><dd>{definition.creationMode}</dd></div>
            <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-slate-500">From def</dt><dd>{definition.createdFromDefinitionId ?? '—'}</dd></div>
            <div className="flex gap-2"><dt className="w-24 shrink-0 font-semibold text-slate-500">From rev</dt><dd>{definition.createdFromRevisionId ?? '—'}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(instanceSummary.byStatus).map(([status, count]) => (
              count > 0 ? (
                EXECUTION_INSTANCE_STATUSES.has(status as WorkflowExecutionInstanceStatus) ? (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setInstanceStatusFilter((current) => (current === status ? TOOLBAR_FILTER_RADIO_ALL_VALUE : status as WorkflowExecutionInstanceStatus))}
                    className={cn(
                      'inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] hover:bg-slate-50',
                      instanceStatusFilter === status && 'ring-2 ring-slate-400 ring-offset-1',
                    )}
                  >
                    <StatusBadge status={status} />
                    <span className="font-bold text-slate-800">{count}</span>
                  </button>
                ) : (
                  <span key={status} className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]">
                    <StatusBadge status={status} />
                    <span className="font-bold text-slate-800">{count}</span>
                  </span>
                )
              ) : null
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Published revisions</SectionTitle>
        {revisions.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No revisions yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Publication</th>
                  <th className="px-3 py-2">Binding</th>
                  <th className="px-3 py-2">Draft</th>
                  <th className="px-3 py-2">Published at</th>
                  <th className="px-3 py-2">Published by</th>
                  <th className="px-3 py-2">Instances</th>
                  <th className="px-3 py-2">Current</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((revision) => (
                  <tr key={revision.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono font-semibold">{revision.revisionNumber}</td>
                    <td className="px-3 py-2"><StatusBadge status={revision.publicationStatus} /></td>
                    <td className="px-3 py-2"><StatusBadge status={revision.bindingStatus} /></td>
                    <td className="px-3 py-2">v{revision.sourceDraftVersion}</td>
                    <td className="px-3 py-2">{formatWorkflowAuditDateTime(revision.publishedAt)}</td>
                    <td className="px-3 py-2">{formatWorkflowAuditActor(revision.publishedBy)}</td>
                    <td className="px-3 py-2 font-semibold">{revision.instanceCount}</td>
                    <td className="px-3 py-2">{revision.isCurrent ? 'yes' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DossierExecutionInstancesSection
        instances={instances}
        workflowDefinitionKey={definition.key}
        statusFilter={instanceStatusFilter}
        onStatusFilterChange={setInstanceStatusFilter}
        onInspect={onInspectInstance}
        onInstancesMutated={onInstancesMutated}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionTitle>Designer simulations</SectionTitle>
          {simulations.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No simulation runs recorded.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {simulations.map((run) => (
                <li key={run.id} className="rounded border border-slate-200 px-2 py-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold">#{run.id}</span>
                    <StatusBadge status={run.status} />
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {run.mode}
                    {run.sourceDraftVersion ? ` · draft v${run.sourceDraftVersion}` : ''}
                    {run.sourceRevisionId ? ` · revision #${run.sourceRevisionId}` : ''}
                  </div>
                  <div className="text-[10px] text-slate-500">{formatWorkflowAuditDateTime(run.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>Validation history</SectionTitle>
          {validationReports.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No validation reports yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {validationReports.map((report) => (
                <li key={report.id} className="rounded border border-slate-200 px-2 py-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">draft v{report.draftVersion}</span>
                    <StatusBadge status={report.status} />
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {report.validatorVersion}
                    {report.revisionId ? ` · revision #${report.revisionId}` : ''}
                    {report.issueCount > 0 ? ` · ${report.issueCount} issue(s)` : ''}
                  </div>
                  <div className="text-[10px] text-slate-500">{formatWorkflowAuditDateTime(report.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export const WorkflowDossierDialog: React.FC<{
  definitionId: number;
  workflowKey: string;
  open: boolean;
  onClose: () => void;
}> = ({ definitionId, workflowKey, open, onClose }) => {
  const culture = useOptionalCulture();
  const refreshLabel = culture?.ready
    ? culture.t('actions.refresh')
    : CULTURE_ACTION_FALLBACK_LABELS['actions.refresh'];
  const [dossier, setDossier] = useState<WorkflowDefinitionDossier | null>(null);
  const [inspectTarget, setInspectTarget] = useState<WorkflowInstanceInspectTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await workflowsApi.getDossier(definitionId);
      setDossier(result.dossier);
    } catch (loadError) {
      setDossier(null);
      setError(loadError instanceof WorkflowsApiError ? `${loadError.code}: ${loadError.message}` : 'Failed to load workflow dossier.');
    } finally {
      setLoading(false);
    }
  }, [definitionId]);

  useEffect(() => {
    if (!open) {
      setInspectTarget(null);
      return;
    }
    void load();
  }, [load, open]);

  if (!open) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="maximized"
      title={(
        <span className="inline-flex items-center gap-2">
          <WorkflowDossierIcon className="text-violet-600" />
          {WORKFLOW_DOSSIER_VIEW_TITLE}
        </span>
      )}
      subtitle={inspectTarget
        ? <span className="font-mono text-xs font-semibold text-slate-700">instance #{inspectTarget.id}</span>
        : <span className="font-mono text-xs font-semibold text-slate-700">{workflowKey}</span>}
      onClose={onClose}
      onBackdropClick={onClose}
      gradient={!inspectTarget}
      bodyOuterClassName={inspectTarget ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : undefined}
      bodyClassName={inspectTarget ? 'flex min-h-0 flex-1 flex-col overflow-hidden p-0' : undefined}
      headerExtra={(
        <AppButton
          size="icon-sm"
          intent="utility"
          aria-label={refreshLabel}
          title={refreshLabel}
          onClick={() => { void load(); }}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </AppButton>
      )}
    >
      {loading && !dossier ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading workflow dossier…
        </div>
      ) : error ? (
        <div className="p-4 text-sm text-rose-700">{error}</div>
      ) : inspectTarget ? (
        <WorkflowInstanceInspectPanel
          instance={inspectTarget}
          onBack={() => setInspectTarget(null)}
          onInstanceMutated={() => { void load(); }}
        />
      ) : dossier ? (
        <DossierBody dossier={dossier} onInspectInstance={setInspectTarget} onInstancesMutated={() => { void load(); }} />
      ) : null}
    </CreateEditModalShell>
  );
};
