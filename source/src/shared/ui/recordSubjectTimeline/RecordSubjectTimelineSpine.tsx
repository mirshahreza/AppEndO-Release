import React, { useMemo } from 'react';

import { cn } from '../../../lib/utils';
import { SHADOW_RAISED } from '../surfaceClasses';
import {
  buildRecordSubjectTimelineSpineRows,
  type RecordSubjectTimelineDirection,
} from './recordSubjectTimelineSpineLayout';
import {
  RECORD_SUBJECT_TIMELINE_CARD_SPINE_GUTTER_CLASS,
  RECORD_SUBJECT_TIMELINE_SPINE_ROW_PY_CLASS,
  RECORD_SUBJECT_TIMELINE_SPINE_TRACK_CLASS,
  RECORD_SUBJECT_TIMELINE_SPINE_VERTICAL_LINE_CLASS,
  RECORD_SUBJECT_TIMELINE_YEAR_DASH_LINE_CLASS,
  RECORD_SUBJECT_TIMELINE_YEAR_ROW_PY_CLASS,
} from './recordSubjectTimelinePresentation';

const SpineYearBadge: React.FC<{ year: number }> = ({ year }) => (
  <span
    className={cn(
      'relative z-[3] inline-flex min-w-[3rem] shrink-0 items-center justify-center',
      'rounded-full border border-slate-200/90 bg-gradient-to-b from-white to-slate-50',
      'px-2.5 py-0.5 text-[10px] font-bold tabular-nums tracking-tight text-slate-800',
      'shadow-sm ring-2 ring-white',
    )}
  >
    {year}
  </span>
);

const SpineVerticalSegment: React.FC<{ isFirst: boolean; isLast: boolean }> = ({ isFirst, isLast }) => (
  <span
    className={cn(
      RECORD_SUBJECT_TIMELINE_SPINE_VERTICAL_LINE_CLASS,
      'top-[-0.5rem] bottom-[-0.5rem] sm:top-[-0.625rem] sm:bottom-[-0.625rem]',
      isFirst && 'top-[-1.25rem] sm:top-[-1.5rem]',
      isLast && 'bottom-[-1.25rem] sm:bottom-[-1.5rem]',
    )}
    aria-hidden
  />
);

const YearDividerRow: React.FC<{
  year: number;
  isFirst: boolean;
  isLast: boolean;
}> = ({ year, isFirst, isLast }) => (
  <li
    className={cn(
      'grid grid-cols-1 items-center overflow-visible sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-x-0',
      RECORD_SUBJECT_TIMELINE_YEAR_ROW_PY_CLASS,
    )}
  >
    <div className="hidden min-w-0 items-center sm:flex">
      <span className={RECORD_SUBJECT_TIMELINE_YEAR_DASH_LINE_CLASS} aria-hidden />
    </div>

    <div className={cn(RECORD_SUBJECT_TIMELINE_SPINE_TRACK_CLASS, 'hidden min-h-[2rem] justify-center py-0 sm:flex')}>
      <SpineVerticalSegment isFirst={isFirst} isLast={isLast} />
      <SpineYearBadge year={year} />
    </div>

    <div className="hidden min-w-0 items-center sm:flex">
      <span className={RECORD_SUBJECT_TIMELINE_YEAR_DASH_LINE_CLASS} aria-hidden />
    </div>

    <div className="relative flex min-h-[2rem] w-full items-center gap-2 px-1 sm:hidden">
      <SpineVerticalSegment isFirst={isFirst} isLast={isLast} />
      <span className={RECORD_SUBJECT_TIMELINE_YEAR_DASH_LINE_CLASS} aria-hidden />
      <SpineYearBadge year={year} />
      <span className={RECORD_SUBJECT_TIMELINE_YEAR_DASH_LINE_CLASS} aria-hidden />
    </div>
  </li>
);

const EventCardSide: React.FC<{
  side: 'beforeSpine' | 'afterSpine';
  showCard: boolean;
  children: React.ReactNode;
}> = ({ side, showCard, children }) => (
  <div
    className={cn(
      'hidden min-w-0 w-full items-center sm:flex',
      !showCard && 'invisible pointer-events-none',
      side === 'beforeSpine' ? 'justify-end' : 'justify-start',
    )}
  >
    {side === 'beforeSpine' ? (
      <>
        <div className="min-w-0 flex-1" aria-hidden />
        {showCard ? children : null}
        {showCard ? <span className={RECORD_SUBJECT_TIMELINE_CARD_SPINE_GUTTER_CLASS} aria-hidden /> : null}
      </>
    ) : (
      <>
        {showCard ? <span className={RECORD_SUBJECT_TIMELINE_CARD_SPINE_GUTTER_CLASS} aria-hidden /> : null}
        {showCard ? children : null}
        <div className="min-w-0 flex-1" aria-hidden />
      </>
    )}
  </div>
);

