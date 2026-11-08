import * as React from 'react';
import { DateRangePicker } from '@heroui/react';
import { parseDate } from '@internationalized/date';
import { formatDesignerDatePickerValue, parseDesignerDatePickerValue } from '../../shared/lib/designerDatePickerConfig';
import {
  computeDesignerDateRangePreset,
  parseDesignerDateRangePresets,
  type DesignerDateRangePresetFn,
} from './dateRangePresetsEngine';
import { readString } from './runtimeShared';

const HDateRangePicker = DateRangePicker as unknown as React.FC<Record<string, unknown>> & {
  Trigger: React.FC<Record<string, unknown>>;
  RangeSeparator: React.FC<Record<string, unknown>>;
  TriggerIndicator: React.FC<Record<string, unknown>>;
  Popover: React.FC<Record<string, unknown>>;
};

export type DesignerDateRangeFieldProps = {
  label?: string;
  startValue?: string;
  endValue?: string;
  presetsJson?: string;
  timeZone?: string;
  granularity?: string;
  minValue?: string;
  maxValue?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  triggerClassName?: string;
  className?: string;
  onChange?: (startIso: string, endIso: string) => void;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
};

const buildRangeValue = (
  startIso: string,
  endIso: string,
  granularity: string,
): { start: unknown; end: unknown } | undefined => {
  const start = parseDesignerDatePickerValue(startIso, granularity);
  const end = parseDesignerDatePickerValue(endIso, granularity);
  if (!start || !end) {
    return undefined;
  }
  return { start, end };
};

export const DesignerDateRangeField: React.FC<DesignerDateRangeFieldProps> = ({
  label,
  startValue = '',
  endValue = '',
  presetsJson,
  timeZone,
  granularity = 'day',
  minValue,
  maxValue,
  isDisabled,
  isRequired,
  isReadOnly,
  isInvalid,
  errorMessage,
  triggerClassName,
  className,
  onChange,
  onBlur,
}) => {
  const presets = React.useMemo(() => parseDesignerDateRangePresets(presetsJson), [presetsJson]);
  const initialRange = React.useMemo(
    () => buildRangeValue(startValue, endValue, granularity),
    [startValue, endValue, granularity],
  );
  const [rangeValue, setRangeValue] = React.useState(initialRange);
  const [rangeKey, setRangeKey] = React.useState(0);

  React.useEffect(() => {
    setRangeValue(initialRange);
    setRangeKey((key) => key + 1);
  }, [initialRange]);

  const minParsed = minValue?.trim()
    ? parseDesignerDatePickerValue(minValue, granularity)
    : undefined;
  const maxParsed = maxValue?.trim()
    ? parseDesignerDatePickerValue(maxValue, granularity)
    : undefined;

  const commitRange = (range: { start: unknown; end: unknown } | null | undefined): void => {
    if (!range) {
      setRangeValue(undefined);
      onChange?.('', '');
      return;
    }
    const startIso = formatDesignerDatePickerValue(range.start, granularity);
    const endIso = formatDesignerDatePickerValue(range.end, granularity);
    setRangeValue(range);
    onChange?.(startIso, endIso);
  };

  const applyPreset = (rangeFn: DesignerDateRangePresetFn): void => {
    const computed = computeDesignerDateRangePreset(rangeFn);
    if (!computed) {
      return;
    }
    const nextRange = {
      start: parseDate(computed.start),
      end: parseDate(computed.end),
    };
    setRangeValue(nextRange);
    setRangeKey((key) => key + 1);
    onChange?.(computed.start, computed.end);
  };

  return (
    <div
      className={`flex w-full flex-col gap-[2px] ${className ?? ''}`}
      onBlur={onBlur}
      data-designer-date-range-presets={presets.length > 0 ? 'true' : undefined}
    >
      {label ? <span className="ps-[4px] text-sm text-slate-700">{label}</span> : null}
      {presets.length > 0 ? (
        <div className="mb-1 flex flex-wrap gap-1" data-designer-date-range-preset-bar="true">
          {presets.map((preset) => (
            <button
              key={`${preset.rangeFn}-${preset.label}`}
              type="button"
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              disabled={isDisabled}
              data-designer-date-range-preset={preset.rangeFn}
              onClick={() => applyPreset(preset.rangeFn)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
      <HDateRangePicker
        key={rangeKey}
        defaultValue={rangeValue}
        granularity={granularity === 'hour' || granularity === 'minute' || granularity === 'second' ? granularity : 'day'}
        isDisabled={isDisabled}
        isRequired={isRequired}
        isReadOnly={isReadOnly}
        isInvalid={isInvalid || undefined}
        aria-invalid={isInvalid || undefined}
        {...(minParsed ? { minValue: minParsed } : {})}
        {...(maxParsed ? { maxValue: maxParsed } : {})}
        {...(readString(timeZone) ? { timeZone: readString(timeZone) } : {})}
        className="w-full"
        onChange={(range: { start: unknown; end: unknown } | null) => {
          commitRange(range);
        }}
      >
        <HDateRangePicker.Trigger className={triggerClassName}>
          Select date range
          <HDateRangePicker.RangeSeparator>–</HDateRangePicker.RangeSeparator>
          <HDateRangePicker.TriggerIndicator />
        </HDateRangePicker.Trigger>
        <HDateRangePicker.Popover>
          <div className="p-3 text-sm text-slate-600">Select a start and end date</div>
        </HDateRangePicker.Popover>
      </HDateRangePicker>
      {isInvalid && errorMessage ? (
        <p className="ps-[4px] text-xs text-rose-600" data-designer-field-error="true">{errorMessage}</p>
      ) : null}
    </div>
  );
};
