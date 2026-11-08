import React from 'react';
import { Input as HeroInput } from '@heroui/react';
import { LATIN_SLUG_HELPER_TEXT, sanitizeLatinSlugInput } from '../lib/latinSlug';
import {
  DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  FieldFeedbackShell,
  type FieldFeedbackPlacement,
} from './fieldFeedback';
import { resolveHeroUiFieldBorderClass } from './surfaceClasses';
import {
  HERO_UI_FIELD_TEXT_ALIGN_CLASS,
  type HeroUiFieldSize,
  resolveHeroUiFieldSizeTokens,
} from './heroFieldSize';

const HEROUI_RADIUS_CLASS = '!rounded-[6px]';
const HEROUI_FOCUS_CLIP_CLASS = '!outline-none !ring-0 !ring-offset-0 !shadow-none focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none focus-within:!outline-none focus-within:!ring-0 focus-within:!ring-offset-0 focus-within:!shadow-none data-[focus=true]:!outline-none data-[focus=true]:!ring-0 data-[focus=true]:!ring-offset-0 data-[focus=true]:!shadow-none data-[focus-visible=true]:!outline-none data-[focus-visible=true]:!ring-0 data-[focus-visible=true]:!ring-offset-0 data-[focus-visible=true]:!shadow-none';

export type UrlSegmentSlugInputProps = {
  value: string;
  onChange: (value: string) => void;
  size?: HeroUiFieldSize;
  placeholder?: string;
  disabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  feedbackPlacement?: FieldFeedbackPlacement;
  ariaLabel?: string;
  helperText?: string;
  className?: string;
};

export const UrlSegmentSlugInput: React.FC<UrlSegmentSlugInputProps> = ({
  value,
  onChange,
  size = 'sm',
  placeholder = 'portal',
  disabled = false,
  isInvalid = false,
  errorMessage,
  feedbackPlacement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  ariaLabel = 'URL segment slug',
  helperText = LATIN_SLUG_HELPER_TEXT,
  className = '',
}) => {
  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const inputClass = `${sizeTokens.controlHeightClass} ${sizeTokens.textClass}`;
  const compositeClass = `${sizeTokens.controlRowHeightClass} items-stretch`;

  return (
    <FieldFeedbackShell
      description={helperText}
      errorMessage={errorMessage}
      isInvalid={isInvalid}
      placement={feedbackPlacement}
      className={className}
    >
      <div
        className={`flex w-full overflow-hidden ${compositeClass} ${resolveHeroUiFieldBorderClass(isInvalid)} ${HEROUI_RADIUS_CLASS} !bg-white`}
      >
        <span
          aria-hidden
          className={`flex shrink-0 items-center border-e border-slate-300 bg-slate-50 px-2.5 font-mono text-indigo-700 ${sizeTokens.controlRowHeightClass} ${sizeTokens.textClass}`}
        >
          /
        </span>
        <HeroInput
          value={value}
          onChange={(event) => onChange(sanitizeLatinSlugInput(event.target.value))}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={isInvalid || undefined}
          variant="secondary"
          size={size}
          className={`min-w-0 flex-1 !rounded-none !border-0 !shadow-none ${HERO_UI_FIELD_TEXT_ALIGN_CLASS} ${inputClass} ${HEROUI_FOCUS_CLIP_CLASS} !bg-white hover:!bg-white data-[hover=true]:!bg-white`}
        />
      </div>
    </FieldFeedbackShell>
  );
};