export type RecordSubjectTimelineSpineProps<TEvent extends { id: string; occurredAt: string }> = {
  events: readonly TEvent[];
  direction: RecordSubjectTimelineDirection;
  getEventKey?: (event: TEvent) => string;
  resolveSpineDotClassName: (event: TEvent) => string;
  renderEventCard: (event: TEvent, onSelect: () => void) => React.ReactNode;
  onEventSelect?: (event: TEvent) => void;
  /** Parent supplies display order (e.g. domain tie-break beyond occurredAt). */
  preserveEventOrder?: boolean;
  className?: string;
};

export function RecordSubjectTimelineSpine<TEvent extends { id: string; occurredAt: string }>({
  events,
  direction,
  getEventKey = (event) => event.id,
  resolveSpineDotClassName,
  renderEventCard,
  onEventSelect,
  preserveEventOrder,
  className,
}: RecordSubjectTimelineSpineProps<TEvent>): React.ReactElement {
  const timelineRows = useMemo(
    () => buildRecordSubjectTimelineSpineRows(events, direction, { preserveEventOrder }),
    [events, direction, preserveEventOrder],
  );
  const lastRowIndex = timelineRows.length - 1;

  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[34rem] px-4 py-3 sm:max-w-[36rem] sm:px-8 sm:py-4',
        className,
      )}
    >
      <ol className="relative m-0 flex list-none flex-col gap-0 p-0">
        {timelineRows.map((row, rowIndex) => {
          const isFirst = rowIndex === 0;
          const isLast = rowIndex === lastRowIndex;

          if (row.kind === 'year') {
            return (
              <YearDividerRow key={row.key} year={row.year} isFirst={isFirst} isLast={isLast} />
            );
          }

          const onLeft = row.eventIndex % 2 === 0;
          const selectEvent = () => onEventSelect?.(row.event);

          return (
            <li
              key={getEventKey(row.event)}
              className={cn(
                'grid grid-cols-1 items-stretch gap-2 overflow-visible sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-x-0 sm:gap-y-0 sm:px-1',
                RECORD_SUBJECT_TIMELINE_SPINE_ROW_PY_CLASS,
              )}
            >
              <EventCardSide side="beforeSpine" showCard={onLeft}>
                {renderEventCard(row.event, selectEvent)}
              </EventCardSide>

              <div className={RECORD_SUBJECT_TIMELINE_SPINE_TRACK_CLASS}>
                <SpineVerticalSegment isFirst={isFirst} isLast={isLast} />
                <span
                  className={cn(
                    'relative z-[2] h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white shadow-xs ring-1',
                    resolveSpineDotClassName(row.event),
                  )}
                  aria-hidden
                />
              </div>

              <EventCardSide side="afterSpine" showCard={!onLeft}>
                {renderEventCard(row.event, selectEvent)}
              </EventCardSide>

              <div className="flex w-full justify-center px-1 sm:hidden">
                {renderEventCard(row.event, selectEvent)}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Shared detail line stack inside timeline cards. */
export const RecordSubjectTimelineCardDetailLines: React.FC<{
  lines: Array<{ label: string; value: string }>;
  separatedFromAbove?: boolean;
}> = ({ lines, separatedFromAbove = false }) => {
  if (lines.length === 0) {
    return null;
  }

  return (
    <dl
      className={cn(
        'space-y-1',
        separatedFromAbove && 'mt-1.5 border-t border-slate-200/40 pt-1.5',
      )}
    >
      {lines.map((line) => (
        <div
          key={`${line.label}:${line.value}`}
          className="grid grid-cols-[minmax(0,42%)_minmax(0,1fr)] items-start gap-x-2 gap-y-0"
        >
          <dt className="min-w-0 text-[11px] font-semibold leading-snug text-slate-500 line-clamp-2">
            {line.label}
          </dt>
          <dd className="min-w-0 text-xs font-semibold leading-snug text-slate-800 line-clamp-4 break-words whitespace-pre-wrap">
            {line.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

/** Clickable timeline card chrome (border, shadow, hover). */
export const RecordSubjectTimelineCardShell: React.FC<{
  toneClassName: string;
  accentClassName: string;
  maxWidthClassName?: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({
  toneClassName,
  accentClassName,
  maxWidthClassName,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      maxWidthClassName,
      'group flex flex-col overflow-hidden rounded-lg border border-s-2 px-3 py-2.5 text-start',
      SHADOW_RAISED,
      'transition-colors duration-150 hover:border-slate-300/90 motion-reduce:transition-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200',
      toneClassName,
      accentClassName,
    )}
  >
    {children}
  </button>
);
