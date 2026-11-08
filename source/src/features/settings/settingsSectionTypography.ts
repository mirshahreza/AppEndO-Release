import type { AttributeScope } from '../../shared/api/contracts/attributes/types';
import type { AppSurfaceBoxTone } from '../../shared/ui/surfaceClasses';
import { SETTINGS_SECTION_TONE } from './settingsSectionSemantics';
import type { SectionId } from './types';

/**
 * Typography + semantic color tokens for Settings **content**.
 * Content tints are darker than the matching nav icon (`*-600` in
 * `settingsSectionSemantics.ts`) — labels/keys use `*-900`–`*-950`.
 * Do not darken the submenu / selection here.
 */
export type SettingsTypographyTokens = {
  pageTitle: string;
  pageDesc: string;
  groupTitle: string;
  groupAccent: string;
  groupDesc: string;
  fieldLabel: string;
  fieldHint: string;
  toggleTitle: string;
  toggleTitleActive: string;
  toggleDesc: string;
  checkboxCard: string;
  checkboxCardChecked: string;
  checkboxLabel: string;
  checkboxLabelChecked: string;
  gridPrimary: string;
  gridSecondary: string;
  gridMono: string;
  gridTypeBadge: string;
  footerNote: string;
  footerNoteEmphasis: string;
  loadingText: string;
  statLine: string;
};

const CHECKBOX_CARD_BASE =
  'flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 transition-colors';

const TONE_PAGE_TITLE: Record<AppSurfaceBoxTone, string> = {
  slate: 'text-base font-bold tracking-tight text-slate-900',
  violet: 'text-base font-bold tracking-tight text-violet-950',
  cyan: 'text-base font-bold tracking-tight text-cyan-950',
  indigo: 'text-base font-bold tracking-tight text-indigo-950',
  emerald: 'text-base font-bold tracking-tight text-emerald-950',
  amber: 'text-base font-bold tracking-tight text-amber-950',
  rose: 'text-base font-bold tracking-tight text-rose-950',
};

const TONE_GROUP_TITLE: Record<AppSurfaceBoxTone, string> = {
  slate: 'text-slate-900',
  violet: 'text-violet-950',
  cyan: 'text-cyan-950',
  indigo: 'text-indigo-950',
  emerald: 'text-emerald-950',
  amber: 'text-amber-950',
  rose: 'text-rose-950',
};

const TONE_GROUP_ACCENT: Record<AppSurfaceBoxTone, string> = {
  slate: 'bg-slate-900',
  violet: 'bg-violet-900',
  cyan: 'bg-cyan-950',
  indigo: 'bg-indigo-900',
  emerald: 'bg-emerald-900',
  amber: 'bg-amber-900',
  rose: 'bg-rose-900',
};

const TONE_FIELD_LABEL: Record<AppSurfaceBoxTone, string> = {
  slate: 'ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700',
  violet: 'ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700',
  cyan: 'ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700',
  indigo: 'ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700',
  emerald: 'ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700',
  amber: 'ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700',
  rose: 'ps-[4px] text-sm font-medium normal-case tracking-normal text-slate-700',
};

const TONE_GROUP_DESC: Record<AppSurfaceBoxTone, string> = {
  slate: 'text-xs font-medium leading-relaxed text-slate-900 ps-[4px]',
  violet: 'text-xs font-medium leading-relaxed text-violet-950 ps-[4px]',
  cyan: 'text-xs font-medium leading-relaxed text-cyan-950 ps-[4px]',
  indigo: 'text-xs font-medium leading-relaxed text-indigo-950 ps-[4px]',
  emerald: 'text-xs font-medium leading-relaxed text-emerald-950 ps-[4px]',
  amber: 'text-xs font-medium leading-relaxed text-amber-950 ps-[4px]',
  rose: 'text-xs font-medium leading-relaxed text-rose-950 ps-[4px]',
};

const TONE_TOGGLE_ACTIVE: Record<AppSurfaceBoxTone, string> = {
  slate: 'text-sm font-semibold text-slate-900',
  violet: 'text-sm font-semibold text-violet-950',
  cyan: 'text-sm font-semibold text-cyan-950',
  indigo: 'text-sm font-semibold text-indigo-950',
  emerald: 'text-sm font-semibold text-emerald-950',
  amber: 'text-sm font-semibold text-amber-950',
  rose: 'text-sm font-semibold text-rose-950',
};

