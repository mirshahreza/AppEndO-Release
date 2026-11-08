import * as React from 'react';
import type { RequestPreviewSummary } from '../../../domain/component-designer/bindingPayloadPreview';
import { formatPayloadPreviewJson } from '../../../domain/component-designer/bindingPayloadPreview';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

type BindingRequestPreviewProps = {
  summary: RequestPreviewSummary | null;
  className?: string;
};

export const BindingRequestPreview: React.FC<BindingRequestPreviewProps> = ({ summary, className }) => {
  if (!summary) {
    return null;
  }

  return (
    <div className={`rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/80 p-2.5 text-[11px] text-slate-700 ${className ?? ''}`}>
      <p className="font-semibold text-slate-800">Request preview</p>
      <p className="mt-1">
        <span className="font-medium">Method:</span> {summary.method}
      </p>
      <p className="mt-0.5 font-mono text-[10px]">{summary.endpoint}</p>
      {summary.bodyEntries.length > 0 ? (
        <>
          <p className="mt-2 font-medium text-slate-800">Payload</p>
          <pre className={`mt-1 max-h-32 overflow-auto rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2 font-mono text-[10px] text-slate-600`}>
            {formatPayloadPreviewJson(summary.bodyEntries)}
          </pre>
        </>
      ) : null}
      {summary.onSuccess ? (
        <p className="mt-2 text-emerald-800">
          <span className="font-medium">On success:</span> {summary.onSuccess}
        </p>
      ) : null}
    </div>
  );
};
