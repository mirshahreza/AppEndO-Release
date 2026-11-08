import { cn } from '../../lib/utils';
import { SOFT_TONE_CLASS, SOLID_TONE_CLASS } from './paletteHues';

/** Semantic intent for labeled/text buttons across admin UI. */
export type ButtonIntent =
  | 'primary'
  | 'create'
  | 'cancel'
  | 'destructive'
  | 'destructive-soft'
  | 'confirm'
  | 'secondary'
  | 'utility'
  | 'warning'
  | 'toggle-on'
  | 'toggle-off';

export const BUTTON_SM_BASE_CLASS =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 [@media(pointer:coarse)]:min-h-11';

export const BUTTON_ICON_SM_BASE_CLASS =
  'inline-flex h-7 w-7 min-h-7 items-center justify-center rounded-md text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

export const BUTTON_ICON_MD_BASE_CLASS =
  'inline-flex h-8 w-8 min-h-8 items-center justify-center rounded-md text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

export type ButtonSize = 'sm' | 'icon-sm' | 'icon-md';

export const BUTTON_INTENT_CLASS: Record<ButtonIntent, string> = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white',
  create: 'bg-primary-600 hover:bg-primary-700 text-white',
  cancel: SOFT_TONE_CLASS.slate,
  destructive: SOLID_TONE_CLASS.rose,
  'destructive-soft': SOFT_TONE_CLASS.rose,
  confirm: SOFT_TONE_CLASS.emerald,
  secondary: SOFT_TONE_CLASS.indigo,
  utility: SOFT_TONE_CLASS.cyan,
  warning: SOFT_TONE_CLASS.amber,
  'toggle-on': SOFT_TONE_CLASS.cyan,
  'toggle-off': SOFT_TONE_CLASS.indigo,
};

function getButtonBaseClassName(size: ButtonSize): string {
  if (size === 'icon-sm') return BUTTON_ICON_SM_BASE_CLASS;
  if (size === 'icon-md') return BUTTON_ICON_MD_BASE_CLASS;
  return BUTTON_SM_BASE_CLASS;
}

export function getButtonIntentClassName(
  intent: ButtonIntent,
  className?: string,
  size: ButtonSize = 'sm',
): string {
  return cn(getButtonBaseClassName(size), BUTTON_INTENT_CLASS[intent], className);
}
