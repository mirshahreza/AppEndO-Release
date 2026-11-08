import React, { useEffect, useRef, useState } from 'react';
import { ArrowRightCircle, CheckCircle2, Loader2, UploadCloud, XCircle } from 'lucide-react';
import { workflowsApi, WorkflowsApiError } from '../api/workflowsApi';
import type { WorkflowDesignerProjection, WorkflowInstanceMigrationImpact } from '../types';
import { AppButton, ConfirmDialogShell } from '../../../shared/ui';
import { cn } from '../../../lib/utils';

const MIGRATION_BLOCK_REASON_LABELS: Record<string, string> = {
  VARIABLES_CHANGED: 'workflow variables changed',
  POLICIES_CHANGED: 'workflow policies changed',
  NODE_REMOVED: 'a node it still needs was removed',
  NODE_CHANGED: 'a node it still needs changed',
  EDGES_CHANGED: "a node's outgoing routing changed",
};

/**
 * p-99/WFT-8 — shown after a successful publish, only when the *previous* published revision still
 * has in-flight instances. Per the user's explicit scoping decision, this only ever offers the "safe
 * subset": an instance migrates only if every node its execution could still reach is byte-identical
 * between the two revisions — anything else is listed as blocked and left exactly where it is, never
 * force-migrated.
 */
const PostPublishMigrationOffer: React.FC<{
  impact: WorkflowInstanceMigrationImpact;
  migrating: boolean;
  migratedCount: number | null;
  error: string | null;
  onMigrate: () => void;
  onDone: () => void;
}> = ({ impact, migrating, migratedCount, error, onMigrate, onDone }) => {
  const blocked = impact.items.filter((item) => !item.safe);

  return (
    <div className="flex w-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Published successfully.
      </div>

      <p className="text-sm text-slate-700">
        {impact.totalConsidered} in-flight instance{impact.totalConsidered === 1 ? '' : 's'} {impact.totalConsidered === 1 ? 'was' : 'were'} still running on the previous revision.{' '}
        {impact.migratableCount > 0
          ? `${impact.migratableCount} can be safely migrated to this new revision.`
          : 'None of them can be safely migrated — every one is executing through a part of the graph that changed.'}
      </p>

      {blocked.length > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50/60 p-2">
          <p className="text-xs font-semibold text-amber-800">{blocked.length} instance{blocked.length === 1 ? '' : 's'} left untouched:</p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
            {blocked.slice(0, 8).map((item) => (
              <li key={item.instanceId}>
                Instance #{item.instanceId} — {item.reason ? (MIGRATION_BLOCK_REASON_LABELS[item.reason.code] ?? item.reason.code) : 'unknown reason'}
              </li>
            ))}
            {blocked.length > 8 ? <li>…and {blocked.length - 8} more.</li> : null}
          </ul>
        </div>
      ) : null}

      {migratedCount !== null ? (
        <p className="text-sm font-semibold text-emerald-700">{migratedCount} instance{migratedCount === 1 ? '' : 's'} migrated to the new revision.</p>
      ) : null}

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <AppButton intent="secondary" size="sm" onClick={onDone} disabled={migrating}>
          Done
        </AppButton>
        {impact.migratableCount > 0 && migratedCount === null ? (
          <AppButton intent="primary" size="sm" onClick={onMigrate} disabled={migrating}>
            {migrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightCircle className="h-3.5 w-3.5" />}
            Migrate {impact.migratableCount} now
          </AppButton>
        ) : null}
      </div>
    </div>
  );
};

type ValidationIssue = { code: string; severity: string; message: string; nodeKey?: string };
type ValidationReport = { status: string; issuesJson: string };
type SemanticDiffResult = {
  identical: boolean;
  nodes: Array<{ kind: string; nodeKey: string; actionBindingChanged: boolean }>;
  edges: Array<{ kind: string; edgeKey: string }>;
  bindingImpactNodeKeys: string[];
};

type LoadPhase = 'idle' | 'loading' | 'done' | 'error';

const VALIDATION_START_DELAY_MS = 1000;
const VALIDATION_PROGRESS_MIN_MS = 2500;
const VALIDATION_PROGRESS_TICK_MS = 40;

