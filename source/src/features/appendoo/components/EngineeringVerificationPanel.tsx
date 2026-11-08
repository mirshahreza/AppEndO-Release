import { cn } from '../../../lib/utils';
import { AppButton } from '../../../shared/ui/AppButton';
import type { EngineeringPipelineViewModel } from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';
import { CollapsibleEngineeringDetail, EngineeringDetailStat } from './CollapsibleEngineeringDetail';

type EngineeringVerificationPanelProps = {
  pipeline: EngineeringPipelineViewModel;
  className?: string;
  onRepairExecute?: () => void;
  repairExecuteBusy?: boolean;
};

const buildSummary = (pipeline: EngineeringPipelineViewModel): string => {
  if (pipeline.promotionState === 'DEPLOYED') {
    return 'Verification passed and changes were promoted.';
  }
  if (pipeline.deployable === false) {
    return 'Verification finished — build is not deployable yet.';
  }
  if (pipeline.deployable) {
    return 'Verification passed — ready to promote.';
  }
  return 'Verification run in progress.';
};

/** AE-9.2/10.5/10.6 — verification + promotion + repair revision summary. */
export const EngineeringVerificationPanel = ({
  pipeline,
  className,
  onRepairExecute,
  repairExecuteBusy,
}: EngineeringVerificationPanelProps) => {
  if (!pipeline.verificationRunId) {
    return null;
  }

  const deployableLabel = pipeline.deployable ? 'Deployable' : 'Not deployable';
  const deployableClass = pipeline.deployable
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    : 'bg-rose-50 text-rose-700 ring-rose-100';

  const roundtripLabel = pipeline.packageRoundtripValidated === undefined
    ? undefined
    : pipeline.packageRoundtripValidated ? 'Validated' : 'Failed';

  const hasRepairRevision = Boolean(pipeline.repairRevisionId);

  return (
    <CollapsibleEngineeringDetail
      className={className}
      testId="engineering-verification-panel"
      detailsTestId="engineering-verification-details"
      summary={buildSummary(pipeline)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
          Verification & promotion
        </span>
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium ring-1', deployableClass)}>
          {deployableLabel}
        </span>
      </div>

      {!pipeline.deployable && hasRepairRevision ? (
        <div
          className="mb-2 rounded border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900"
          data-testid="engineering-verification-repair-banner"
        >
          <div>
            Verification blocked — repair revision
            {pipeline.repairRevisionNumber ? ` R${pipeline.repairRevisionNumber}` : ''} opened
            {pipeline.failedRevisionId ? ` (failed ${pipeline.failedRevisionId})` : ''}
          </div>
          {onRepairExecute && pipeline.approvalBindingId ? (
            <AppButton
              intent="confirm"
              size="sm"
              className="mt-1.5"
              data-testid="engineering-verification-repair-execute"
              onClick={onRepairExecute}
              disabled={repairExecuteBusy}
            >
              {repairExecuteBusy ? 'Re-running repair…' : 'Re-run repair revision'}
            </AppButton>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <EngineeringDetailStat label="Verification" value={pipeline.verificationRunId} />
        <EngineeringDetailStat label="Grader pass" value={pipeline.verificationPassCount} />
        <EngineeringDetailStat label="Grader fail" value={pipeline.verificationFailCount && pipeline.verificationFailCount > 0
          ? pipeline.verificationFailCount
          : undefined}
        />
        <EngineeringDetailStat label="Failed revision" value={pipeline.failedRevisionId} />
        <EngineeringDetailStat label="Repair revision" value={pipeline.repairRevisionId} />
        <EngineeringDetailStat label="Promotion" value={pipeline.promotionRunId} />
        <EngineeringDetailStat label="Promotion state" value={pipeline.promotionState} />
        <EngineeringDetailStat label="Preflight" value={pipeline.promotionPreflightOk === undefined
          ? undefined
          : pipeline.promotionPreflightOk ? 'OK' : 'Failed'}
        />
        <EngineeringDetailStat label="Package snapshot" value={pipeline.packageSnapshotId} />
        <EngineeringDetailStat label="Export roundtrip" value={roundtripLabel} />
        <EngineeringDetailStat label="Runtime activated" value={pipeline.runtimeActivatedCount} />
        <EngineeringDetailStat label="Activation failed" value={pipeline.runtimeActivationFailedCount
          && pipeline.runtimeActivationFailedCount > 0
          ? pipeline.runtimeActivationFailedCount
          : undefined}
        />
        <EngineeringDetailStat label="Checkpoint" value={pipeline.checkpointId} />
      </div>
    </CollapsibleEngineeringDetail>
  );
};
