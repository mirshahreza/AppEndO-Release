import { cn } from '../../../lib/utils';
import type { EngineeringPipelineViewModel } from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';
import { CollapsibleEngineeringDetail, EngineeringDetailStat } from './CollapsibleEngineeringDetail';

type SemanticPlanPanelProps = {
  pipeline: EngineeringPipelineViewModel;
  className?: string;
};

const approvalStatusLabel = (pipeline: EngineeringPipelineViewModel): string => {
  if (pipeline.approvalStatus === 'approved') return 'Approved';
  if (pipeline.approvalStatus === 'stale') return 'Stale — re-plan required';
  if (pipeline.approvalStatus === 'revoked') return 'Revoked';
  if (pipeline.requiresApproval) return 'Waiting for approval';
  return 'Informational';
};

const buildPhaseLabel = (pipeline: EngineeringPipelineViewModel): string | undefined => {
  if (pipeline.promotionState === 'DEPLOYED') {
    return 'Deployed';
  }
  if (pipeline.verificationRunId && pipeline.deployable === false) {
    return 'Verification blocked';
  }
  if (pipeline.verificationRunId) {
    return 'Verified';
  }
  if (pipeline.executedNodeCount > 0) {
    return 'Build complete';
  }
  return undefined;
};

const buildSummary = (pipeline: EngineeringPipelineViewModel): string => {
  const objective = pipeline.planObjective?.trim() || 'Engineering plan prepared.';
  const phase = buildPhaseLabel(pipeline);
  const status = approvalStatusLabel(pipeline);

  if (pipeline.promotionState === 'DEPLOYED') {
    return `Changes deployed: ${objective}`;
  }

  const parts = [objective];
  if (phase && phase !== status) {
    parts.push(phase);
  }
  parts.push(status);
  return parts.join(' · ');
};

/** AE-10.2/6.3 — ASP summary for engineering pipeline turns (approval CTA is separate). */
export const SemanticPlanPanel = ({
  pipeline,
  className,
}: SemanticPlanPanelProps) => {
  const isDeployed = pipeline.promotionState === 'DEPLOYED';
  const buildPhase = buildPhaseLabel(pipeline);

  return (
    <CollapsibleEngineeringDetail
      className={className}
      testId="semantic-plan-panel"
      detailsTestId="semantic-plan-details"
      summary={buildSummary(pipeline)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
          Build plan
        </span>
        <div className="flex items-center gap-1.5">
          {buildPhase ? (
            <span className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium ring-1',
              isDeployed
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                : 'bg-white text-slate-600 ring-slate-200',
            )}
            >
              {buildPhase}
            </span>
          ) : null}
          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
            {approvalStatusLabel(pipeline)}
          </span>
        </div>
      </div>

      {isDeployed ? (
        <p
          className="mb-2 text-[11px] leading-relaxed text-emerald-800"
          data-testid="semantic-plan-deployed-banner"
        >
          Engineering change deployed
          {pipeline.packageSnapshotId ? ` · snapshot ${pipeline.packageSnapshotId}` : ''}
          {pipeline.packageRoundtripValidated ? ' · export validated' : ''}
          {(pipeline.runtimeActivatedCount ?? 0) > 0
            ? ` · ${pipeline.runtimeActivatedCount} runtime primitive(s) activated`
            : ''}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <EngineeringDetailStat label="Artifacts" value={pipeline.artifactCount} />
        <EngineeringDetailStat label="Change nodes" value={pipeline.changeNodeCount} />
        <EngineeringDetailStat label="Capability gaps" value={pipeline.capabilityGapCount} />
        <EngineeringDetailStat label="Context rev." value={pipeline.contextPackRevision} />
        <EngineeringDetailStat label="Change graph" value={pipeline.changeGraphId} />
        <EngineeringDetailStat label="Workspace" value={pipeline.workspaceId} />
        <EngineeringDetailStat label="Executed" value={pipeline.executedNodeCount > 0 ? pipeline.executedNodeCount : undefined} />
        <EngineeringDetailStat label="Reconciled" value={pipeline.reconciledNodeCount && pipeline.reconciledNodeCount > 0
          ? pipeline.reconciledNodeCount
          : undefined}
        />
        <EngineeringDetailStat label="Failed" value={pipeline.failedNodeCount > 0 ? pipeline.failedNodeCount : undefined} />
        <EngineeringDetailStat label="Checkpoint" value={pipeline.checkpointId} />
      </div>
    </CollapsibleEngineeringDetail>
  );
};
