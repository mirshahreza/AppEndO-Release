import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { UiInput } from '../../shared/ui/ai-field-assist/AiAssistInput';
import { COLOR_PICKER_DEFAULT_HEX } from '../../shared/ui/surfaceClasses';
import { normalizeHexColor } from '../../shared/lib/uiColorUtils';

type UiColorFieldProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  isInvalid?: boolean;
  /** Show a tiny clear control when a color is set (empty = inherit / none). */
  clearable?: boolean;
};

const toPickerColor = (raw: string): string => (
  normalizeHexColor(raw) ?? COLOR_PICKER_DEFAULT_HEX
);

export const UiColorField: React.FC<UiColorFieldProps> = ({
  value,
  onChange,
  className,
  placeholder = '#RRGGBB',
  ariaLabel = 'Color value',
  disabled = false,
  isInvalid = false,
  clearable = false,
}) => {
  const normalized = normalizeHexColor(value);
  const hasValue = Boolean(normalized);
  const pickerColor = toPickerColor(value);

  const clearControl = clearable && hasValue && !disabled ? (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Remove color"
      title="Remove color"
      className="absolute -end-1 -top-1 z-[1] inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:border-rose-200 hover:text-rose-600"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onChange('');
      }}
    >
      <X className="h-2 w-2" strokeWidth={2.5} aria-hidden="true" />
    </button>
  ) : null;

  return (
    <div className={cn('relative', className)}>
      <UiInput
        aiAssist={false}
        autoDir={false}
        type="text"
        size="sm"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        isInvalid={isInvalid}
        onChange={(e) => onChange(e.target.value)}
        ariaLabel={ariaLabel}
        startContent={(
          <label
            className={cn(
              'relative flex size-5 items-center justify-center',
              disabled ? 'cursor-not-allowed' : 'cursor-pointer',
            )}
            title={hasValue ? 'Pick color' : 'No color — pick to set'}
          >
            <span
              className={cn(
                'size-5 rounded-full border',
                hasValue ? 'border-sky-200' : 'border-dashed border-slate-300 bg-slate-50',
              )}
              style={hasValue ? { backgroundColor: normalized! } : undefined}
            />
            <input
              type="color"
              tabIndex={-1}
              value={pickerColor}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
              aria-label="Pick color"
            />
          </label>
        )}
        startContentClassName="border-e-0 px-1.5"
        className="font-semibold text-slate-800"
      />
      {clearControl}
    </div>
  );
};
