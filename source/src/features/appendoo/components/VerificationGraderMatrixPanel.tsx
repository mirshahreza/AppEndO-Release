import { cn } from '../../../lib/utils';
import type { EngineeringPipelineViewModel } from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';

type VerificationGraderMatrixPanelProps = {
  pipeline: EngineeringPipelineViewModel;
  className?: string;
};

const gradeClass = (grade: string): string => {
  switch (grade) {
    case 'PASS':
      return 'text-emerald-700 bg-emerald-50 ring-emerald-100';
    case 'FAIL':
      return 'text-rose-700 bg-rose-50 ring-rose-100';
    case 'WARNING':
      return 'text-amber-700 bg-amber-50 ring-amber-100';
    default:
      return 'text-slate-600 bg-slate-100 ring-slate-200';
  }
};

/** AE-10.5 — verification grader matrix with evidence layers (nested inside pipeline details). */
export const VerificationGraderMatrixPanel = ({ pipeline, className }: VerificationGraderMatrixPanelProps) => {
  const graders = pipeline.verificationGraderSummary ?? [];
  if (!pipeline.verificationRunId || graders.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('mt-2', className)}
      data-testid="verification-grader-matrix-panel"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
          Verification matrix
        </span>
        <span className="text-[10px] text-slate-600">
          {pipeline.verificationPassCount ?? 0}
          {' pass · '}
          {pipeline.verificationFailCount ?? 0}
          {' fail'}
        </span>
      </div>

      <ul className="space-y-1">
        {graders.map((grader) => (
          <li
            key={grader.graderId}
            className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white/80 px-2 py-1"
          >
            <div className="min-w-0">
              <div className="truncate text-[10px] font-medium text-slate-800">{grader.graderId}</div>
              <div className="truncate text-[9px] text-slate-500">{grader.layer}</div>
            </div>
            <span className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ring-1', gradeClass(grader.grade))}>
              {grader.grade}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
