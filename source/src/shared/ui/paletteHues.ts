/**
 * Tier 2 (Object / Semantic Palette) — single source of truth for the hue names used to
 * color-code categories/groups/objects, independent of the Tier 1 accent theme.
 * See docs/standards/ui-design-system.md §1/§7.
 *
 * Class strings below are written out in full (not template-interpolated) on purpose —
 * Tailwind's scanner only generates CSS for utility class names it can see literally in
 * source; a `` `border-${hue}-200` `` template would silently produce no CSS for hues that
 * don't already appear as a literal string elsewhere in scanned content.
 */

/** Core 7 — always available, no fixed meaning; pick per content semantics. */
export const APP_OBJECT_PALETTE_HUES = [
  'slate',
  'violet',
  'cyan',
  'indigo',
  'emerald',
  'amber',
  'rose',
] as const;

export type AppObjectPaletteHue = (typeof APP_OBJECT_PALETTE_HUES)[number];

/** Extended hues — already used ad hoc (relation edges, nav color picker); formalize the
 * name list here rather than leaving it as one-off literals in consuming files. */
export const APP_OBJECT_PALETTE_EXTENDED_HUES = ['blue', 'purple', 'teal'] as const;

export type AppObjectPaletteExtendedHue = (typeof APP_OBJECT_PALETTE_EXTENDED_HUES)[number];

/**
 * Soft border/bg/text/hover chip — shared shape behind `buttonSemantics.ts`'s
 * secondary/utility/warning/confirm/destructive-soft intents and similar soft-tone chips
 * elsewhere. One literal Record per hue so Tailwind can see every class name in full.
 */
export const SOFT_TONE_CLASS: Record<AppObjectPaletteHue, string> = {
  slate: 'border border-slate-200 text-slate-600 hover:bg-slate-100',
  violet: 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
  cyan: 'border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
  indigo: 'border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
  emerald: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  amber: 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  rose: 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
};

/** Solid (filled) tone variant — primary/destructive-strength buttons. */
export const SOLID_TONE_CLASS: Record<AppObjectPaletteHue, string> = {
  slate: 'bg-slate-700 hover:bg-slate-800 text-white',
  violet: 'bg-violet-600 hover:bg-violet-700 text-white',
  cyan: 'bg-cyan-600 hover:bg-cyan-700 text-white',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  amber: 'bg-amber-600 hover:bg-amber-700 text-white',
  rose: 'bg-rose-600 hover:bg-rose-700 text-white',
};

/** Small icon accent (`text-{hue}-600`) — nav/section icons, group headers. */
export const ICON_TONE_CLASS: Record<AppObjectPaletteHue, string> = {
  slate: 'text-slate-600',
  violet: 'text-violet-600',
  cyan: 'text-cyan-600',
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
};

/** Title ink on dark hint chrome (`bg-slate-900` tooltips). Core + extended hues. */
export const DARK_TITLE_TONE_CLASS: Record<
  AppObjectPaletteHue | AppObjectPaletteExtendedHue,
  string
> = {
  slate: 'text-slate-200',
  violet: 'text-violet-300',
  cyan: 'text-cyan-300',
  indigo: 'text-indigo-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  blue: 'text-blue-300',
  purple: 'text-purple-300',
  teal: 'text-teal-300',
};
