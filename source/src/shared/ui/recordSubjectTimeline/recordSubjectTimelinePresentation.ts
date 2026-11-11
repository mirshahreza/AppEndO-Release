import type { RecordEventKind } from '../../api/contracts/record-events';

export type RecordSubjectTimelineEventTone =
  | 'creation'
  | 'change'
  | 'workflow'
  | 'security'
  | 'neutral';

export const RECORD_SUBJECT_TIMELINE_CARD_CLASS: Record<RecordSubjectTimelineEventTone, string> = {
  creation: 'border-emerald-200/80 bg-emerald-50/50',
  change: 'border-indigo-200/80 bg-indigo-50/40',
  workflow: 'border-sky-200/80 bg-sky-50/40',
  security: 'border-amber-200/80 bg-amber-50/45',
  neutral: 'border-slate-200/90 bg-white',
};

export const RECORD_SUBJECT_TIMELINE_CARD_ACCENT_CLASS: Record<RecordSubjectTimelineEventTone, string> = {
  creation: 'border-s-emerald-400',
  change: 'border-s-indigo-400',
  workflow: 'border-s-sky-400',
  security: 'border-s-amber-500',
  neutral: 'border-s-slate-300',
};

export const RECORD_SUBJECT_TIMELINE_SPINE_DOT_CLASS: Record<RecordSubjectTimelineEventTone, string> = {
  creation: 'bg-emerald-500 ring-emerald-200/90',
  change: 'bg-indigo-500 ring-indigo-200/90',
  workflow: 'bg-sky-500 ring-sky-200/90',
  security: 'bg-amber-500 ring-amber-200/90',
  neutral: 'bg-slate-400 ring-slate-200/90',
};

export function resolveRecordSubjectTimelineEventTone(input: {
  eventKind: string;
  projection?: string | null;
}): RecordSubjectTimelineEventTone {
  if (input.projection === 'auth') {
    return 'security';
  }
  const kind = input.eventKind as RecordEventKind | string;
  if (kind === 'created' || kind === 'deleted') {
    return 'creation';
  }
  if (
    kind === 'field.changed'
    || kind === 'status.changed'
    || kind === 'association.added'
    || kind === 'association.removed'
    || kind === 'config.changed'
  ) {
    return 'change';
  }
  if (kind === 'access.denied' || kind === 'history.erased' || kind === 'history.archived') {
    return 'security';
  }
  return 'neutral';
}

export const RECORD_SUBJECT_TIMELINE_EVENT_CARD_MAX_CLASS =
  'w-[min(100%,calc(14.5rem+55px))] max-w-[calc(14.5rem+55px)] shrink-0 sm:w-[calc(14.5rem+55px)]';

export const RECORD_SUBJECT_TIMELINE_SPINE_TRACK_CLASS =
  'relative z-[1] flex w-8 shrink-0 flex-col items-center justify-center self-stretch overflow-visible px-0.5 sm:w-9 sm:px-1';

export const RECORD_SUBJECT_TIMELINE_CARD_SPINE_GUTTER_CLASS =
  'hidden h-px w-4 shrink-0 bg-slate-300 sm:block';

export const RECORD_SUBJECT_TIMELINE_SPINE_ROW_PY_CLASS = 'py-2 sm:py-2.5';
export const RECORD_SUBJECT_TIMELINE_YEAR_ROW_PY_CLASS = 'py-2.5 sm:py-3';

export const RECORD_SUBJECT_TIMELINE_SPINE_VERTICAL_LINE_CLASS =
  'pointer-events-none absolute start-1/2 z-0 w-px -translate-x-1/2 bg-slate-300/95';

export const RECORD_SUBJECT_TIMELINE_YEAR_DASH_LINE_CLASS =
  'h-0 min-w-0 flex-1 border-t border-dashed border-slate-300/90';
