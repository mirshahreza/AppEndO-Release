/**
 * Productive UI type ramp (docs/standards/ui-design-system.md §2).
 * html/body stay at the browser 16px root — never shrink rem globally.
 * Consume these roles; do not pick ad-hoc text-* sizes for the same job.
 */

/** Shell page title — 14px / 700. Dialog primary headers stay on DIALOG_PRIMARY_HEADER_TITLE_CLASS (same size). */
export const TYPE_PAGE_TITLE_CLASS = 'text-sm font-bold tracking-tight';

/** Panel subsection, catalog card human title, named group header — 12px / 600. */
export const TYPE_SECTION_TITLE_CLASS = 'text-xs font-semibold';

/** Table names, function names, slugs, PK tokens — 12px / 400 mono. */
export const TYPE_IDENTIFIER_CLASS = 'font-mono text-xs font-normal';

/** Form body and default reading copy — 14px / 400. */
export const TYPE_BODY_CLASS = 'text-sm font-normal';

/** Form field labels — 14px / 400. */
export const TYPE_FIELD_LABEL_CLASS = 'text-sm font-normal';

/** Input, select, and readonly field values — semibold for scanability. */
export const TYPE_FIELD_VALUE_CLASS = 'font-semibold text-slate-900';

/** FormSection / grouping headers — never a field label. */
export const TYPE_EYEBROW_CLASS = 'text-xs font-semibold uppercase tracking-wider';

/** Timestamps, helper text, catalog meta — 11px / 400. Never semibold. */
export const TYPE_CAPTION_CLASS = 'text-[11px] font-normal';

/** Dense counts and badges only. */
export const TYPE_MICRO_CLASS = 'text-[10px]';