const TONE_CHECKBOX: Record<AppSurfaceBoxTone, { card: string; checked: string; label: string; labelChecked: string }> = {
  slate: {
    card: `${CHECKBOX_CARD_BASE} border-slate-200 hover:border-slate-300 hover:bg-slate-50/80`,
    checked: 'border-slate-300 bg-slate-50/90',
    label: 'text-sm font-semibold text-slate-700',
    labelChecked: 'text-sm font-semibold text-slate-900',
  },
  violet: {
    card: `${CHECKBOX_CARD_BASE} border-violet-100 hover:border-violet-200 hover:bg-violet-50/50`,
    checked: 'border-violet-200 bg-violet-50/70',
    label: 'text-sm font-semibold text-slate-700',
    labelChecked: 'text-sm font-semibold text-violet-950',
  },
  cyan: {
    card: `${CHECKBOX_CARD_BASE} border-cyan-100 hover:border-cyan-200 hover:bg-cyan-50/50`,
    checked: 'border-cyan-200 bg-cyan-50/70',
    label: 'text-sm font-semibold text-slate-700',
    labelChecked: 'text-sm font-semibold text-cyan-950',
  },
  indigo: {
    card: `${CHECKBOX_CARD_BASE} border-indigo-100 hover:border-indigo-200 hover:bg-indigo-50/50`,
    checked: 'border-indigo-200 bg-indigo-50/70',
    label: 'text-sm font-semibold text-slate-700',
    labelChecked: 'text-sm font-semibold text-indigo-950',
  },
  emerald: {
    card: `${CHECKBOX_CARD_BASE} border-emerald-100 hover:border-emerald-200 hover:bg-emerald-50/50`,
    checked: 'border-emerald-200 bg-emerald-50/70',
    label: 'text-sm font-semibold text-slate-700',
    labelChecked: 'text-sm font-semibold text-emerald-950',
  },
  amber: {
    card: `${CHECKBOX_CARD_BASE} border-amber-100 hover:border-amber-200 hover:bg-amber-50/50`,
    checked: 'border-amber-200 bg-amber-50/70',
    label: 'text-sm font-semibold text-slate-700',
    labelChecked: 'text-sm font-semibold text-amber-950',
  },
  rose: {
    card: `${CHECKBOX_CARD_BASE} border-rose-100 hover:border-rose-200 hover:bg-rose-50/50`,
    checked: 'border-rose-200 bg-rose-50/70',
    label: 'text-sm font-semibold text-slate-700',
    labelChecked: 'text-sm font-semibold text-rose-950',
  },
};

const TONE_GRID: Record<AppSurfaceBoxTone, { primary: string; secondary: string; mono: string; badge: string }> = {
  slate: {
    primary: 'text-sm font-semibold text-slate-900',
    secondary: 'text-xs font-medium leading-snug text-slate-900',
    mono: 'font-mono text-[11px] text-slate-900',
    badge: 'text-[10px] font-bold uppercase tracking-wide text-slate-950 bg-slate-50 border border-slate-400',
  },
  violet: {
    primary: 'text-sm font-semibold text-violet-950',
    secondary: 'text-xs font-medium leading-snug text-violet-950',
    mono: 'font-mono text-[11px] text-violet-950',
    badge: 'text-[10px] font-bold uppercase tracking-wide text-violet-950 bg-violet-50 border border-violet-400',
  },
  cyan: {
    primary: 'text-sm font-semibold text-cyan-950',
    secondary: 'text-xs font-medium leading-snug text-cyan-950',
    mono: 'font-mono text-[11px] text-cyan-950',
    badge: 'text-[10px] font-bold uppercase tracking-wide text-cyan-950 bg-cyan-50 border border-cyan-400',
  },
  indigo: {
    primary: 'text-sm font-semibold text-indigo-950',
    secondary: 'text-xs font-medium leading-snug text-indigo-950',
    mono: 'font-mono text-[11px] text-indigo-950',
    badge: 'text-[10px] font-bold uppercase tracking-wide text-indigo-950 bg-indigo-50 border border-indigo-400',
  },
  emerald: {
    primary: 'text-sm font-semibold text-emerald-950',
    secondary: 'text-xs font-medium leading-snug text-emerald-950',
    mono: 'font-mono text-[11px] text-emerald-950',
    badge: 'text-[10px] font-bold uppercase tracking-wide text-emerald-950 bg-emerald-50 border border-emerald-400',
  },
  amber: {
    primary: 'text-sm font-semibold text-amber-950',
    secondary: 'text-xs font-medium leading-snug text-amber-950',
    mono: 'font-mono text-[11px] text-amber-950',
    badge: 'text-[10px] font-bold uppercase tracking-wide text-amber-950 bg-amber-50 border border-amber-400',
  },
  rose: {
    primary: 'text-sm font-semibold text-rose-950',
    secondary: 'text-xs font-medium leading-snug text-rose-950',
    mono: 'font-mono text-[11px] text-rose-950',
    badge: 'text-[10px] font-bold uppercase tracking-wide text-rose-950 bg-rose-50 border border-rose-400',
  },
};

