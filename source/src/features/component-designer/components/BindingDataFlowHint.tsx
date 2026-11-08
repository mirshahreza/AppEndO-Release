import * as React from 'react';
import { ArrowRight, Database, BarChart3 } from 'lucide-react';

type BindingDataFlowHintProps = {
  /** Short label for the source, e.g. "API rows" or "List endpoint" */
  sourceLabel?: string;
  /** Short label for the target widget */
  targetLabel?: string;
  /** One-line explanation of what the mapping does */
  description: string;
};

export const BindingDataFlowHint: React.FC<BindingDataFlowHintProps> = ({
  sourceLabel = 'API rows',
  targetLabel = 'Chart',
  description,
}) => (
  <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2.5">
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
      <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 shadow-sm">
        <Database className="h-3 w-3" strokeWidth={2} />
        {sourceLabel}
      </span>
      <ArrowRight className="h-3 w-3 text-sky-500" strokeWidth={2} />
      <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 shadow-sm">
        <BarChart3 className="h-3 w-3" strokeWidth={2} />
        {targetLabel}
      </span>
    </div>
    <p className="mt-1.5 ps-[4px] text-[11px] leading-relaxed text-sky-900/90">{description}</p>
  </div>
);