const PublishDiffSection: React.FC<{
  phase: LoadPhase;
  diff: SemanticDiffResult | null;
  error: string | null;
  publishedRevisionLabel: string;
}> = ({ phase, diff, error, publishedRevisionLabel }) => {
  const addedNodes = diff?.nodes.filter((n) => n.kind === 'ADDED').length ?? 0;
  const removedNodes = diff?.nodes.filter((n) => n.kind === 'REMOVED').length ?? 0;
  const changedNodes = diff?.nodes.filter((n) => n.kind !== 'ADDED' && n.kind !== 'REMOVED').length ?? 0;
  const bindingImpact = diff?.nodes.filter((n) => n.actionBindingChanged).length ?? 0;
  const addedEdges = diff?.edges.filter((e) => e.kind === 'ADDED').length ?? 0;
  const removedEdges = diff?.edges.filter((e) => e.kind === 'REMOVED').length ?? 0;
  const changedEdges = diff?.edges.filter((e) => e.kind !== 'ADDED' && e.kind !== 'REMOVED').length ?? 0;

  const summaryParts: string[] = [];
  if (addedNodes) summaryParts.push(`${addedNodes} node${addedNodes === 1 ? '' : 's'} added`);
  if (removedNodes) summaryParts.push(`${removedNodes} node${removedNodes === 1 ? '' : 's'} removed`);
  if (changedNodes) summaryParts.push(`${changedNodes} node${changedNodes === 1 ? '' : 's'} changed`);
  if (addedEdges) summaryParts.push(`${addedEdges} edge${addedEdges === 1 ? '' : 's'} added`);
  if (removedEdges) summaryParts.push(`${removedEdges} edge${removedEdges === 1 ? '' : 's'} removed`);
  if (changedEdges) summaryParts.push(`${changedEdges} edge${changedEdges === 1 ? '' : 's'} changed`);
  if (bindingImpact) summaryParts.push(`${bindingImpact} binding impact`);

  return (
    <div className="w-full bg-slate-50/90">
      <div className="flex items-center justify-between gap-2 px-[15px] pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Publish diff</div>
        <div className="text-[10px] font-medium text-slate-500">{publishedRevisionLabel}</div>
      </div>

      <div className="px-[15px] pb-3 pt-2">
        {phase === 'loading' ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading semantic diff…
          </div>
        ) : null}

        {phase === 'error' ? (
          <p className="text-xs font-medium text-rose-600">{error ?? 'Failed to load publish diff.'}</p>
        ) : null}

        {phase === 'done' && diff ? (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-700">
              {diff.identical
                ? 'No semantic changes vs current published revision.'
                : publishedRevisionLabel === 'Not published yet'
                  ? 'First publish — entire draft will be published.'
                  : 'Semantic diff vs current published revision'}
            </div>
            {!diff.identical && summaryParts.length > 0 ? (
              <p className="text-xs text-slate-600">{summaryParts.join(' · ')}</p>
            ) : null}
            {!diff.identical && summaryParts.length === 0 ? (
              <p className="text-xs text-slate-500">No node or edge changes detected.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const ValidationProgressSection: React.FC<{
  phase: LoadPhase;
  report: ValidationReport | null;
  error: string | null;
  draftVersion: number;
}> = ({ phase, report, error, draftVersion }) => {
  const issues: ValidationIssue[] = report ? (JSON.parse(report.issuesJson) as ValidationIssue[]) : [];
  const passed = report?.status === 'PASSED';
  const failed = phase === 'error' || (phase === 'done' && report && !passed);

  const statusIcon = phase === 'loading' ? (
    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-500" aria-hidden />
  ) : phase === 'done' && passed ? (
    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
  ) : failed ? (
    <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-hidden />
  ) : (
    <span className="inline-flex h-3.5 w-3.5 shrink-0" aria-hidden />
  );

  return (
    <div className="w-full space-y-1.5">
      <div className="flex w-full items-center gap-2">
        {statusIcon}
        <div className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Validation</div>
        <div className="ms-auto shrink-0 text-[10px] font-medium text-slate-500">draft v{draftVersion}</div>
      </div>

      {phase === 'error' ? (
        <p className="text-xs font-medium text-rose-600">{error ?? 'Validation failed.'}</p>
      ) : null}

      {phase === 'done' && report && !passed ? (
        <div>
          {issues.length > 0 ? (
            <ul className="max-h-28 space-y-1 overflow-y-auto">
              {issues.map((issue, index) => (
                <li key={index} className={cn('text-xs', issue.severity === 'ERROR' ? 'text-rose-600' : 'text-amber-600')}>
                  [{issue.code}] {issue.message}
                  {issue.nodeKey ? ` (${issue.nodeKey})` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-medium text-rose-600">{report.status}</p>
          )}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Publish confirmation dialog: loads semantic diff and runs draft validation automatically on open,
 * then enables Publish only after validation passes.
 */
export const WorkflowPublishDialog: React.FC<{
  open: boolean;
  definitionId: number;
  projection: WorkflowDesignerProjection;
  onClose: () => void;
  onPublished: () => void;
}> = ({ open, definitionId, projection, onClose, onPublished }) => {
  const [diff, setDiff] = useState<SemanticDiffResult | null>(null);
  const [diffPhase, setDiffPhase] = useState<LoadPhase>('idle');
  const [diffError, setDiffError] = useState<string | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [validationPhase, setValidationPhase] = useState<LoadPhase>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSettled, setValidationSettled] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const validationTimersRef = useRef<{ delay?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval> }>({});

  // p-99/WFT-8 — post-publish in-flight instance migration offer (only shown when the previous
  // published revision actually has migratable-or-not in-flight instances).
  const [migrationOfferOpen, setMigrationOfferOpen] = useState(false);
  const [migrationImpact, setMigrationImpact] = useState<WorkflowInstanceMigrationImpact | null>(null);
  const [migrationRevisionIds, setMigrationRevisionIds] = useState<{ from: number; to: number } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migratedCount, setMigratedCount] = useState<number | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDiff(null);
    setDiffPhase('loading');
    setDiffError(null);
    setReport(null);
    setValidationPhase('idle');
    setValidationError(null);
    setValidationSettled(false);
    setPublishError(null);
    setMigrationOfferOpen(false);
    setMigrationImpact(null);
    setMigrationRevisionIds(null);
    setMigrating(false);
    setMigratedCount(null);
    setMigrationError(null);

    let cancelled = false;

    void workflowsApi
      .getPublishDiff(definitionId)
      .then((result) => {
        if (cancelled) return;
        setDiff(result.diff as SemanticDiffResult);
        setDiffPhase('done');
      })
      .catch((error) => {
        if (cancelled) return;
        setDiffError(error instanceof WorkflowsApiError ? `${error.code}: ${error.message}` : 'Failed to load publish diff.');
        setDiffPhase('error');
      });

    validationTimersRef.current.delay = setTimeout(() => {
      if (cancelled) return;

      setValidationPhase('loading');
      const startedAt = Date.now();
      let apiFinished = false;
      let apiReport: ValidationReport | null = null;
      let apiError: string | null = null;

      const settleValidation = () => {
        if (cancelled || !apiFinished) return;
        const elapsed = Date.now() - startedAt;
        if (elapsed < VALIDATION_PROGRESS_MIN_MS) return;

        if (validationTimersRef.current.tick) {
          clearInterval(validationTimersRef.current.tick);
          validationTimersRef.current.tick = undefined;
        }

        if (apiError) {
          setValidationError(apiError);
          setValidationPhase('error');
        } else {
          setReport(apiReport);
          setValidationPhase('done');
        }
        setValidationSettled(true);
      };

      validationTimersRef.current.tick = setInterval(() => {
        if (cancelled) return;
        settleValidation();
      }, VALIDATION_PROGRESS_TICK_MS);

      void workflowsApi
        .validateDraft(definitionId, projection.draftVersion)
        .then((result) => {
          if (cancelled) return;
          apiReport = result.report as ValidationReport;
        })
        .catch((error) => {
          if (cancelled) return;
          apiError = error instanceof WorkflowsApiError ? `${error.code}: ${error.message}` : 'Validation failed.';
        })
        .finally(() => {
          if (cancelled) return;
          apiFinished = true;
          settleValidation();
        });
    }, VALIDATION_START_DELAY_MS);

    return () => {
      cancelled = true;
      if (validationTimersRef.current.delay) {
        clearTimeout(validationTimersRef.current.delay);
        validationTimersRef.current.delay = undefined;
      }
      if (validationTimersRef.current.tick) {
        clearInterval(validationTimersRef.current.tick);
        validationTimersRef.current.tick = undefined;
      }
    };
  }, [open, definitionId, projection.draftVersion]);

  const canPublish = validationSettled && validationPhase === 'done' && report?.status === 'PASSED';

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await workflowsApi.publish(definitionId, projection.draftVersion);
      const newRevision = result.revision as { id: number };
      const previousRevisionId = projection.currentPublishedRevision?.id ?? null;

      if (previousRevisionId !== null && previousRevisionId !== newRevision.id) {
        try {
          const { impact } = await workflowsApi.getInstanceMigrationImpact(previousRevisionId, newRevision.id);
          if (impact.totalConsidered > 0) {
            setMigrationImpact(impact);
            setMigrationRevisionIds({ from: previousRevisionId, to: newRevision.id });
            setMigrationOfferOpen(true);
            return;
          }
        } catch {
          // A failed impact check must never block a publish that already succeeded — just skip the offer.
        }
      }
      onPublished();
    } catch (error) {
      if (error instanceof WorkflowsApiError && error.code === 'WF_DEF_STALE_DRAFT_VERSION') {
        setPublishError('Draft changed since this view loaded — reload before publishing again.');
      } else {
        setPublishError(error instanceof WorkflowsApiError ? `${error.code}: ${error.message}` : 'Publish failed.');
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleMigrateNow = async () => {
    if (!migrationRevisionIds) return;
    setMigrating(true);
    setMigrationError(null);
    try {
      const { impact } = await workflowsApi.migrateInstances(migrationRevisionIds.from, migrationRevisionIds.to);
      setMigratedCount(impact.migratedCount);
    } catch (error) {
      setMigrationError(error instanceof WorkflowsApiError ? `${error.code}: ${error.message}` : 'Migration failed.');
    } finally {
      setMigrating(false);
    }
  };

  const handleMigrationOfferDone = () => {
    setMigrationOfferOpen(false);
    onPublished();
  };

  const publishedRevisionLabel = projection.currentPublishedRevision
    ? `Published revision #${projection.currentPublishedRevision.revisionNumber}`
    : 'Not published yet';

  if (migrationOfferOpen && migrationImpact) {
    return (
      <ConfirmDialogShell
        open={open}
        title="Publish workflow"
        icon={<UploadCloud className="h-4 w-4" />}
        iconToneClassName="text-emerald-600"
        tone="default"
        size="md"
        onClose={handleMigrationOfferDone}
        closeOnEscape={!migrating}
        onBackdropClick={migrating ? undefined : handleMigrationOfferDone}
        bodyClassName="!p-0"
        footer={(
          <PostPublishMigrationOffer
            impact={migrationImpact}
            migrating={migrating}
            migratedCount={migratedCount}
            error={migrationError}
            onMigrate={() => { void handleMigrateNow(); }}
            onDone={handleMigrationOfferDone}
          />
        )}
      />
    );
  }

  return (
    <ConfirmDialogShell
      open={open}
      title="Publish workflow"
      icon={<UploadCloud className="h-4 w-4" />}
      iconToneClassName="text-emerald-600"
      tone="default"
      size="md"
      onClose={onClose}
      onConfirm={() => { void handlePublish(); }}
      confirmLabel="Publish"
      confirmIcon={<UploadCloud className="h-3.5 w-3.5" />}
      confirmIntent="primary"
      confirmDisabled={!canPublish}
      isConfirming={publishing}
      confirmingLabel="Publishing…"
      cancelDisabled={publishing}
      error={publishError}
      closeOnEscape={!publishing}
      onBackdropClick={publishing ? undefined : onClose}
      bodyClassName="flex w-full flex-col gap-0 !p-0"
      auxiliaryFooter={(
        <ValidationProgressSection
          phase={validationPhase}
          report={report}
          error={validationError}
          draftVersion={projection.draftVersion}
        />
      )}
      auxiliaryFooterClassName="!mt-0 !flex-col !items-stretch !justify-start gap-1.5 py-2.5"
    >
      <PublishDiffSection
        phase={diffPhase}
        diff={diff}
        error={diffError}
        publishedRevisionLabel={publishedRevisionLabel}
      />
    </ConfirmDialogShell>
  );
};

