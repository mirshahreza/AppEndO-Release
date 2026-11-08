/**
 * Codec helpers for Typography / Appearance Tailwind utilities used by the
 * visual Style panel (T1-11d).
 *
 * Spec: docs/refactor-spec/03-inspector-redesign-spec.md §3.4–3.5
 *
 * Simple one-token fields (text size, weight, align, rounded, shadow) reuse
 * `applyResponsiveTailwindUtility` / `resolveResponsiveTailwindUtilityValue`.
 * Opacity needs percent ↔ `opacity-N` mapping for the slider UI.
 */

import {
  applyResponsiveTailwindUtility,
  resolveResponsiveTailwindUtilityValue,
} from './tailwindClasses';
import {
  TAILWIND_INSPECTOR_FIELDS,
  type TailwindInspectorField,
} from './inspectorRegistry';

export type BreakpointPrefix = '' | 'md:' | 'lg:';

/** Tailwind default opacity scale keys used by designer utilities. */
export const TAILWIND_OPACITY_SCALE = [
  0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100,
] as const;

export type TailwindOpacityScaleValue = (typeof TAILWIND_OPACITY_SCALE)[number];

const OPACITY_TOKEN_PATTERN =
  /^(?:(?<prefix>[a-z0-9-]+:))?opacity-(?<value>0|5|10|20|25|30|40|50|60|70|75|80|90|95|100)$/;

export const snapToTailwindOpacityScale = (raw: number): TailwindOpacityScaleValue => {
  let best: TailwindOpacityScaleValue = TAILWIND_OPACITY_SCALE[0];
  let bestDistance = Math.abs(raw - best);
  for (const candidate of TAILWIND_OPACITY_SCALE) {
    const distance = Math.abs(raw - candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
};

export const parseOpacityClassName = (
  className: string,
  prefix: BreakpointPrefix = '',
): number | null => {
  for (const token of className.trim().split(/\s+/).filter(Boolean)) {
    const match = OPACITY_TOKEN_PATTERN.exec(token);
    if (!match?.groups) {
      continue;
    }
    const tokenPrefix = match.groups.prefix ?? '';
    if (prefix) {
      if (tokenPrefix !== prefix) {
        continue;
      }
    } else if (tokenPrefix.includes(':')) {
      continue;
    }
    const value = Number(match.groups.value);
    return Number.isFinite(value) ? value : null;
  }
  return null;
};

export const encodeOpacityClassName = (
  percent: number | null,
  prefix: BreakpointPrefix = '',
): string => {
  if (percent === null) {
    return '';
  }
  const snapped = snapToTailwindOpacityScale(percent);
  const utility = `opacity-${snapped}`;
  return prefix ? `${prefix}${utility}` : utility;
};

export const roundTripOpacityClassName = (opacityClassName: string): string =>
  encodeOpacityClassName(parseOpacityClassName(opacityClassName));

const styleField = (key: string): TailwindInspectorField => {
  const field = TAILWIND_INSPECTOR_FIELDS.find((entry) => entry.key === key);
  if (!field) {
    throw new Error(`Missing Tailwind inspector field: ${key}`);
  }
  return field;
};

export const TEXT_SIZE_FIELD = styleField('twTextSize');
export const FONT_WEIGHT_FIELD = styleField('twFontWeight');
export const TEXT_ALIGN_FIELD = styleField('twTextAlign');
export const ROUNDED_FIELD = styleField('twRounded');
export const SHADOW_FIELD = styleField('twShadow');
export const OPACITY_FIELD = styleField('twOpacity');

/** Preset rounded values shown as visual buttons (excludes empty / custom). */
export const ROUNDED_PRESETS = [
  { value: 'rounded-none', label: 'None', previewClass: 'rounded-none' },
  { value: 'rounded-sm', label: 'SM', previewClass: 'rounded-sm' },
  { value: 'rounded-md', label: 'MD', previewClass: 'rounded-md' },
  { value: 'rounded-lg', label: 'LG', previewClass: 'rounded-lg' },
  { value: 'rounded-xl', label: 'XL', previewClass: 'rounded-xl' },
  { value: 'rounded-full', label: 'Full', previewClass: 'rounded-full' },
] as const;

export const isRoundedPreset = (value: string): boolean =>
  ROUNDED_PRESETS.some((preset) => preset.value === value);

/** Preset shadow values shown as visual buttons (excludes empty / custom). */
export const SHADOW_PRESETS = [
  { value: 'shadow-none', label: 'None', previewClass: 'shadow-none' },
  { value: 'shadow-sm', label: 'SM', previewClass: 'shadow-sm' },
  { value: 'shadow-md', label: 'MD', previewClass: 'shadow-md' },
  { value: 'shadow-lg', label: 'LG', previewClass: 'shadow-lg' },
  { value: 'shadow-xl', label: 'XL', previewClass: 'shadow-xl' },
  { value: 'shadow-2xl', label: '2XL', previewClass: 'shadow-2xl' },
] as const;

export const isShadowPreset = (value: string): boolean =>
  SHADOW_PRESETS.some((preset) => preset.value === value);

/** Font-weight buttons shown with live type preview. */
export const FONT_WEIGHT_PRESETS = [
  { value: 'font-normal', label: 'Regular', previewClass: 'font-normal' },
  { value: 'font-medium', label: 'Medium', previewClass: 'font-medium' },
  { value: 'font-semibold', label: 'Semi', previewClass: 'font-semibold' },
  { value: 'font-bold', label: 'Bold', previewClass: 'font-bold' },
] as const;

/** Text-align utilities with logical RTL mirroring of icons only (values stay physical). */
export const TEXT_ALIGN_PRESETS = [
  { value: 'text-left', label: 'Align left', mirrorInRtl: true },
  { value: 'text-center', label: 'Align center', mirrorInRtl: false },
  { value: 'text-right', label: 'Align right', mirrorInRtl: true },
  { value: 'text-justify', label: 'Justify', mirrorInRtl: false },
] as const;

/**
 * Round-trip a single-token Tailwind utility via the shared responsive helpers.
 * Empty string means "(none)" / cleared utility.
 */
export const roundTripStyleUtility = (
  utility: string,
  field: TailwindInspectorField,
  prefix: BreakpointPrefix = '',
): string => {
  const applied = applyResponsiveTailwindUtility('', field, utility, prefix);
  return resolveResponsiveTailwindUtilityValue(applied, field, prefix).replace(/^(?:md:|lg:)/, '');
};
