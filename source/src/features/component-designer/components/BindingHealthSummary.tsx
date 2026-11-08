import * as React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { BindingHealthSummary as BindingHealthSummaryModel } from '../../../domain/component-designer/bindingDiagnostics';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

type BindingHealthSummaryProps = {
  summary: BindingHealthSummaryModel;
  compact?: boolean;
};

const severityIcon = (severity: 'error' | 'warning' | 'info') => {
  if (severity === 'error') {
    return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" strokeWidth={2} />;
  }

  if (severity === 'warning') {
    return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" strokeWidth={2} />;
  }

  return <Info className="h-3.5 w-3.5 shrink-0 text-sky-600" strokeWidth={2} />;
};

export const BindingHealthSummary: React.FC<BindingHealthSummaryProps> = ({ summary, compact = false }) => {
  const hasConnection = Boolean(summary.connectedResourceId);

  if (!hasConnection && summary.issues.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/80 ${compact ? 'px-2 py-1.5' : 'p-2.5'}`}>
      {hasConnection ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2} />
            <p className="text-[11px] font-semibold text-slate-800">
              {summary.connectedResourceName ?? summary.connectedResourceId}
            </p>
          </div>

          {!compact ? (
            <div className="space-y-0.5 ps-[18px] text-[10px] text-slate-600">
              {summary.loadEndpoint ? (
                <p>
                  <span className="font-medium text-slate-700">Load:</span>{' '}
                  <span className="font-mono">{summary.loadEndpoint}</span>
                </p>
              ) : null}
              {summary.submitEndpoint ? (
                <p>
                  <span className="font-medium text-slate-700">Submit:</span>{' '}
                  {summary.submitMethod ? `${summary.submitMethod} ` : ''}
                  <span className="font-mono">{summary.submitEndpoint}</span>
                </p>
              ) : null}
              <p>
                <span className="font-medium text-slate-700">Fields mapped:</span>{' '}
                {summary.mappedFieldCount}/{summary.totalFieldCount}
              </p>
            </div>
          ) : (
            <p className="ps-[18px] text-[10px] text-slate-600">
              {summary.mappedFieldCount}/{summary.totalFieldCount} fields mapped
            </p>
          )}
        </div>
      ) : null}

      {summary.issues.length > 0 ? (
        <ul className={`space-y-1 ${hasConnection ? 'mt-2 border-t border-slate-200/80 pt-2' : ''}`}>
          {summary.issues.map((issue) => (
            <li key={issue.id} className="flex items-start gap-1.5 text-[10px] text-slate-700">
              {severityIcon(issue.severity)}
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
