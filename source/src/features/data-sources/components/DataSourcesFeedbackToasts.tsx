import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type DataSourcesFeedbackToastsProps = {
  error: string;
  successMessage: string;
  onDismissError: () => void;
  onDismissSuccess: () => void;
};

export const DataSourcesFeedbackToasts: React.FC<DataSourcesFeedbackToastsProps> = ({
  error,
  successMessage,
  onDismissError,
  onDismissSuccess,
}) => (
  <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
    {error && (
      <div className="pointer-events-auto min-w-[280px] max-w-[420px] rounded-lg border border-red-200 bg-white shadow-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
          <div className="flex-1 text-xs text-slate-700">{error}</div>
          <button
            type="button"
            onClick={onDismissError}
            className="text-indigo-500 hover:text-indigo-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )}
    {successMessage && (
      <div className="pointer-events-auto min-w-[280px] max-w-[420px] rounded-lg border border-emerald-200 bg-white shadow-lg p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
          <div className="flex-1 text-xs text-slate-700">{successMessage}</div>
          <button
            type="button"
            onClick={onDismissSuccess}
            className="text-indigo-500 hover:text-indigo-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )}
  </div>
);
