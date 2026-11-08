import type { CSSProperties } from 'react';
import { harmonizeAccentHex } from '../theme/accentColorUtils';
import { DIALOG_FOOTER_SURFACE_BG_CLASS, type AppSurfaceBoxTone } from './surfaceClasses';

const SURFACE_CHROME_TONE_FOOTER_BG: Record<AppSurfaceBoxTone, string> = {
  slate: DIALOG_FOOTER_SURFACE_BG_CLASS,
  violet: 'bg-violet-100/80',
  cyan: 'bg-cyan-100/80',
  indigo: 'bg-indigo-100/80',
  emerald: 'bg-emerald-100/80',
  amber: 'bg-amber-100/80',
  rose: 'bg-rose-100/80',
};

/** How surface chrome picks its tint — body always stays white/neutral. */
export type SurfaceChromeColorSource = 'accent' | 'tone' | 'custom';

export type SurfaceChromeTokens = {
  shell: string;
  shellStyle?: CSSProperties;
  header: string;
  headerStyle?: CSSProperties;
  headerBand: string;
  headerBandStyle?: CSSProperties;
  footer: string;
  footerStyle?: CSSProperties;
  title: string;
  resizeHandle: string;
  resizeHandleStyle?: CSSProperties;
};

export type SurfaceChromeOptions = {
  colorSource?: SurfaceChromeColorSource;
  tone?: AppSurfaceBoxTone;
  customColorHex?: string;
};

/** Active accent theme — uses CSS vars set by AccentThemeProvider. */
export const SURFACE_CHROME_ACCENT: SurfaceChromeTokens = {
  shell: 'border-[color:var(--app-accent-500)]/24',
  header:
    'border-b border-[color:var(--app-accent-500)]/10 bg-gradient-to-b from-[color:var(--app-accent-muted)]/70 to-[color:var(--app-accent-soft)]',
  headerBand: 'border-b border-[color:var(--app-accent-500)]/10 bg-[color:var(--app-accent-muted)]/45',
  footer: `border-t border-[color:var(--app-accent-500)]/10 ${DIALOG_FOOTER_SURFACE_BG_CLASS}`,
  title: 'text-slate-800',
  resizeHandle: 'text-[color:var(--app-accent-500)]/28',
};

/** Preset tone tints — border + header chrome only. */
export const SURFACE_CHROME_TONE: Record<AppSurfaceBoxTone, SurfaceChromeTokens> = {
  slate: {
    shell: 'border-slate-200/90',
    header: 'border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white',
    headerBand: 'border-b border-slate-100 bg-slate-50/45',
    footer: `border-t border-slate-100 ${SURFACE_CHROME_TONE_FOOTER_BG.slate}`,
    title: 'text-slate-800',
    resizeHandle: 'text-slate-300',
  },
  violet: {
    shell: 'border-violet-200/80',
    header: 'border-b border-violet-100 bg-gradient-to-b from-violet-50/65 to-white',
    headerBand: 'border-b border-violet-100 bg-violet-50/40',
    footer: `border-t border-violet-100 ${SURFACE_CHROME_TONE_FOOTER_BG.violet}`,
    title: 'text-slate-800',
    resizeHandle: 'text-violet-200',
  },
  cyan: {
    shell: 'border-cyan-200/80',
    header: 'border-b border-cyan-100 bg-gradient-to-b from-cyan-50/65 to-white',
    headerBand: 'border-b border-cyan-100 bg-cyan-50/40',
    footer: `border-t border-cyan-100 ${SURFACE_CHROME_TONE_FOOTER_BG.cyan}`,
    title: 'text-slate-800',
    resizeHandle: 'text-cyan-200',
  },
  indigo: {
    shell: 'border-indigo-200/80',
    header: 'border-b border-indigo-100 bg-gradient-to-b from-indigo-50/65 to-white',
    headerBand: 'border-b border-indigo-100 bg-indigo-50/40',
    footer: `border-t border-indigo-100 ${SURFACE_CHROME_TONE_FOOTER_BG.indigo}`,
    title: 'text-slate-800',
    resizeHandle: 'text-indigo-200',
  },
  emerald: {
    shell: 'border-emerald-200/80',
    header: 'border-b border-emerald-100 bg-gradient-to-b from-emerald-50/65 to-white',
    headerBand: 'border-b border-emerald-100 bg-emerald-50/40',
    footer: `border-t border-emerald-100 ${SURFACE_CHROME_TONE_FOOTER_BG.emerald}`,
    title: 'text-slate-800',
    resizeHandle: 'text-emerald-200',
  },
  amber: {
    shell: 'border-amber-200/80',
    header: 'border-b border-amber-100 bg-gradient-to-b from-amber-50/65 to-white',
    headerBand: 'border-b border-amber-100 bg-amber-50/40',
    footer: `border-t border-amber-100 ${SURFACE_CHROME_TONE_FOOTER_BG.amber}`,
    title: 'text-slate-800',
    resizeHandle: 'text-amber-200',
  },
  rose: {
    shell: 'border-rose-200/80',
    header: 'border-b border-rose-100 bg-gradient-to-b from-rose-50/65 to-white',
    headerBand: 'border-b border-rose-100 bg-rose-50/40',
    footer: `border-t border-rose-100 ${SURFACE_CHROME_TONE_FOOTER_BG.rose}`,
    title: 'text-slate-800',
    resizeHandle: 'text-rose-200',
  },
};

/** Build chrome from an arbitrary hex (custom picker or fixed brand color). */
export function resolveSurfaceChromeCustom(hex: string): SurfaceChromeTokens {
  const tokens = harmonizeAccentHex(hex, true);

  return {
    shell: '',
    shellStyle: { borderColor: `rgb(${tokens.rgb} / 0.26)` },
    header: 'border-b',
    headerStyle: {
      borderColor: `rgb(${tokens.rgb} / 0.1)`,
      background: `linear-gradient(180deg, rgb(${tokens.rgb} / 0.06) 0%, rgb(${tokens.rgb} / 0.015) 58%, transparent 100%)`,
    },
    headerBand: 'border-b',
    headerBandStyle: {
      borderColor: `rgb(${tokens.rgb} / 0.08)`,
      backgroundColor: tokens.muted,
    },
    footer: `border-t ${DIALOG_FOOTER_SURFACE_BG_CLASS}`,
    footerStyle: { borderColor: `rgb(${tokens.rgb} / 0.08)` },
    title: 'text-slate-800',
    resizeHandle: '',
    resizeHandleStyle: { color: `rgb(${tokens.rgb} / 0.28)` },
  };
}

export function resolveSurfaceChrome(options: SurfaceChromeOptions = {}): SurfaceChromeTokens {
  const { colorSource = 'accent', tone = 'slate', customColorHex } = options;

  if (colorSource === 'custom' && customColorHex) {
    return resolveSurfaceChromeCustom(customColorHex);
  }

  if (colorSource === 'tone') {
    return SURFACE_CHROME_TONE[tone];
  }

  return SURFACE_CHROME_ACCENT;
}

/** Floating panel shell base — pair with chrome shell border class. */
export const FLOATING_PANEL_SHELL_BASE_CLASS =
  'fixed flex shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl';

/** Dialog / create-edit shell border width when chrome tint is active. */
export const DIALOG_SHELL_CHROME_BORDER_CLASS = 'border-[1.5px]';

/** Floating panel shell border width when chrome tint is active. */
export const FLOATING_PANEL_SHELL_CHROME_BORDER_CLASS = 'border-2';
