import React, { useEffect, useId, useMemo } from 'react';
import { useIMask } from 'react-imask';
import type { FactoryArg } from 'imask';
import { cn } from '../../lib/utils';
import {
  buildDesignerImaskOptions,
  resolveDesignerMaskInputInputMode,
  resolveDesignerMaskInputMaxLength,
  resolveDesignerMaskInputPreview,
  shouldDesignerMaskInputUnmask,
  type DesignerMaskInputConfigProps,
} from '../lib/designerMaskInputConfig';
import { isDesignerPhoneMaskPreset, resolvePhoneContactLinks } from '../lib/phoneContactLinks';
import { PhoneFieldInlineShell } from './PhoneFieldContactActions';
import { resolveHeroUiFieldBorderClass } from './surfaceClasses';
import { type HeroUiFieldSize, resolveHeroUiFieldSizeTokens } from './heroFieldSize';
import {
  DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  FieldFeedbackShell,
  type FieldFeedbackPlacement,
} from './fieldFeedback';

const HEROUI_RADIUS_CLASS = '!rounded-[6px]';
const HEROUI_FOCUS_CLIP_CLASS = '!outline-none !ring-0 !ring-offset-0 !shadow-none focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none focus-within:!outline-none focus-within:!ring-0 focus-within:!ring-offset-0 focus-within:!shadow-none data-[focus=true]:!outline-none data-[focus=true]:!ring-0 data-[focus=true]:!ring-offset-0 data-[focus=true]:!shadow-none data-[focus-visible=true]:!outline-none data-[focus-visible=true]:!ring-0 data-[focus-visible=true]:!ring-offset-0 data-[focus-visible=true]:!shadow-none';

export type DesignerMaskInputFieldProps = DesignerMaskInputConfigProps & {
  label?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  showMaskFormatHint?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  feedbackPlacement?: FieldFeedbackPlacement;
  description?: string;
  className?: string;
  name?: string;
  ariaLabel?: string;
  size?: HeroUiFieldSize;
  readOnly?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLInputElement>;
};

const serializeMaskOptions = (options: FactoryArg): string => JSON.stringify(
  options,
  (_key, value) => (value instanceof RegExp ? value.toString() : value),
);

