import { useState, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export const EngineeringDetailStat = ({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) => (
  value === undefined ? null : (
    <div className="flex flex-col gap-[2px]">
      <span className="ps-[4px] text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-xs text-slate-700">{value}</span>
    </div>
  )
);

type CollapsibleEngineeringDetailProps = {
  summary: string;
  children?: ReactNode;
  className?: string;
  testId?: string;
  detailsTestId?: string;
  defaultExpanded?: boolean;
};

/** One-line engineering status; technical fields stay behind an optional Details toggle. */
export const CollapsibleEngineeringDetail = ({
  summary,
  children,
  className,
  testId,
  detailsTestId,
  defaultExpanded = false,
}: CollapsibleEngineeringDetailProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasDetails = Boolean(children);

  return (
    <div
      className={cn('mt-1.5 text-xs leading-relaxed text-slate-600', className)}
      data-testid={testId}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-slate-700">{summary}</span>
        {hasDetails ? (
          <button
            type="button"
            className="shrink-0 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            data-testid={detailsTestId ? `${detailsTestId}-toggle` : undefined}
          >
            {expanded ? 'Hide details' : 'Details'}
          </button>
        ) : null}
      </div>
      {expanded && hasDetails ? (
        <div
          className="mt-1.5 rounded border border-slate-200 bg-slate-50/80 px-2 py-1.5"
          data-testid={detailsTestId}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};
