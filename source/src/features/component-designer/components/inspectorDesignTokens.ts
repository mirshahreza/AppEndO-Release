import type { AppSurfaceBoxTone } from '../../../shared/ui/surfaceClasses';

// Official typography scale (replaces scattered arbitrary pixel sizes).
export const INSPECTOR_TEXT_2XS = 'text-[10px]';   // fine field caption, badge
export const INSPECTOR_TEXT_XS = 'text-[11px]';    // checkbox/chip label, helper text
export const INSPECTOR_TEXT_SM = 'text-xs';         // default field text (12px, HeroUI size=sm)

// Semantic color roles (replaces eight ad-hoc hues).
export type InspectorSemanticTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export const INSPECTOR_TONE_TO_SURFACE_TONE: Record<InspectorSemanticTone, AppSurfaceBoxTone> = {
  neutral: 'slate', primary: 'indigo', success: 'emerald', warning: 'amber', danger: 'rose', info: 'cyan',
};
// Map each Inspector section to one of these six roles (not ad-hoc color):
// data-binding/grid-columns → primary, conditionals/access-control → warning,
// diagnostics/delete → danger, platform-nav/shell → neutral, viz/chart → info, success states → success.
// Drop violet, teal, and sky; remap existing usages to the nearest role above.

// Single radius/padding standard for section/card shells (replaces rounded-md/p-2 vs rounded-lg/p-3 drift).
export const INSPECTOR_SECTION_SHELL_CLASS = 'overflow-hidden rounded-lg border bg-white';
export const INSPECTOR_SECTION_BODY_CLASS = 'p-3';

/**
 * Phase 13 border-stacking principle (studio chrome only):
 * Only the outermost layer of a nested group may have a real `border`.
 * Inner layers distinguish via background (`bg-white` on `bg-slate-50`), spacing/padding,
 * or `NESTED_LAYER_DIVIDER_CLASS` (`ring-1 ring-inset` — see `surfaceClasses.ts`).
 * Re-export for Inspector consumers that already import design tokens.
 */
export { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';
