import React, { useMemo, useRef } from 'react';
import { Input as HeroInput } from '@heroui/react';
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

export const SEMVER_SEGMENT_MAX_DIGITS = 5;

type SemVerSegment = 'major' | 'minor' | 'patch';

export const parseSemVerSegments = (
  value: string,
  maxDigits = SEMVER_SEGMENT_MAX_DIGITS,
): [string, string, string] => {
  const sanitized = value.trim().replace(/[^\d.]/g, '');
  const [major = '', minor = '', patch = ''] = sanitized.split('.');
  return [
    major.replace(/\D/g, '').slice(0, maxDigits),
    minor.replace(/\D/g, '').slice(0, maxDigits),
    patch.replace(/\D/g, '').slice(0, maxDigits),
  ];
};

export const joinSemVerSegments = (major: string, minor: string, patch: string): string => {
  const nextMajor = major.replace(/\D/g, '');
  const nextMinor = minor.replace(/\D/g, '');
  const nextPatch = patch.replace(/\D/g, '');

  if (!nextMajor && !nextMinor && !nextPatch) return '';
  if (!nextMinor && !nextPatch) return nextMajor;
  if (!nextPatch) return `${nextMajor}.${nextMinor}`;
  return `${nextMajor}.${nextMinor}.${nextPatch}`;
};

export type SemVerInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  size?: HeroUiFieldSize;
  disabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  feedbackPlacement?: FieldFeedbackPlacement;
  ariaLabel?: string;
  className?: string;
  segmentMaxDigits?: number;
};

const sanitizeSegmentDigits = (raw: string, maxDigits: number) =>
  raw.replace(/\D/g, '').slice(0, maxDigits);

export const SemVerInput: React.FC<SemVerInputProps> = ({
  value,
  onChange,
  onBlur,
  size = 'sm',
  disabled = false,
  isInvalid = false,
  errorMessage,
  feedbackPlacement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  ariaLabel = 'Version',
  className = '',
  segmentMaxDigits = SEMVER_SEGMENT_MAX_DIGITS,
}) => {
  const majorRef = useRef<HTMLInputElement>(null);
  const minorRef = useRef<HTMLInputElement>(null);
  const patchRef = useRef<HTMLInputElement>(null);

  const [major, minor, patch] = useMemo(
    () => parseSemVerSegments(value, segmentMaxDigits),
    [segmentMaxDigits, value],
  );

  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const inputClass = `${sizeTokens.controlHeightClass} ${sizeTokens.textClass}`;
  const compositeClass = `${sizeTokens.controlRowHeightClass} items-stretch`;
  const separatorClass = `flex shrink-0 items-center justify-center px-1 font-mono font-semibold text-slate-400 select-none ${sizeTokens.controlRowHeightClass} ${sizeTokens.textClass}`;

  const segmentRefs: Record<SemVerSegment, React.RefObject<HTMLInputElement | null>> = {
    major: majorRef,
    minor: minorRef,
    patch: patchRef,
  };

  const focusSegment = (segment: SemVerSegment) => {
    segmentRefs[segment].current?.focus();
    segmentRefs[segment].current?.select();
  };

  const emitSegments = (nextMajor: string, nextMinor: string, nextPatch: string) => {
    onChange(joinSemVerSegments(nextMajor, nextMinor, nextPatch));
  };

  const handleSegmentChange = (segment: SemVerSegment, raw: string) => {
    const digits = sanitizeSegmentDigits(raw, segmentMaxDigits);
    const [currentMajor, currentMinor, currentPatch] = parseSemVerSegments(value, segmentMaxDigits);

    if (segment === 'major') {
      emitSegments(digits, currentMinor, currentPatch);
      if (digits.length >= segmentMaxDigits) focusSegment('minor');
      return;
    }
    if (segment === 'minor') {
      emitSegments(currentMajor, digits, currentPatch);
      if (digits.length >= segmentMaxDigits) focusSegment('patch');
      return;
    }
    emitSegments(currentMajor, currentMinor, digits);
  };

  const handleSegmentKeyDown = (
    segment: SemVerSegment,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    const currentValue = segment === 'major' ? major : segment === 'minor' ? minor : patch;
    const input = event.currentTarget;
    const caretAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const caretAtEnd = input.selectionStart === currentValue.length && input.selectionEnd === currentValue.length;

    if (event.key === '.' || event.key === 'Decimal') {
      event.preventDefault();
      if (segment === 'major') focusSegment('minor');
      else if (segment === 'minor') focusSegment('patch');
      return;
    }

    if (event.key === 'Backspace' && !currentValue && caretAtStart) {
      event.preventDefault();
      if (segment === 'minor') focusSegment('major');
      else if (segment === 'patch') focusSegment('minor');
      return;
    }

    if (event.key === 'ArrowLeft' && caretAtStart) {
      event.preventDefault();
      if (segment === 'minor') focusSegment('major');
      else if (segment === 'patch') focusSegment('minor');
      return;
    }

    if (event.key === 'ArrowRight' && caretAtEnd) {
      event.preventDefault();
      if (segment === 'major') focusSegment('minor');
      else if (segment === 'minor') focusSegment('patch');
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    if (!pasted.trim()) return;

    const [nextMajor, nextMinor, nextPatch] = parseSemVerSegments(pasted, segmentMaxDigits);
    if (!nextMajor && !nextMinor && !nextPatch) return;

    event.preventDefault();
    emitSegments(nextMajor, nextMinor, nextPatch);
  };

  const renderSegment = (
    segment: SemVerSegment,
    segmentValue: string,
    placeholder: string,
    segmentAriaLabel: string,
  ) => (
    <HeroInput
      ref={segmentRefs[segment]}
      value={segmentValue}
      onChange={(event) => handleSegmentChange(segment, event.target.value)}
      onKeyDown={(event) => handleSegmentKeyDown(segment, event)}
      onPaste={handlePaste}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={segmentAriaLabel}
      inputMode="numeric"
      variant="secondary"
      size={size}
      className={`min-w-0 flex-1 !rounded-none !border-0 !shadow-none tabular-nums ${HERO_UI_FIELD_TEXT_ALIGN_CLASS} ${inputClass} ${HEROUI_FOCUS_CLIP_CLASS} !bg-white hover:!bg-white data-[hover=true]:!bg-white`}
    />
  );

  return (
    <FieldFeedbackShell
      errorMessage={errorMessage}
      isInvalid={isInvalid}
      placement={feedbackPlacement}
    >
      <div
        role="group"
        aria-label={ariaLabel}
        aria-invalid={isInvalid || undefined}
        onBlur={onBlur}
        className={`flex w-full overflow-hidden ${compositeClass} ${resolveHeroUiFieldBorderClass(isInvalid)} ${HEROUI_RADIUS_CLASS} !bg-white ${className}`}
      >
        {renderSegment('major', major, '0', `${ariaLabel} major`)}
        <span aria-hidden className={separatorClass}>.</span>
        {renderSegment('minor', minor, '0', `${ariaLabel} minor`)}
        <span aria-hidden className={separatorClass}>.</span>
        {renderSegment('patch', patch, '0', `${ariaLabel} patch`)}
      </div>
    </FieldFeedbackShell>
  );
};
