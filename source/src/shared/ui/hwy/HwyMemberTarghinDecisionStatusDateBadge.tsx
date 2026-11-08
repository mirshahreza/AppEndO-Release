import React from 'react';

import { MountGridDateText } from '../../../app/platform/MountGridDateText';
import {
  HWY_MEMBER_TARGHIN_REQUEST_STATUS_BADGE_CLASS,
  resolveHwyMemberTarghinRequestStatusPresentation,
} from '../../../domain/hwy/hwyMemberTarghinRequestPresentation';
import { cn } from '../../../lib/utils';

export type HwyMemberTarghinDecisionStatusDateBadgeProps = {
  statusCode: string;
  statusLabel: string;
  finalAt?: string | null;
  className?: string;
};

/**
 * Legacy targhin admin: status pill with nested decision date chip.
 */
export const HwyMemberTarghinDecisionStatusDateBadge: React.FC<HwyMemberTarghinDecisionStatusDateBadgeProps> = ({
  statusCode,
  statusLabel,
  finalAt,
  className,
}) => {
  const statusPresentation = resolveHwyMemberTarghinRequestStatusPresentation(statusCode);
  const hasDate = Boolean(finalAt?.trim());

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 ps-2 pe-1 text-[11px] font-semibold leading-none',
        HWY_MEMBER_TARGHIN_REQUEST_STATUS_BADGE_CLASS[statusPresentation.tone],
        className,
      )}
    >
      <span className="truncate">{statusLabel}</span>
      {hasDate ? (
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full border border-white/60 bg-white/90 px-1.5 py-0.5',
            'text-[10px] font-medium tabular-nums text-slate-700 shadow-xs',
          )}
        >
          <MountGridDateText value={finalAt} align="start" className="inline w-auto font-mono" />
        </span>
      ) : null}
    </span>
  );
};
