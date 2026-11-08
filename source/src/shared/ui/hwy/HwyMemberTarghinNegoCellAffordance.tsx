import React from 'react';
import { MessageSquare, MessageSquarePlus } from 'lucide-react';

import { cn } from '../../../lib/utils';
import { HWY_MEMBER_TARGHIN_NOTE_BODY_CLASS } from '../../../domain/hwy/hwyMemberTarghinAdminLayout';
import { AppButton } from '../AppButton';

const NEGO_LINK_CLASS =
  'ms-[5px] inline-flex h-auto min-h-0 w-auto max-w-full items-center gap-1 border-0 bg-transparent px-0 py-0.5 text-start text-xs font-medium text-primary-700 shadow-none transition-colors hover:bg-transparent hover:text-primary-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50';

export type HwyMemberTarghinNegoCellAffordanceProps = {
  negoNoteCount: number;
  lastNegoNote?: string | null;
  lastNegoNoteIsByViewer?: boolean;
  composeHint: React.ReactNode;
  openThreadLabel: React.ReactNode;
  openThreadAriaLabel: string;
  onOpenThread: () => void;
  className?: string;
};

/** Targhin admin decision column: open negotiation thread + optional count badge and preview. */
export const HwyMemberTarghinNegoCellAffordance: React.FC<HwyMemberTarghinNegoCellAffordanceProps> = ({
  negoNoteCount,
  lastNegoNote,
  lastNegoNoteIsByViewer,
  composeHint,
  openThreadLabel,
  openThreadAriaLabel,
  onOpenThread,
  className,
}) => {
  const preview = lastNegoNote?.trim();
  const effectiveCount = negoNoteCount > 0 ? negoNoteCount : (preview ? 1 : 0);
  const hasMessages = effectiveCount > 0;

  const countLabel = effectiveCount > 99 ? '99+' : String(effectiveCount);

  return (
    <div className={cn('mt-[11px] space-y-1', className)}>
      <AppButton
        className={NEGO_LINK_CLASS}
        onClick={onOpenThread}
        aria-label={openThreadAriaLabel}
      >
        {hasMessages ? (
          <span
            className="relative inline-flex shrink-0"
            aria-label={countLabel}
          >
            <MessageSquare className="h-3.5 w-3.5 text-primary-600" aria-hidden />
            <span
              className="absolute -top-1.5 -end-1.5 inline-flex min-h-[0.875rem] min-w-[0.875rem] items-center justify-center rounded-full bg-primary-600 px-0.5 text-[9px] font-bold leading-none text-white shadow-sm"
              aria-hidden
            >
              {countLabel}
            </span>
          </span>
        ) : (
          <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-primary-500" aria-hidden />
        )}
        <span className="min-w-0 leading-snug">{hasMessages ? openThreadLabel : composeHint}</span>
      </AppButton>
      {hasMessages && preview ? (
        <p
          className={cn(
            HWY_MEMBER_TARGHIN_NOTE_BODY_CLASS,
            'line-clamp-2 text-start text-xs leading-snug',
            lastNegoNoteIsByViewer ? 'text-slate-500' : 'font-medium text-slate-800',
          )}
        >
          {preview}
        </p>
      ) : null}
    </div>
  );
};
