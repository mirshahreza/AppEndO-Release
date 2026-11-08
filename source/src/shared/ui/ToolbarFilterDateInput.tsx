import * as React from 'react';
import { cn } from '../../lib/utils';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { FIELD_NUMERIC_DATE_INPUT_CENTER_CLASS } from '../lib/fieldNumericDateAlign';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';
import { TOOLBAR_FILTER_DATE_INPUT_HOST_CLASS } from './surfaceClasses';

/** Typography-only overrides — height, radius, and border come from heroFieldChrome via UiInput. */
export const TOOLBAR_FILTER_DATE_INPUT_CLASS =
  'font-medium text-slate-800 placeholder:text-slate-400';

export const TOOLBAR_FILTER_DATE_INPUT_PLACEHOLDER = 'YYYY-MM-DD';

const ISO_DATE_INPUT_MAX_LENGTH = 10;

/** Keep toolbar filter dates typed as Western `YYYY-MM-DD` (no locale date picker). */
export const sanitizeToolbarFilterDateInput = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/[^\d-]/g, '').slice(0, ISO_DATE_INPUT_MAX_LENGTH);
};

export type ToolbarFilterDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Grouped label inside the control border (not above the field). */
  ariaLabel: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
};

export const ToolbarFilterDateInput: React.FC<ToolbarFilterDateInputProps> = ({
  value,
  onChange,
  ariaLabel,
  className,
  inputClassName,
  disabled = false,
}) => (
  <div
    className={cn(TOOLBAR_FILTER_DATE_INPUT_HOST_CLASS, className)}
    {...pageGuideLocalProps(
      ariaLabel,
      PAGE_GUIDE_EN['pageGuide.page.filter.hint'],
      20,
    )}
  >
    <UiInput
      aiAssist={false}
      size="sm"
      type="text"
      inputMode="numeric"
      dir="ltr"
      autoComplete="off"
      placeholder={TOOLBAR_FILTER_DATE_INPUT_PLACEHOLDER}
      ariaLabel={ariaLabel}
      value={value}
      disabled={disabled}
      maxLength={ISO_DATE_INPUT_MAX_LENGTH}
      onChange={(event) => onChange(sanitizeToolbarFilterDateInput(event.target.value))}
      startContent={(
        <span className="whitespace-nowrap text-xs font-semibold text-slate-700">{ariaLabel}</span>
      )}
      startContentClassName="px-2"
      className={cn(
        TOOLBAR_FILTER_DATE_INPUT_CLASS,
        FIELD_NUMERIC_DATE_INPUT_CENTER_CLASS,
        inputClassName,
      )}
    />
  </div>
);
