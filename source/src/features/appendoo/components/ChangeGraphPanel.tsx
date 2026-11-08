import { cn } from '../../../lib/utils';
import type { EngineeringPipelineViewModel } from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';
import { CollapsibleEngineeringDetail } from './CollapsibleEngineeringDetail';

type ChangeGraphPanelProps = {
  pipeline: EngineeringPipelineViewModel;
  className?: string;
};

const stateBadgeClass = (state: string): string => {
  switch (state) {
    case 'VERIFIED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'FAILED':
      return 'bg-rose-50 text-rose-700 ring-rose-100';
    case 'READY':
    case 'BUILDING':
      return 'bg-sky-50 text-sky-700 ring-sky-100';
    default:
      return 'bg-white text-slate-600 ring-slate-200';
  }
};

const buildSummary = (pipeline: EngineeringPipelineViewModel): string => {
  const total = pipeline.changeNodeCount;
  const verified = pipeline.changeGraphVerifiedCount ?? 0;
  const failed = pipeline.changeGraphFailedCount ?? 0;

  if (failed > 0) {
    return `Build steps: ${total} planned, ${verified} verified, ${failed} failed.`;
  }
  if (verified >= total && total > 0) {
    return `Build steps: all ${total} step${total === 1 ? '' : 's'} verified.`;
  }
  return `Build steps: ${total} planned${verified > 0 ? `, ${verified} verified` : ''}.`;
};

/** AE-10.4 — persisted Change Graph node preview with live states. */
export const ChangeGraphPanel = ({ pipeline, className }: ChangeGraphPanelProps) => {
  if (!pipeline.changeGraphId || pipeline.changeNodeCount === 0) {
    return null;
  }

  const nodes = pipeline.changeGraphNodePreview ?? [];

  return (
    <CollapsibleEngineeringDetail
      className={className}
      testId="change-graph-panel"
      detailsTestId="change-graph-details"
      summary={buildSummary(pipeline)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
          Change graph
        </span>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
          {pipeline.changeNodeCount} node{pipeline.changeNodeCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-2 text-[10px]">
        <div className="rounded bg-white/70 px-2 py-1 text-slate-600">
          Ready
          {' '}
          <span className="font-semibold text-slate-800">{pipeline.changeGraphReadyCount ?? 0}</span>
        </div>
        <div className="rounded bg-white/70 px-2 py-1 text-slate-600">
          Verified
          {' '}
          <span className="font-semibold text-slate-800">{pipeline.changeGraphVerifiedCount ?? 0}</span>
        </div>
        <div className="rounded bg-white/70 px-2 py-1 text-slate-600">
          Failed
          {' '}
          <span className="font-semibold text-slate-800">{pipeline.changeGraphFailedCount ?? 0}</span>
        </div>
      </div>

      {nodes.length > 0 ? (
        <ul className="space-y-1">
          {nodes.map((node) => (
            <li
              key={node.nodeId}
              className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white/70 px-2 py-1"
            >
              <span className="truncate font-mono text-[10px] text-slate-700">{node.operationType}</span>
              <span className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ring-1', stateBadgeClass(node.state))}>
                {node.state}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </CollapsibleEngineeringDetail>
  );
};
