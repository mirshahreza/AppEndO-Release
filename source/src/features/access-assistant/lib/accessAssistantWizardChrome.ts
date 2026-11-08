import { cn } from '../../../lib/utils';

/** Bordered list host — Subject user/role pickers and Access function toggles. */
export const ACCESS_ASSISTANT_PICKER_LIST_CLASS =
  'flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white';

/** Surface sections on Access step — two columns when width allows (sparse sections). */
export const ACCESS_ASSISTANT_SURFACE_GRID_CLASS =
  'grid grid-cols-1 items-start gap-4 md:grid-cols-2';

export const ACCESS_ASSISTANT_SECTION_TITLE_CLASS =
  'ps-1 text-xs font-bold uppercase tracking-wide text-slate-500';

export const ACCESS_ASSISTANT_FIELD_LABEL_CLASS =
  'ps-1 text-sm font-semibold text-slate-700';

/** Subject type cards — two-up on sm+. */
export const ACCESS_ASSISTANT_SUBJECT_TYPE_GRID_CLASS =
  'grid grid-cols-1 gap-3 sm:grid-cols-2';

export const resolveAccessAssistantSubjectTypeCardClass = (selected: boolean) =>
  cn(
    'relative rounded-lg border bg-white text-left transition-all',
    'border-slate-200 hover:border-primary-400 hover:shadow-sm',
    selected && 'border-primary-500 bg-primary-subtle/40 shadow-sm ring-1 ring-primary-200',
  );

export const resolveAccessAssistantPickerRowClass = (selected: boolean, disabled?: boolean) =>
  cn(
    'flex w-full items-start gap-3 px-3 py-2.5 text-start transition-colors',
    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
    selected ? 'bg-primary-subtle/50' : !disabled && 'hover:bg-slate-50',
  );

export const ACCESS_ASSISTANT_HTTP_METHOD_BADGE_CLASS: Record<string, string> = {
  GET: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  POST: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PUT: 'bg-amber-50 text-amber-700 border-amber-200',
  PATCH: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const resolveAccessAssistantHttpMethodBadgeClass = (method: string) =>
  cn(
    'inline-flex min-w-[3.25rem] shrink-0 items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold',
    ACCESS_ASSISTANT_HTTP_METHOD_BADGE_CLASS[method.toUpperCase()]
      ?? 'border-slate-200 bg-slate-50 text-slate-700',
  );
