import React from 'react';

import { cn } from '../../../lib/utils';
import { TYPE_CAPTION_CLASS } from '../typographyRoles';
import {
  CATALOG_INTERACTION_STATES,
  type CatalogInteractionProfile,
  type CatalogInteractionState,
} from './catalogInteractionState';

export type CatalogSpecimenInteractionLanesProps = {
  profile: CatalogInteractionProfile;
  stateLabel: (state: CatalogInteractionState) => string;
  liveLabel: string;
  children: React.ReactNode | ((state: CatalogInteractionState | 'live') => React.ReactNode);
  className?: string;
  laneClassName?: string;
  /** Center specimen inside each lane (compact avatar columns). */
  centerContent?: boolean;
};

const LANE_STATE_SURFACE_CLASS: Record<CatalogInteractionState, string> = {
  default: 'bg-slate-50/30',
  hover: 'bg-sky-50/35',
  active: 'bg-slate-100/40',
};

const LANE_LABEL_CLASS = cn(
  TYPE_CAPTION_CLASS,
  'mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500',
);

export const CatalogSpecimenInteractionLanes: React.FC<CatalogSpecimenInteractionLanesProps> = ({
  profile,
  stateLabel,
  liveLabel,
  children,
  className,
  laneClassName,
  centerContent = false,
}) => {
  const laneBodyClass = cn(centerContent && 'flex justify-center');
  if (profile === 'none') {
    const content = typeof children === 'function' ? children('live') : children;
    return <div className={className}>{content}</div>;
  }

  const frozenContent = (state: CatalogInteractionState) =>
    typeof children === 'function' ? children(state) : children;

  const liveContent = typeof children === 'function' ? children('live') : children;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className={cn(
          'rounded-md border border-emerald-200/90 bg-emerald-50/25 p-2 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)]',
          laneClassName,
        )}
        data-catalog-interaction-state="live"
      >
        <p className={cn(LANE_LABEL_CLASS, 'text-emerald-800')}>{liveLabel}</p>
        <div className={cn('pointer-events-auto touch-manipulation', laneBodyClass)}>{liveContent}</div>
      </div>

      {CATALOG_INTERACTION_STATES.map((state) => {
        const laneContent = frozenContent(state);
        return (
          <div
            key={state}
            className={cn(
              'rounded-md p-2',
              LANE_STATE_SURFACE_CLASS[state],
              laneClassName,
            )}
            data-catalog-interaction-state={state}
          >
            <p className={LANE_LABEL_CLASS}>{stateLabel(state)}</p>
            <div className={cn('pointer-events-none select-none', laneBodyClass)}>{laneContent}</div>
          </div>
        );
      })}
    </div>
  );
};
