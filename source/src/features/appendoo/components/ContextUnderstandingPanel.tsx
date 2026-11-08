import type { EngineeringPipelineSnapshot } from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';
import { formatRequestClassLabel } from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';
import { CollapsibleEngineeringDetail, EngineeringDetailStat } from './CollapsibleEngineeringDetail';

type ContextUnderstandingPanelProps = {
  snapshot: EngineeringPipelineSnapshot;
  className?: string;
};

const buildSummary = (snapshot: EngineeringPipelineSnapshot): string => {
  if (snapshot.routingReason?.trim()) {
    return snapshot.routingReason.trim();
  }
  const targetCount = snapshot.contextPackTargetCount ?? 0;
  if (targetCount > 0) {
    return `Request understood with ${targetCount} relevant target${targetCount === 1 ? '' : 's'} in context.`;
  }
  return 'Request understood in the current page context.';
};

/** AE-10.2 — intent/scope/context understanding summary for engineering turns. */
export const ContextUnderstandingPanel = ({ snapshot, className }: ContextUnderstandingPanelProps) => {
  if (!snapshot.useEngineeringPipeline && snapshot.requestClass !== 'CONTEXT_QUERY') {
    return null;
  }

  const explanations = snapshot.contextPackSelectionExplanations ?? [];

  return (
    <CollapsibleEngineeringDetail
      className={className}
      testId="context-understanding-panel"
      detailsTestId="context-understanding-details"
      summary={buildSummary(snapshot)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
          Understanding & context
        </span>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
          {formatRequestClassLabel(snapshot.requestClass)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <EngineeringDetailStat label="Task profile" value={snapshot.taskProfile} />
        <EngineeringDetailStat label="Scope" value={snapshot.applicationScopeKey} />
        <EngineeringDetailStat label="Scope kind" value={snapshot.applicationScopeKind} />
        <EngineeringDetailStat label="Context pack" value={snapshot.contextPackId} />
        <EngineeringDetailStat label="Targets" value={snapshot.contextPackTargetCount} />
        <EngineeringDetailStat label="Standards" value={snapshot.contextPackStandardsCount} />
      </div>

      {explanations.length > 0 ? (
        <ul
          className="mt-2 space-y-1 rounded border border-slate-200 bg-white/70 px-2 py-1.5"
          data-testid="context-pack-enrichment-explanations"
        >
          {explanations.map((explanation) => (
            <li key={`${explanation.reasonCode}:${explanation.summary}`} className="text-[10px] text-slate-600">
              <span className="font-medium text-slate-700">{explanation.reasonCode}</span>
              {' — '}
              {explanation.summary}
            </li>
          ))}
        </ul>
      ) : null}
    </CollapsibleEngineeringDetail>
  );
};
