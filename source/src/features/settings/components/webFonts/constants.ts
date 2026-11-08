import type { WebFontScript } from '../../../../shared/api/contracts/platform/webFonts';
import { RTL_SCRIPT_PREVIEW_AR, RTL_SCRIPT_PREVIEW_FA } from '../../../../shared/lib/rtlScriptPreviewSamples';

export const WEB_FONT_PREVIEW_SAMPLES = [
  {
    lang: 'en',
    dir: 'ltr' as const,
    text: 'The quick brown fox jumps over the lazy dog.',
  },
  {
    lang: 'fa',
    dir: 'rtl' as const,
    text: RTL_SCRIPT_PREVIEW_FA,
  },
  {
    lang: 'ar',
    dir: 'rtl' as const,
    text: RTL_SCRIPT_PREVIEW_AR,
  },
] as const satisfies ReadonlyArray<{
  lang: 'en' | 'fa' | 'ar';
  dir: 'ltr' | 'rtl';
  text: string;
}>;

export const WEB_FONT_PREVIEW_SIZES = [8, 10, 11, 12, 14, 16, 18] as const;

export type WebFontPreviewSize = typeof WEB_FONT_PREVIEW_SIZES[number];

export const WEB_FONT_PREVIEW_SIZE_OPTIONS = WEB_FONT_PREVIEW_SIZES.map((value) => ({
  value,
  label: String(value),
})) satisfies ReadonlyArray<{ value: WebFontPreviewSize; label: string }>;

export const WEB_FONT_PREVIEW_SIZE_CLASS: Record<WebFontPreviewSize, string> = {
  8: 'text-[8px]',
  10: 'text-[10px]',
  11: 'text-[11px]',
  12: 'text-[12px]',
  14: 'text-[14px]',
  16: 'text-[16px]',
  18: 'text-[18px]',
};

/** Fixed preview row height — text size changes must not resize the box. */
export const WEB_FONT_PREVIEW_BOX_CLASS =
  'flex h-12 shrink-0 items-center overflow-hidden whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-3 leading-none';

export const WEB_FONT_PREVIEW_SIZE_TOOLBAR_BUTTON_CLASS =
  'inline-flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border px-1.5 tabular-nums transition-colors';

export const WEB_FONT_SCRIPT_OPTIONS = [
  { value: 'en', label: 'EN' },
  { value: 'fa', label: 'FA' },
  { value: 'ar', label: 'AR' },
] as const satisfies ReadonlyArray<{ value: WebFontScript; label: string }>;

export type WebFontScriptFilter = 'all' | WebFontScript;

export const WEB_FONT_SCRIPT_FILTER_OPTIONS = [
  { value: 'all', label: 'All languages' },
  { value: 'en', label: 'English (EN)' },
  { value: 'fa', label: 'Persian (FA)' },
  { value: 'ar', label: 'Arabic (AR)' },
] as const satisfies ReadonlyArray<{ value: WebFontScriptFilter; label: string }>;
