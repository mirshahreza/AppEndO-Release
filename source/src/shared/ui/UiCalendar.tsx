import React, { useMemo } from 'react';
import { Calendar, I18nProvider } from '@heroui/react';
import { cn } from '../../lib/utils';
import {
  formatDesignerDatePickerValue,
  parseDesignerDatePickerValue,
} from '../lib/designerDatePickerConfig';

const HCalendar = Calendar as unknown as React.FC<Record<string, unknown>> & {
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

export type UiCalendarProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  isDisabled?: boolean;
  className?: string;
};

/** Standalone month grid — same HeroUI `Calendar` chrome as the date-picker popover. */
export const UiCalendar: React.FC<UiCalendarProps> = ({
  value,
  defaultValue,
  onChange,
  isDisabled,
  className,
}) => {
  const parsedValue = useMemo(() => parseDesignerDatePickerValue(value, 'day'), [value]);
  const parsedDefault = useMemo(() => parseDesignerDatePickerValue(defaultValue, 'day'), [defaultValue]);

  return (
    <I18nProvider locale="en-US">
      <HCalendar
        className={cn('w-[16rem] max-w-full rounded-xl border border-slate-200 bg-white p-2.5', className)}
        value={parsedValue}
        defaultValue={parsedDefault}
        isDisabled={isDisabled}
        onChange={(next: unknown) => {
          onChange?.(formatDesignerDatePickerValue(next, 'day'));
        }}
      >
        <HCalendar.Header className="mb-2 flex items-center justify-between gap-1">
          <HCalendar.YearPickerTrigger className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100">
            <HCalendar.YearPickerTriggerHeading />
            <HCalendar.YearPickerTriggerIndicator className="text-slate-500" />
          </HCalendar.YearPickerTrigger>
          <div className="flex items-center gap-0.5">
            <HCalendar.NavButton slot="previous" className={NAV_BUTTON_CLASS} />
            <HCalendar.NavButton slot="next" className={NAV_BUTTON_CLASS} />
          </div>
        </HCalendar.Header>
        <HCalendar.Grid className="w-full border-separate border-spacing-0.5">
          <HCalendar.GridHeader>
            {(day: string) => (
              <HCalendar.HeaderCell className="pb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {day}
              </HCalendar.HeaderCell>
            )}
          </HCalendar.GridHeader>
          <HCalendar.GridBody>
            {(date: unknown) => <HCalendar.Cell date={date} className="size-8 rounded-md text-xs" />}
          </HCalendar.GridBody>
        </HCalendar.Grid>
        <HCalendar.YearPickerGrid>
          <HCalendar.YearPickerGridBody>
            {({ year }: { year: unknown }) => (
              <HCalendar.YearPickerCell year={year} className="rounded-md px-2 py-1 text-sm" />
            )}
          </HCalendar.YearPickerGridBody>
        </HCalendar.YearPickerGrid>
      </HCalendar>
    </I18nProvider>
  );
};
