import React from 'react';
import { AlertTriangle, Check, Loader2, Minus, X } from 'lucide-react';
import type { GitConnectStep, GitConnectStepStatus } from '../../../shared/api/contracts/git/types';
import { cn } from '../../../lib/utils';

type GitConnectProvisioningStepsProps = {
  steps: GitConnectStep[];
  warnings?: string[];
  isRunning?: boolean;
};

const stepStatusIcon = (status: GitConnectStepStatus, isRunning: boolean) => {
  if (isRunning && status !== 'error') {
    return <Loader2 className="size-4 shrink-0 animate-spin text-indigo-600" aria-hidden />;
  }

  switch (status) {
    case 'success':
      return <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />;
    case 'warning':
      return <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />;
    case 'error':
      return <X className="size-4 shrink-0 text-rose-600" aria-hidden />;
    case 'skipped':
    default:
      return <Minus className="size-4 shrink-0 text-slate-400" aria-hidden />;
  }
};

const stepStatusTone = (status: GitConnectStepStatus): string => {
  switch (status) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50/60';
    case 'warning':
      return 'border-amber-200 bg-amber-50/60';
    case 'error':
      return 'border-rose-200 bg-rose-50/60';
    case 'skipped':
    default:
      return 'border-slate-200 bg-white';
  }
};

export const GitConnectProvisioningSteps: React.FC<GitConnectProvisioningStepsProps> = ({
  steps,
  warnings = [],
  isRunning = false,
}) => {
  if (steps.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {steps.length > 0 ? (
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-200 overflow-hidden">
          {steps.map((step) => (
            <div
              key={step.id}
              className={cn('flex items-start gap-3 px-4 py-3', stepStatusTone(step.status))}
            >
              <div className="mt-0.5">
                {stepStatusIcon(step.status, isRunning)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-800">{step.label}</div>
                {step.message ? (
                  <p className="mt-0.5 text-sm text-slate-600 break-words">{step.message}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Warnings</div>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {warnings.map((warning) => (
              <li key={warning} className="break-words">{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
