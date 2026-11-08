import { cn } from '../../../lib/utils';
import type { EngineeringPipelineSnapshot, EngineeringPipelineViewModel } from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';
import { formatRequestClassLabel } from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';
import { CollapsibleEngineeringDetail, EngineeringDetailStat } from './CollapsibleEngineeringDetail';
import { VerificationGraderMatrixPanel } from './VerificationGraderMatrixPanel';

type EngineeringPipelineStatusProps = {
  snapshot: EngineeringPipelineSnapshot;
  pipeline?: EngineeringPipelineViewModel;
  className?: string;
};

const buildSummary = (
  snapshot: EngineeringPipelineSnapshot,
  pipeline?: EngineeringPipelineViewModel,
): string => {
  if (pipeline?.promotionState === 'DEPLOYED') {
    return 'Engineering pipeline finished and changes were deployed.';
  }
  if (pipeline?.changeGraphDriftOk === false) {
    return 'Engineering pipeline active — context drift detected; review details if build looks stale.';
  }
  if (snapshot.routingReason?.trim()) {
    return snapshot.routingReason.trim();
  }
  return 'Engineering pipeline is preparing the build.';
};

/** AE-10.1/7–9 — engineering routing summary + drift/orchestration/grader matrix. */
export const EngineeringPipelineStatus = ({ snapshot, pipeline, className }: EngineeringPipelineStatusProps) => {
  if (!snapshot.useEngineeringPipeline && snapshot.requestClass !== 'CONTEXT_QUERY') {
    return null;
  }

  const isDeployed = pipeline?.promotionState === 'DEPLOYED';
  const showDriftBadge = pipeline?.changeGraphDriftOk === false;
  const orchestrationErrors = pipeline?.builderOrchestrationErrors ?? [];

  return (
    <CollapsibleEngineeringDetail
      className={className}
      testId="engineering-pipeline-status"
      detailsTestId="engineering-pipeline-details"
      summary={buildSummary(snapshot, pipeline)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
          Engineering pipeline
        </span>
        <div className="flex items-center gap-1.5">
          {isDeployed ? (
            <span
              className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100"
              data-testid="engineering-pipeline-deployed-badge"
            >
              Deployed
            </span>
          ) : null}
          {showDriftBadge ? (
            <span
              className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-100"
              data-testid="engineering-pipeline-drift-badge"
            >
              Drift
            </span>
          ) : null}
          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
            {formatRequestClassLabel(snapshot.requestClass)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <EngineeringDetailStat label="Scope" value={snapshot.applicationScopeKey} />
        <EngineeringDetailStat label="Context targets" value={snapshot.contextPackTargetCount} />
        <EngineeringDetailStat label="Standards" value={snapshot.contextPackStandardsCount} />
        {pipeline ? (
          <>
            <EngineeringDetailStat label="Plan" value={pipeline.planId} />
            <EngineeringDetailStat label="Graph nodes" value={pipeline.changeNodeCount} />
            <EngineeringDetailStat label="Built" value={pipeline.executedNodeCount > 0 ? pipeline.executedNodeCount : undefined} />
            <EngineeringDetailStat label="Drift stale" value={pipeline.changeGraphDriftStaleCount} />
            <EngineeringDetailStat label="Orchestration errors" value={pipeline.builderOrchestrationErrorCount} />
            <EngineeringDetailStat label="Checkpoint" value={pipeline.checkpointId} />
            <EngineeringDetailStat label="Package snapshot" value={pipeline.packageSnapshotId} />
          </>
        ) : null}
      </div>

      {orchestrationErrors.length > 0 ? (
        <ul
          className="mt-2 space-y-1 rounded border border-rose-100 bg-rose-50/50 px-2 py-1"
          data-testid="engineering-pipeline-orchestration-errors"
        >
          {orchestrationErrors.slice(0, 3).map((error) => (
            <li key={error} className="text-[10px] text-rose-700">{error}</li>
          ))}
        </ul>
      ) : null}

      {pipeline ? <VerificationGraderMatrixPanel pipeline={pipeline} /> : null}
    </CollapsibleEngineeringDetail>
  );
};
