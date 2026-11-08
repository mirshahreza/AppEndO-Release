import { cn } from '../../lib/utils';
import {
  HERO_UI_FIELD_TEXT_ALIGN_CLASS,
  HERO_UI_FIELD_VALUE_CLASS,
  type HeroUiFieldSize,
  resolveHeroUiFieldSizeTokens,
} from './heroFieldSize';
import { resolveHeroUiFieldBorderClass } from './surfaceClasses';

/** Canonical 6px control radius — matches `--app-radius-control` in `index.css`. */
export const HEROUI_FIELD_RADIUS_CLASS = '!rounded-[6px]';

/** Strip HeroUI focus rings/shadows so field borders stay the single enclosure cue. */
export const HEROUI_FIELD_FOCUS_CLIP_CLASS =
  '!outline-none !ring-0 !ring-offset-0 !shadow-none focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none focus-within:!outline-none focus-within:!ring-0 focus-within:!ring-offset-0 focus-within:!shadow-none data-[focus=true]:!outline-none data-[focus=true]:!ring-0 data-[focus=true]:!ring-offset-0 data-[focus=true]:!shadow-none data-[focus-visible=true]:!outline-none data-[focus-visible=true]:!ring-0 data-[focus-visible=true]:!ring-offset-0 data-[focus-visible=true]:!shadow-none';

export const HEROUI_FIELD_SURFACE_CLASS =
  '!bg-white hover:!bg-white data-[hover=true]:!bg-white';

/** Shared box model so Input and Select triggers render the same height beside each other. */
export const HEROUI_FIELD_BOX_CLASS = '!box-border !px-2 !py-0';

/** Multiline controls need vertical padding — do not reuse single-line `!py-0`. */
export const HEROUI_TEXTAREA_BOX_CLASS = '!box-border !px-2 !py-1.5';

export type HeroUiFieldChromeOptions = {
  size?: HeroUiFieldSize;
  isInvalid?: boolean;
  nested?: boolean;
  className?: string;
};

/** Visible boundary for UiInput (plain, no adornments). */
export const resolveHeroUiFieldInputClass = ({
  size = 'sm',
  isInvalid,
  nested,
  className,
}: HeroUiFieldChromeOptions = {}): string => {
  const tokens = resolveHeroUiFieldSizeTokens(size);
  return cn(
    'w-full overflow-hidden',
    tokens.controlHeightClass,
    tokens.controlMaxHeightClass,
    tokens.textClass,
    HERO_UI_FIELD_TEXT_ALIGN_CLASS,
    HERO_UI_FIELD_VALUE_CLASS,
    resolveHeroUiFieldBorderClass(isInvalid, { nested }),
    HEROUI_FIELD_RADIUS_CLASS,
    HEROUI_FIELD_BOX_CLASS,
    HEROUI_FIELD_SURFACE_CLASS,
    HEROUI_FIELD_FOCUS_CLIP_CLASS,
    className,
  );
};

/** Visible boundary for UiTextarea (plain, no adornments) — rows drive height, not single-line tokens. */
export const resolveHeroUiFieldTextareaClass = ({
  size = 'sm',
  isInvalid,
  nested,
  className,
}: HeroUiFieldChromeOptions = {}): string => {
  const tokens = resolveHeroUiFieldSizeTokens(size);
  return cn(
    'w-full min-h-0 resize-y',
    tokens.textClass,
    HERO_UI_FIELD_TEXT_ALIGN_CLASS,
    HERO_UI_FIELD_VALUE_CLASS,
    resolveHeroUiFieldBorderClass(isInvalid, { nested }),
    HEROUI_FIELD_RADIUS_CLASS,
    HEROUI_TEXTAREA_BOX_CLASS,
    HEROUI_FIELD_SURFACE_CLASS,
    HEROUI_FIELD_FOCUS_CLIP_CLASS,
    className,
  );
};

/** Visible boundary for UiSelect / UiAutocomplete triggers. */
export const resolveHeroUiFieldSelectTriggerClass = ({
  size = 'sm',
  isInvalid,
  nested,
  className,
}: HeroUiFieldChromeOptions = {}): string => {
  const tokens = resolveHeroUiFieldSizeTokens(size);
  return cn(
    'flex w-full items-center justify-start overflow-hidden whitespace-nowrap',
    tokens.controlHeightClass,
    tokens.controlMaxHeightClass,
    tokens.textClass,
    HERO_UI_FIELD_TEXT_ALIGN_CLASS,
    HERO_UI_FIELD_VALUE_CLASS,
    resolveHeroUiFieldBorderClass(isInvalid, { nested }),
    HEROUI_FIELD_RADIUS_CLASS,
    HEROUI_FIELD_BOX_CLASS,
    HEROUI_FIELD_SURFACE_CLASS,
    'data-[open=true]:!bg-white',
    className,
  );
};

/** Inner value slot for select-style triggers — no extra vertical padding. */
export const resolveHeroUiFieldSelectValueClass = (size: HeroUiFieldSize = 'sm'): string => {
  const tokens = resolveHeroUiFieldSizeTokens(size);
  return cn(
    'min-w-0 flex-1 truncate whitespace-nowrap leading-normal',
    HERO_UI_FIELD_TEXT_ALIGN_CLASS,
    HERO_UI_FIELD_VALUE_CLASS,
    tokens.textClass,
  );
};

/** Native `<select>` fallback (designer dialog host). */
export const resolveHeroUiNativeSelectClass = ({
  size = 'sm',
  isInvalid,
  nested,
  className,
}: HeroUiFieldChromeOptions = {}): string => {
  const tokens = resolveHeroUiFieldSizeTokens(size);
  return cn(
    'w-full text-slate-700 outline-none focus:border-primary-500',
    tokens.nativeSelectHeightClass,
    tokens.controlMaxHeightClass,
    tokens.textClass,
    HERO_UI_FIELD_TEXT_ALIGN_CLASS,
    HERO_UI_FIELD_VALUE_CLASS,
    resolveHeroUiFieldBorderClass(isInvalid, { nested }),
    HEROUI_FIELD_RADIUS_CLASS,
    HEROUI_FIELD_BOX_CLASS,
    HEROUI_FIELD_SURFACE_CLASS,
    isInvalid && 'focus:!border-rose-400',
    className,
  );
};
