import type { EngineeringPipelineViewModel } from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';
import { CollapsibleEngineeringDetail, EngineeringDetailStat } from './CollapsibleEngineeringDetail';

type EngineeringWorkspacePanelProps = {
  pipeline: EngineeringPipelineViewModel;
  className?: string;
};

const buildSummary = (pipeline: EngineeringPipelineViewModel): string => {
  const mutationCount = pipeline.mutationPathCount ?? 0;
  if (mutationCount > 0) {
    return `Isolated workspace prepared with ${mutationCount} file change${mutationCount === 1 ? '' : 's'}.`;
  }
  return 'Isolated engineering workspace prepared.';
};

/** AE-10.3/10.4 — isolated workspace revision lineage + mutation diff summary. */
export const EngineeringWorkspacePanel = ({ pipeline, className }: EngineeringWorkspacePanelProps) => {
  if (!pipeline.workspaceId || !pipeline.revisionId) {
    return null;
  }

  const hasMutations = (pipeline.mutationPathCount ?? 0) > 0;

  return (
    <CollapsibleEngineeringDetail
      className={className}
      testId="engineering-workspace-panel"
      detailsTestId="engineering-workspace-details"
      summary={buildSummary(pipeline)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
          Engineering workspace
        </span>
        <div className="flex items-center gap-1.5">
          {pipeline.workspaceLineageLabel ? (
            <span
              className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200"
              data-testid="engineering-workspace-lineage-badge"
            >
              {pipeline.workspaceLineageLabel}
            </span>
          ) : null}
          {pipeline.workspaceStorageKind ? (
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
              {pipeline.workspaceStorageKind}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <EngineeringDetailStat label="Workspace" value={pipeline.workspaceId} />
        <EngineeringDetailStat label="Revision" value={pipeline.revisionId} />
        <EngineeringDetailStat label="Revision #" value={pipeline.revisionNumber} />
        <EngineeringDetailStat label="Fingerprint" value={pipeline.revisionFingerprint} />
        <EngineeringDetailStat label="Workspace state" value={pipeline.workspaceState} />
        <EngineeringDetailStat label="Revision state" value={pipeline.revisionState} />
        <EngineeringDetailStat label="Mutations" value={hasMutations ? pipeline.mutationPathCount : undefined} />
        <EngineeringDetailStat label="Verified nodes" value={pipeline.verifiedNodeCount} />
        <EngineeringDetailStat label="Change set" value={pipeline.changeSetId} />
        <EngineeringDetailStat label="Parent revision" value={pipeline.parentRevisionId} />
      </div>

      {hasMutations && pipeline.mutationPathPreview?.length ? (
        <div className="mt-2 rounded border border-slate-200 bg-white/70 px-2 py-1.5">
          <span className="ps-[4px] text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Isolated diff preview
          </span>
          <ul className="mt-1 space-y-0.5">
            {pipeline.mutationPathPreview.map((path) => (
              <li key={path} className="truncate font-mono text-[10px] text-slate-700">{path}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </CollapsibleEngineeringDetail>
  );
};
