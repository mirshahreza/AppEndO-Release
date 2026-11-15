import React from 'react';
import { Users } from 'lucide-react';

import { cn } from '../../../lib/utils';

/** Participant counts stay Western digits + grouping (legacy grid parity). */
const PARTICIPANTS_COUNT_NUMBER_LOCALE = 'en-US';

const GRID_COUNT_COLUMN_HEADER_CLASS =
  'text-center [&>div]:justify-center whitespace-nowrap';

const GRID_COUNT_COLUMN_CELL_CLASS = 'text-center align-middle';

/** Grid column width for participant count badge. */
export const HWY_GRID_PARTICIPANT_COUNT_COLUMN_WIDTH = '145px';

/** Uniform badge width — slightly inset from the column (145px − 16px). */
const PARTICIPANTS_COUNT_BADGE_WIDTH_CLASS = 'box-border w-[129px] min-w-[129px] max-w-[129px]';

const PARTICIPANTS_COUNT_BADGE_CLASS =
  'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200/80 bg-white px-2 py-1 text-base font-semibold tabular-nums leading-none text-slate-800';

const PARTICIPANTS_COUNT_PLAIN_CLASS =
  'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-semibold tabular-nums leading-none text-slate-800';

/** Grid count control — default text+icon; pill chrome on hover/focus only. */
const PARTICIPANTS_COUNT_BUTTON_GROUP_CLASS =
  'cursor-default group-hover:cursor-pointer';

/** Hover on the pill only — flat, no outer button halo. */
const PARTICIPANTS_COUNT_BADGE_HOVER_CLASS =
  'transition-colors duration-150 group-hover:border-slate-300/90 group-hover:bg-slate-50 group-focus-visible:border-slate-300/90 group-focus-visible:bg-slate-50';

/** Central activities grid — pill chrome only on hover/focus. */
const PARTICIPANTS_COUNT_PLAIN_TO_BADGE_HOVER_CLASS =
  'transition-[background-color,border-color,box-shadow] duration-150 group-hover:border-slate-200/80 group-hover:bg-white group-hover:shadow-sm group-focus-visible:border-slate-200/80 group-focus-visible:bg-white group-focus-visible:shadow-sm';

export function formatHwyGridParticipantCount(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return new Intl.NumberFormat(PARTICIPANTS_COUNT_NUMBER_LOCALE, {
    maximumFractionDigits: 0,
    numberingSystem: 'latn',
  }).format(safe);
}

export type HwyGridParticipantCountChrome = 'badge' | 'plainUntilHover';

type HwyGridParticipantCountBadgeProps = {
  count: number;
  className?: string;
  chrome?: HwyGridParticipantCountChrome;
  /** When true, responds to parent `group` hover/focus (participant grid button). */
  withGroupHover?: boolean;
};

export const HwyGridParticipantCountBadge: React.FC<HwyGridParticipantCountBadgeProps> = ({
  count,
  className,
  chrome = 'badge',
  withGroupHover = false,
}) => (
  <span
    className={cn(
      PARTICIPANTS_COUNT_BADGE_WIDTH_CLASS,
      chrome === 'plainUntilHover'
        ? cn(
            PARTICIPANTS_COUNT_PLAIN_CLASS,
            withGroupHover && PARTICIPANTS_COUNT_PLAIN_TO_BADGE_HOVER_CLASS,
          )
        : cn(
            PARTICIPANTS_COUNT_BADGE_CLASS,
            withGroupHover && PARTICIPANTS_COUNT_BADGE_HOVER_CLASS,
          ),
      className,
    )}
  >
    <Users className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
    <span dir="ltr" className="tabular-nums">
      {formatHwyGridParticipantCount(count)}
    </span>
  </span>
);

type HwyGridParticipantCountButtonProps = {
  count: number;
  onActivate: () => void;
  ariaLabel: string;
  chrome?: HwyGridParticipantCountChrome;
};

/** Legacy `#members_ItemTemplates` — unified icon + count opens detail list. */
export const HwyGridParticipantCountButton: React.FC<HwyGridParticipantCountButtonProps> = ({
  count,
  onActivate,
  ariaLabel,
  chrome = 'plainUntilHover',
}) => (
  <button
    type="button"
    aria-label={ariaLabel}
    className={cn(
      'group mx-auto inline-flex w-full max-w-full justify-center border-0 bg-transparent p-0 shadow-none outline-none',
      'focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-1',
      PARTICIPANTS_COUNT_BUTTON_GROUP_CLASS,
    )}
    onClick={(event) => {
      event.stopPropagation();
      onActivate();
    }}
  >
    <HwyGridParticipantCountBadge count={count} chrome={chrome} withGroupHover />
  </button>
);

export const hwyGridParticipantCountColumnChrome = {
  headerClassName: GRID_COUNT_COLUMN_HEADER_CLASS,
  cellClassName: GRID_COUNT_COLUMN_CELL_CLASS,
} as const;