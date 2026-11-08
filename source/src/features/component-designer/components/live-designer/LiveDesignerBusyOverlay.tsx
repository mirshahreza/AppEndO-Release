import * as React from 'react';
import { Loader2 } from 'lucide-react';

/** Extra time the center Saving overlay stays after the request finishes. Saved toast waits until this ends. */
export const LIVE_DESIGNER_SAVE_BUSY_HOLD_MS = 2000;

export type LiveDesignerBusyOverlayProps = {
  open: boolean;
  label?: string;
};

export const LiveDesignerBusyOverlay: React.FC<LiveDesignerBusyOverlayProps> = ({
  open,
  label = 'Saving…',
}) => {
  if (!open) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[100] flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="live-designer-busy-overlay"
    >
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden />
        <span>{label}</span>
      </div>
    </div>
  );
};
