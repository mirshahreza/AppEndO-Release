import React, { useMemo } from 'react';
import { I18nProvider, RangeCalendar } from '@heroui/react';
import { cn } from '../../lib/utils';
import {
  formatDesignerDatePickerValue,
  parseDesignerDatePickerValue,
} from '../lib/designerDatePickerConfig';

const HRangeCalendar = RangeCalendar as unknown as React.FC<Record<string, unknown>> & {
  Header: React.FC<Record<string, unknown>>;
  YearPickerTrigger: React.FC<Record<string, unknown>>;
  YearPickerTriggerHeading: React.FC<Record<string, unknown>>;
  YearPickerTriggerIndicator: React.FC<Record<string, unknown>>;
  NavButton: React.FC<Record<string, unknown>>;
  Grid: React.FC<Record<string, unknown>>;
  GridHeader: React.FC<Record<string, unknown>>;
  HeaderCell: React.FC<Record<string, unknown>>;
  GridBody: React.FC<Record<string, unknown>>;
  Cell: React.FC<Record<string, unknown>>;
  YearPickerGrid: React.FC<Record<string, unknown>>;
  YearPickerGridBody: React.FC<Record<string, unknown>>;
  YearPickerCell: React.FC<Record<string, unknown>>;
};

const NAV_BUTTON_CLASS = 'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-40';

export type UiDateRangeValue = {
  start: string;
  end: string;
};

export type UiRangeCalendarProps = {
  value?: UiDateRangeValue;
  defaultValue?: UiDateRangeValue;
  onChange?: (value: UiDateRangeValue) => void;
  isDisabled?: boolean;
  className?: string;
};

const parseRange = (value: UiDateRangeValue | undefined) => {
  const start = parseDesignerDatePickerValue(value?.start, 'day');
  const end = parseDesignerDatePickerValue(value?.end, 'day');
  if (!start || !end) return undefined;
  return { start, end };
};

/** Standalone month grid for picking an inclusive date range. */
export const UiRangeCalendar: React.FC<UiRangeCalendarProps> = ({
  value,
  defaultValue,
  onChange,
  isDisabled,
  className,
}) => {
  const parsedValue = useMemo(() => parseRange(value), [value]);
  const parsedDefault = useMemo(() => parseRange(defaultValue), [defaultValue]);

  return (
    <I18nProvider locale="en-US">
      <HRangeCalendar
        className={cn('w-[16rem] max-w-full rounded-xl border border-slate-200 bg-white p-2.5', className)}
        value={parsedValue}
        defaultValue={parsedDefault}
        isDisabled={isDisabled}
        onChange={(next: unknown) => {
          const range = next as { start?: unknown; end?: unknown } | null;
          onChange?.({
            start: formatDesignerDatePickerValue(range?.start, 'day'),
            end: formatDesignerDatePickerValue(range?.end, 'day'),
          });
        }}
      >
        <HRangeCalendar.Header className="mb-2 flex items-center justify-between gap-1">
          <HRangeCalendar.YearPickerTrigger className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100">
            <HRangeCalendar.YearPickerTriggerHeading />
            <HRangeCalendar.YearPickerTriggerIndicator className="text-slate-500" />
          </HRangeCalendar.YearPickerTrigger>
          <div className="flex items-center gap-0.5">
            <HRangeCalendar.NavButton slot="previous" className={NAV_BUTTON_CLASS} />
            <HRangeCalendar.NavButton slot="next" className={NAV_BUTTON_CLASS} />
          </div>
        </HRangeCalendar.Header>
        <HRangeCalendar.Grid className="w-full border-separate border-spacing-0.5">
          <HRangeCalendar.GridHeader>
            {(day: string) => (
              <HRangeCalendar.HeaderCell className="pb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {day}
              </HRangeCalendar.HeaderCell>
            )}
          </HRangeCalendar.GridHeader>
          <HRangeCalendar.GridBody>
            {(date: unknown) => <HRangeCalendar.Cell date={date} className="size-8 rounded-md text-xs" />}
          </HRangeCalendar.GridBody>
        </HRangeCalendar.Grid>
        <HRangeCalendar.YearPickerGrid>
          <HRangeCalendar.YearPickerGridBody>
            {({ year }: { year: unknown }) => (
              <HRangeCalendar.YearPickerCell year={year} className="rounded-md px-2 py-1 text-sm" />
            )}
          </HRangeCalendar.YearPickerGridBody>
        </HRangeCalendar.YearPickerGrid>
      </HRangeCalendar>
    </I18nProvider>
  );
};