export const DesignerMaskInputField: React.FC<DesignerMaskInputFieldProps> = ({
  label,
  placeholder,
  value,
  defaultValue,
  onChange,
  showMaskFormatHint = false,
  isDisabled,
  isRequired,
  isInvalid,
  errorMessage,
  feedbackPlacement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  description,
  className,
  name,
  ariaLabel,
  size = 'sm',
  readOnly,
  onBlur,
  onMouseEnter,
  maskKind,
  maskPreset,
  maskPattern,
  maskPlaceholderChar,
  maskLazy,
  maskEager,
  maskOverwrite,
  maskAutofix,
  maskDefinitions,
  maskBlocks,
  maskEnum,
  maskRegExp,
  maskNumberScale,
  maskNumberRadix,
  maskNumberThousandsSeparator,
  maskNumberPadFractionalZeros,
  maskNumberNormalizeZeros,
  maskNumberMin,
  maskNumberMax,
  maskDatePattern,
  maskOptionsJson,
  unmask,
}) => {
  const formatHintId = useId();
  const maskConfig = useMemo(() => ({
    maskKind,
    maskPreset,
    maskPattern,
    maskPlaceholderChar,
    maskLazy,
    maskEager,
    maskOverwrite,
    maskAutofix,
    maskDefinitions,
    maskBlocks,
    maskEnum,
    maskRegExp,
    maskNumberScale,
    maskNumberRadix,
    maskNumberThousandsSeparator,
    maskNumberPadFractionalZeros,
    maskNumberNormalizeZeros,
    maskNumberMin,
    maskNumberMax,
    maskDatePattern,
    maskOptionsJson,
    unmask,
  }), [
    maskKind,
    maskPreset,
    maskPattern,
    maskPlaceholderChar,
    maskLazy,
    maskEager,
    maskOverwrite,
    maskAutofix,
    maskDefinitions,
    maskBlocks,
    maskEnum,
    maskRegExp,
    maskNumberScale,
    maskNumberRadix,
    maskNumberThousandsSeparator,
    maskNumberPadFractionalZeros,
    maskNumberNormalizeZeros,
    maskNumberMin,
    maskNumberMax,
    maskDatePattern,
    maskOptionsJson,
    unmask,
  ]);
  const isControlled = value !== undefined;
  const returnUnmasked = shouldDesignerMaskInputUnmask(maskConfig);
  const maskOptions = useMemo(
    () => buildDesignerImaskOptions(maskConfig) as FactoryArg,
    [maskConfig],
  );
  const maskOptionsSignature = useMemo(
    () => serializeMaskOptions(maskOptions),
    [maskOptions],
  );
  const maskPreview = useMemo(
    () => resolveDesignerMaskInputPreview(maskConfig),
    [maskConfig],
  );
  const maxLength = useMemo(
    () => resolveDesignerMaskInputMaxLength(maskConfig),
    [maskConfig],
  );
  const inputMode = useMemo(
    () => resolveDesignerMaskInputInputMode(maskConfig),
    [maskConfig],
  );
  const fieldBorderClass = resolveHeroUiFieldBorderClass(isInvalid);
  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const controlHeightClass = `${sizeTokens.controlRowHeightClass} ${sizeTokens.controlRowHeightClass.replace(/^h-/, 'min-h-')} ${sizeTokens.textClass}`;
  const resolvedPlaceholder = placeholder?.trim().length
    ? placeholder
    : maskPreview.inputPlaceholder;
  const initialValue = isControlled ? (value ?? '') : (defaultValue ?? '');

  const { ref, maskRef, setValue } = useIMask(maskOptions, {
    defaultValue: initialValue,
    onAccept: (_maskedValue, mask) => {
      const nextValue = returnUnmasked ? mask.unmaskedValue : mask.value;
      onChange?.(nextValue);
    },
  });

  useEffect(() => {
    if (!isControlled || !maskRef.current) {
      return;
    }

    const currentValue = returnUnmasked ? maskRef.current.unmaskedValue : maskRef.current.value;
    if (currentValue === value) {
      return;
    }

    if (returnUnmasked) {
      maskRef.current.unmaskedValue = value ?? '';
    } else {
      setValue(value ?? '');
    }
  }, [isControlled, value, returnUnmasked, setValue, maskRef]);

  useEffect(() => {
    maskRef.current?.updateOptions(maskOptions);
  }, [maskOptions, maskOptionsSignature, maskRef]);

  const submittedValue = isControlled ? (value ?? '') : (maskRef.current
    ? (returnUnmasked ? maskRef.current.unmaskedValue : maskRef.current.value)
    : (defaultValue ?? ''));

  const phoneContactActions = isDesignerPhoneMaskPreset(maskPreset);
  const phoneContactLinks = phoneContactActions ? resolvePhoneContactLinks(submittedValue) : null;
  const maskedInput = (
    <input
      key={maskOptionsSignature}
      ref={ref as React.RefObject<HTMLInputElement>}
      type="text"
      autoComplete="off"
      inputMode={inputMode}
      maxLength={maxLength}
      data-designer-component="form.mask-input"
      data-mask-template={maskPreview.template}
      aria-label={ariaLabel ?? label ?? resolvedPlaceholder ?? 'Masked input'}
      aria-invalid={isInvalid || undefined}
      aria-required={isRequired || undefined}
      aria-describedby={showMaskFormatHint ? formatHintId : undefined}
      placeholder={resolvedPlaceholder}
      disabled={isDisabled}
      readOnly={readOnly}
      onBlur={onBlur}
      onMouseEnter={onMouseEnter}
      className={cn(
        'w-full px-2 tabular-nums font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 !bg-white hover:!bg-white',
        phoneContactLinks ? 'border-0 shadow-none' : fieldBorderClass,
        phoneContactLinks ? 'rounded-none' : HEROUI_RADIUS_CLASS,
        HEROUI_FOCUS_CLIP_CLASS,
        controlHeightClass,
        isDisabled ? 'cursor-not-allowed opacity-60' : '',
        readOnly ? 'opacity-80' : '',
      )}
    />
  );

  return (
    <div className={cn('flex w-full min-w-[220px] flex-col gap-[2px]', className)}>
      {label ? (
        <label className="ps-[4px] text-sm font-normal text-slate-600">
          {label}
          {isRequired ? <span className="text-rose-600"> *</span> : null}
        </label>
      ) : null}
      <FieldFeedbackShell
        description={description}
        errorMessage={errorMessage}
        isInvalid={isInvalid}
        placement={feedbackPlacement}
      >
        {name ? <input type="hidden" name={name} value={submittedValue} readOnly={isDisabled} /> : null}
        {phoneContactLinks ? (
          <PhoneFieldInlineShell
            phone={submittedValue}
            shellClassName={cn(fieldBorderClass, HEROUI_RADIUS_CLASS, controlHeightClass)}
          >
            {maskedInput}
          </PhoneFieldInlineShell>
        ) : (
          maskedInput
        )}
      </FieldFeedbackShell>
      {showMaskFormatHint ? (
        <div
          id={formatHintId}
          className="mt-[2px] flex flex-col gap-[2px] ps-[4px] text-[11px] leading-snug text-slate-500"
        >
          <p>
            Format:
            {' '}
            <span className="font-mono text-slate-700">{maskPreview.template}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
};