const TONE_EMPHASIS: Record<AppSurfaceBoxTone, string> = {
  slate: 'font-semibold text-slate-900',
  violet: 'font-semibold text-violet-950',
  cyan: 'font-semibold text-cyan-950',
  indigo: 'font-semibold text-indigo-950',
  emerald: 'font-semibold text-emerald-950',
  amber: 'font-semibold text-amber-950',
  rose: 'font-semibold text-rose-950',
};

const TONE_STAT_LINE: Record<AppSurfaceBoxTone, string> = {
  slate: 'text-xs font-medium text-slate-900',
  violet: 'text-xs font-medium text-violet-950',
  cyan: 'text-xs font-medium text-cyan-950',
  indigo: 'text-xs font-medium text-indigo-950',
  emerald: 'text-xs font-medium text-emerald-950',
  amber: 'text-xs font-medium text-amber-950',
  rose: 'text-xs font-medium text-rose-950',
};

function buildToneTypography(tone: AppSurfaceBoxTone): SettingsTypographyTokens {
  const checkbox = TONE_CHECKBOX[tone];
  const grid = TONE_GRID[tone];

  return {
    pageTitle: TONE_PAGE_TITLE[tone],
    pageDesc: 'text-xs font-medium leading-snug text-slate-500',
    groupTitle: TONE_GROUP_TITLE[tone],
    groupAccent: TONE_GROUP_ACCENT[tone],
    groupDesc: TONE_GROUP_DESC[tone],
    fieldLabel: TONE_FIELD_LABEL[tone],
    fieldHint: 'text-[11px] font-medium leading-snug text-slate-500 ps-[4px]',
    toggleTitle: 'text-sm font-semibold text-slate-800',
    toggleTitleActive: TONE_TOGGLE_ACTIVE[tone],
    toggleDesc: 'text-xs font-normal leading-relaxed text-slate-500',
    checkboxCard: checkbox.card,
    checkboxCardChecked: checkbox.checked,
    checkboxLabel: checkbox.label,
    checkboxLabelChecked: checkbox.labelChecked,
    gridPrimary: grid.primary,
    gridSecondary: grid.secondary,
    gridMono: grid.mono,
    gridTypeBadge: `rounded px-1.5 py-0.5 ${grid.badge}`,
    footerNote: 'text-xs font-medium leading-relaxed text-slate-500',
    footerNoteEmphasis: TONE_EMPHASIS[tone],
    loadingText: 'text-sm font-medium text-slate-400',
    statLine: TONE_STAT_LINE[tone],
  };
}

const TONE_TYPOGRAPHY: Record<AppSurfaceBoxTone, SettingsTypographyTokens> = {
  slate: buildToneTypography('slate'),
  violet: buildToneTypography('violet'),
  cyan: buildToneTypography('cyan'),
  indigo: buildToneTypography('indigo'),
  emerald: buildToneTypography('emerald'),
  amber: buildToneTypography('amber'),
  rose: buildToneTypography('rose'),
};

export function getSettingsTypography(sectionId: SectionId): SettingsTypographyTokens {
  return TONE_TYPOGRAPHY[SETTINGS_SECTION_TONE[sectionId]];
}

export function getSettingsTypographyForAttributeScope(scope: AttributeScope): SettingsTypographyTokens {
  return getSettingsTypography(scope === 'USER' ? 'user-attributes' : 'role-attributes');
}

