import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { Calendar, DateField, DatePicker, I18nProvider, Label, TimeField } from '@heroui/react';
import { CalendarDays } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { EuaAssistSurface } from '../api/contracts/ai/euaFieldAssist';
import { UiColorField } from '../../components/ui/UiColorField';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { useAiAssistGate } from './ai-field-assist/useAiAssistGate';
import { useMonacoAiAutocomplete } from './ai-field-assist/useMonacoAiAutocomplete';
import type { MonacoApiLike, MonacoEditorLike } from './ai-field-assist/monacoEditorAssist';
import { resolveHeroUiFieldBorderClass } from './surfaceClasses';
import { type HeroUiFieldSize, resolveHeroUiFieldSizeTokens } from './heroFieldSize';
import {
  applyMonacoEditorLtrDom,
  composeMonacoOnMount,
  MONACO_EDITOR_LTR_SHELL_CLASS,
} from './monacoEditorLtr';
import {
  formatDesignerDatePickerValue,
  normalizeDesignerDatePickerCalendarSystem,
  normalizeDesignerDatePickerGranularity,
  normalizeDesignerDatePickerHourCycle,
  parseDesignerDatePickerValue,
  resolveDatePickerI18nLocale,
  type DesignerDatePickerCalendarSystem,
  type DesignerDatePickerFirstDayOfWeek,
  type DesignerDatePickerGranularity,
  type DesignerDatePickerHourCycle,
} from '../lib/designerDatePickerConfig';

const Editor = lazy(() => import('@monaco-editor/react'));

export const DESIGNER_MONACO_LINE_HEIGHT = 18;
export const DESIGNER_CODE_EDITOR_DEFAULT_LINES = 8;

const DEFAULT_CODE_EDITOR_HEIGHT = (DESIGNER_MONACO_LINE_HEIGHT * DESIGNER_CODE_EDITOR_DEFAULT_LINES) + 12;

const HEROUI_RADIUS_CLASS = '!rounded-[6px]';
const HEROUI_FOCUS_CLIP_CLASS = '!outline-none !ring-0 !ring-offset-0 !shadow-none focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none focus-within:!outline-none focus-within:!ring-0 focus-within:!ring-offset-0 focus-within:!shadow-none data-[focus=true]:!outline-none data-[focus=true]:!ring-0 data-[focus=true]:!ring-offset-0 data-[focus=true]:!shadow-none data-[focus-visible=true]:!outline-none data-[focus-visible=true]:!ring-0 data-[focus-visible=true]:!ring-offset-0 data-[focus-visible=true]:!shadow-none';

const DESIGNER_DATE_PICKER_NAV_BUTTON_CLASS = 'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-40';
const DESIGNER_DATE_PICKER_POPOVER_CLASS = 'w-fit max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-lg';
const DESIGNER_DATE_PICKER_SEGMENT_CLASS = 'rounded px-0.5 tabular-nums text-slate-800 outline-none focus:bg-indigo-50 focus:text-indigo-700 data-[placeholder=true]:text-slate-400';
const DESIGNER_DATE_PICKER_TIME_GROUP_CLASS = 'inline-flex min-w-[7.5rem] items-center rounded-[6px] border border-slate-300 bg-white px-2 py-1 tabular-nums';
const DESIGNER_DATE_PICKER_CALENDAR_WIDTH_CLASS = 'w-[16rem] max-w-full';

const resolveDesignerDatePickerTextDirection = (
  calendarSystem: DesignerDatePickerCalendarSystem,
  locale?: string,
): 'ltr' | 'rtl' | undefined => {
  const normalizedLocale = locale?.trim().toLowerCase() ?? '';
  if (calendarSystem === 'jalali' || calendarSystem === 'hijri') {
    return 'rtl';
  }
  if (normalizedLocale.startsWith('fa') || normalizedLocale.startsWith('ar') || normalizedLocale.startsWith('he')) {
    return 'rtl';
  }
  return undefined;
};

const HDatePicker = DatePicker as unknown as React.FC<Record<string, unknown>> & {
  Trigger: React.FC<Record<string, unknown>>;
  TriggerIndicator: React.FC<Record<string, unknown>>;
  Popover: React.FC<Record<string, unknown>>;
};
const HDateField = DateField as unknown as React.FC<Record<string, unknown>> & {
  Group: React.FC<Record<string, unknown>>;
  Input: React.FC<Record<string, unknown>>;
  Segment: React.FC<Record<string, unknown>>;
  Suffix: React.FC<Record<string, unknown>>;
};
const HTimeField = TimeField as unknown as React.FC<Record<string, unknown>> & {
  Group: React.FC<Record<string, unknown>>;
  Input: React.FC<Record<string, unknown>>;
  Segment: React.FC<Record<string, unknown>>;
};
const HCalendar = Calendar as unknown as React.FC<Record<string, unknown>> & {
  Header: React.FC<Record<string, unknown>>;
  Heading: React.FC<Record<string, unknown>>;
  NavButton: React.FC<Record<string, unknown>>;
  Grid: React.FC<Record<string, unknown>>;
  GridHeader: React.FC<Record<string, unknown>>;
  HeaderCell: React.FC<Record<string, unknown>>;
  GridBody: React.FC<Record<string, unknown>>;
  Cell: React.FC<Record<string, unknown>>;
  YearPickerTrigger: React.FC<Record<string, unknown>>;
  YearPickerTriggerHeading: React.FC<Record<string, unknown>>;
  YearPickerTriggerIndicator: React.FC<Record<string, unknown>>;
  YearPickerGrid: React.FC<Record<string, unknown>>;
  YearPickerGridBody: React.FC<Record<string, unknown>>;
  YearPickerCell: React.FC<Record<string, unknown>>;
};
const HLabel = Label as unknown as React.FC<Record<string, unknown>>;

type SharedFieldShellProps = {
  label?: string;
  description?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  className?: string;
  children: React.ReactNode;
};

const FieldShell: React.FC<SharedFieldShellProps> = ({
  label,
  description,
  isRequired,
  isInvalid,
  errorMessage,
  className,
  children,
}) => (
  <div className={cn('flex w-full min-w-[220px] flex-col gap-[2px]', className)}>
    {label ? (
      <label className="ps-[4px] text-sm font-medium text-slate-700">
        {label}
        {isRequired ? <span className="text-rose-600"> *</span> : null}
      </label>
    ) : null}
    {children}
    {description ? <p className="ps-[4px] text-xs text-slate-500">{description}</p> : null}
    {isInvalid && errorMessage ? <p className="ps-[4px] text-xs text-rose-600">{errorMessage}</p> : null}
  </div>
);

const setupDesignerMonacoFieldOnMount: OnMount = composeMonacoOnMount(applyMonacoEditorLtrDom);

const resolveEditorHeightPx = (rawHeight: unknown, fallback: number): string => {
  if (typeof rawHeight === 'number' && Number.isFinite(rawHeight) && rawHeight > 0) {
    return `${rawHeight}px`;
  }
  if (typeof rawHeight === 'string' && rawHeight.trim().length > 0) {
    const trimmed = rawHeight.trim();
    if (/^\d+$/.test(trimmed)) {
      return `${trimmed}px`;
    }
    return trimmed;
  }
  return `${fallback}px`;
};

const resolveEditorLinesHeight = (lineCount: number): string =>
  `${(DESIGNER_MONACO_LINE_HEIGHT * lineCount) + 12}px`;

type DesignerMonacoFieldProps = {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  language?: string;
  theme?: string;
  editorHeight?: string | number;
  lineNumbers?: boolean;
  wordWrap?: boolean;
  readOnly?: boolean;
  minimap?: boolean;
  tabSize?: number;
  fontSize?: number;
  placeholder?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  description?: string;
  className?: string;
  name?: string;
  ariaLabel?: string;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  aiAssist?: boolean;
  aiAssistSurface?: EuaAssistSurface;
  fieldLabel?: string;
};

const DesignerMonacoField: React.FC<DesignerMonacoFieldProps> = ({
  label,
  value,
  defaultValue,
  onChange,
  language = 'typescript',
  theme = 'vs',
  editorHeight,
  lineNumbers = false,
  wordWrap = true,
  readOnly = false,
  minimap = false,
  tabSize = 2,
  fontSize = 13,
  placeholder,
  isDisabled = false,
  isRequired,
  isInvalid,
  errorMessage,
  description,
  className,
  name,
  ariaLabel,
  onBlur,
  onMouseEnter,
  aiAssist = true,
  aiAssistSurface = 'admin',
  fieldLabel,
}) => {
  const initialValue = value ?? defaultValue ?? '';
  const [draft, setDraft] = React.useState(initialValue);
  const [monacoEditor, setMonacoEditor] = useState<MonacoEditorLike | null>(null);
  const [monacoApi, setMonacoApi] = useState<MonacoApiLike | null>(null);
  const height = resolveEditorHeightPx(editorHeight, DEFAULT_CODE_EDITOR_HEIGHT);
  const isReadOnly = readOnly || isDisabled;
  const assistGate = useAiAssistGate({
    aiAssist,
    isControlDisabled: isReadOnly,
  });
  const resolvedFieldLabel = fieldLabel ?? ariaLabel ?? label ?? `${language} code`;

  React.useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  const handleChange = (nextValue: string | undefined) => {
    const normalized = nextValue ?? '';
    setDraft(normalized);
    onChange?.(normalized);
  };

  useMonacoAiAutocomplete({
    enabled: assistGate.shouldAutocomplete,
    editor: monacoEditor,
    monaco: monacoApi,
    fieldLabel: resolvedFieldLabel,
    modelId: assistGate.defaultModelId,
    surface: aiAssistSurface,
    onAccept: (nextValue) => handleChange(nextValue),
  });

  const handleMount = useCallback<OnMount>((editor, monaco) => {
    setupDesignerMonacoFieldOnMount(editor, monaco);
    setMonacoEditor(editor as unknown as MonacoEditorLike);
    setMonacoApi(monaco as unknown as MonacoApiLike);
  }, []);

  return (
    <FieldShell
      label={label}
      description={description}
      isRequired={isRequired}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      className={className}
    >
      {name ? <input type="hidden" name={name} value={draft} readOnly={isReadOnly} /> : null}
      <div
        dir="ltr"
        lang="en"
        className={cn(
          'relative w-full min-h-[84px] overflow-hidden rounded-md border border-slate-300 bg-white p-[2px]',
          MONACO_EDITOR_LTR_SHELL_CLASS,
          isInvalid ? 'border-rose-400' : '',
          isDisabled ? 'opacity-60' : '',
        )}
        aria-label={ariaLabel || label || 'Code editor'}
        onBlur={onBlur}
        onMouseEnter={onMouseEnter}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {draft.length === 0 && placeholder ? (
          <p className="pointer-events-none absolute inset-inline-start-0 top-0 z-10 px-3 py-2 text-left text-xs text-default-400">
            {placeholder}
          </p>
        ) : null}
        <Suspense
          fallback={(
            <div className="flex items-center justify-center text-xs text-default-400" style={{ height }}>
              Loading editor…
            </div>
          )}
        >
          <Editor
            height={height}
            language={language}
            theme={theme}
            value={draft}
            onChange={handleChange}
            onMount={handleMount}
            options={{
              minimap: { enabled: minimap },
              wordWrap: wordWrap ? 'on' : 'off',
              lineNumbers: lineNumbers ? 'on' : 'off',
              glyphMargin: false,
              folding: false,
              lineDecorationsWidth: 8,
              lineNumbersMinChars: lineNumbers ? 3 : 0,
              overviewRulerBorder: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize,
              fontSize,
              lineHeight: DESIGNER_MONACO_LINE_HEIGHT,
              padding: { top: 8, bottom: 8 },
              readOnly: isReadOnly,
            }}
          />
        </Suspense>
      </div>
    </FieldShell>
  );
};

export type DesignerCodeEditorFieldProps = Omit<DesignerMonacoFieldProps, 'language'> & {
  language?: string;
};

export const DesignerCodeEditorField: React.FC<DesignerCodeEditorFieldProps> = ({
  language = 'typescript',
  editorHeight,
  ...rest
}) => (
  <DesignerMonacoField
    {...rest}
    language={language}
    editorHeight={editorHeight ?? resolveEditorLinesHeight(DESIGNER_CODE_EDITOR_DEFAULT_LINES)}
  />
);

export type DesignerDatePickerFieldProps = {
  label?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  calendarSystem?: DesignerDatePickerCalendarSystem;
  locale?: string;
  granularity?: DesignerDatePickerGranularity;
  hourCycle?: DesignerDatePickerHourCycle;
  hideTimeZone?: boolean;
  shouldForceLeadingZeros?: boolean;
  minValue?: string;
  maxValue?: string;
  placeholderValue?: string;
  firstDayOfWeek?: DesignerDatePickerFirstDayOfWeek | '';
  timeZone?: string;
  isReadOnly?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  visibleMonths?: number;
  pageBehavior?: 'single' | 'visible';
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  description?: string;
  className?: string;
  name?: string;
  ariaLabel?: string;
  size?: HeroUiFieldSize;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
};

const DesignerDatePickerCalendar: React.FC<{
  label?: string;
  firstDayOfWeek?: DesignerDatePickerFirstDayOfWeek;
  visibleMonths?: number;
  pageBehavior?: 'single' | 'visible';
}> = ({ label, firstDayOfWeek, visibleMonths, pageBehavior }) => (
  <HCalendar
    aria-label={label ?? 'Choose date'}
    className={cn(DESIGNER_DATE_PICKER_CALENDAR_WIDTH_CLASS, 'p-2.5')}
    {...(firstDayOfWeek ? { firstDayOfWeek } : {})}
    {...(visibleMonths && visibleMonths > 1 ? { visibleDuration: { months: visibleMonths } } : {})}
    {...(pageBehavior ? { pageBehavior } : {})}
  >
    <HCalendar.Header className="mb-2 flex items-center justify-between gap-1">
      <HCalendar.YearPickerTrigger className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100">
        <HCalendar.YearPickerTriggerHeading />
        <HCalendar.YearPickerTriggerIndicator className="text-slate-500" />
      </HCalendar.YearPickerTrigger>
      <div className="flex items-center gap-1">
        <HCalendar.NavButton slot="previous" className={DESIGNER_DATE_PICKER_NAV_BUTTON_CLASS} />
        <HCalendar.NavButton slot="next" className={DESIGNER_DATE_PICKER_NAV_BUTTON_CLASS} />
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
);

type DesignerDatePickerRenderState = {
  timeValue?: unknown;
  setTimeValue?: (value: unknown) => void;
};

export const DesignerDatePickerField: React.FC<DesignerDatePickerFieldProps> = ({
  label,
  placeholder = 'Select date',
  value,
  defaultValue,
  onChange,
  calendarSystem: calendarSystemProp = 'gregorian',
  locale,
  granularity: granularityProp = 'day',
  hourCycle: hourCycleProp = 'auto',
  hideTimeZone = false,
  shouldForceLeadingZeros = true,
  minValue,
  maxValue,
  placeholderValue,
  firstDayOfWeek: firstDayOfWeekProp,
  timeZone,
  isReadOnly,
  readOnly,
  autoFocus,
  visibleMonths = 1,
  pageBehavior = 'visible',
  isDisabled,
  isRequired,
  isInvalid,
  errorMessage,
  description,
  className,
  name,
  ariaLabel,
  size = 'sm',
  onBlur,
  onMouseEnter,
}) => {
  const calendarSystem = normalizeDesignerDatePickerCalendarSystem(calendarSystemProp);
  const granularity = normalizeDesignerDatePickerGranularity(granularityProp);
  const hourCycle = normalizeDesignerDatePickerHourCycle(hourCycleProp);
  const i18nLocale = resolveDatePickerI18nLocale(calendarSystem, locale);
  const textDirection = resolveDesignerDatePickerTextDirection(calendarSystem, locale);
  const fieldBorderClass = resolveHeroUiFieldBorderClass(isInvalid);
  const showTimeField = granularity !== 'day';
  const timeGranularity = showTimeField ? granularity : undefined;
  const firstDayOfWeek = firstDayOfWeekProp && firstDayOfWeekProp.length > 0
    ? firstDayOfWeekProp
    : undefined;
  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const iconSizeClass = sizeTokens.radioControlClass;
  const calendarSlotWidthClass = size === 'xs' || size === 'sm'
    ? '!w-[32px] !min-w-[32px] !max-w-[32px]'
    : '!w-[36px] !min-w-[36px] !max-w-[36px]';

  const parsedValue = useMemo(
    () => parseDesignerDatePickerValue(value, granularity),
    [value, granularity],
  );
  const parsedDefaultValue = useMemo(
    () => parseDesignerDatePickerValue(defaultValue, granularity),
    [defaultValue, granularity],
  );
  const parsedMinValue = useMemo(
    () => parseDesignerDatePickerValue(minValue, granularity),
    [minValue, granularity],
  );
  const parsedMaxValue = useMemo(
    () => parseDesignerDatePickerValue(maxValue, granularity),
    [maxValue, granularity],
  );
  const parsedPlaceholderValue = useMemo(
    () => parseDesignerDatePickerValue(placeholderValue, granularity),
    [placeholderValue, granularity],
  );

  const serializedValue = formatDesignerDatePickerValue(parsedValue ?? value, granularity);
  const readOnlyState = isReadOnly === true || readOnly === true;

  const datePickerProps: Record<string, unknown> = {
    'aria-label': ariaLabel || label || placeholder,
    isDisabled,
    isRequired,
    isInvalid,
    isReadOnly: readOnlyState,
    autoFocus,
    granularity,
    className: 'w-full min-w-0',
    ...(timeZone?.trim() ? { timeZone: timeZone.trim() } : {}),
    ...(parsedMinValue ? { minValue: parsedMinValue } : {}),
    ...(parsedMaxValue ? { maxValue: parsedMaxValue } : {}),
    ...(parsedPlaceholderValue ? { placeholderValue: parsedPlaceholderValue } : {}),
    // A `value` prop with no real `onChange` makes HeroUI's date picker (a fully controlled
    // React-Aria component, unlike the mask/calculator/color fields here that mirror into local
    // state) permanently locked to that date — the same freeze class already fixed for plain text
    // inputs. Only use `value` (controlled) when a real onChange exists; otherwise fall back to
    // `defaultValue` (uncontrolled, editable) using whichever value would otherwise have been shown.
    ...(onChange
      ? (parsedValue ? { value: parsedValue } : {})
      : ((parsedValue ?? parsedDefaultValue) ? { defaultValue: parsedValue ?? parsedDefaultValue } : {})),
    onChange: (nextValue: unknown) => {
      if (!onChange) {
        return;
      }
      if (nextValue === undefined || nextValue === null) {
        onChange('');
        return;
      }
      onChange(formatDesignerDatePickerValue(nextValue, granularity));
    },
  };

  const renderDatePickerContent = (pickerState?: DesignerDatePickerRenderState) => (
    <>
      {label ? <HLabel className="sr-only">{label}</HLabel> : null}
      <HDateField.Group
        fullWidth
        granularity={granularity}
        hideTimeZone={hideTimeZone}
        shouldForceLeadingZeros={shouldForceLeadingZeros}
        {...(hourCycle !== 'auto' ? { hourCycle: Number(hourCycle) } : {})}
        className={cn(
          'flex w-full items-stretch overflow-hidden !bg-white',
          sizeTokens.controlHeightClass,
          sizeTokens.controlMaxHeightClass,
          fieldBorderClass,
          HEROUI_RADIUS_CLASS,
          HEROUI_FOCUS_CLIP_CLASS,
          isDisabled || readOnlyState ? 'opacity-60' : '',
        )}
      >
        <HDateField.Input
          dir={textDirection}
          className={cn(
            'flex h-full min-h-0 min-w-0 flex-1 items-center justify-center px-2 py-0 tabular-nums text-slate-800',
            sizeTokens.textClass,
          )}
        >
          {(segment: unknown) => (
            <HDateField.Segment segment={segment} className={DESIGNER_DATE_PICKER_SEGMENT_CLASS} />
          )}
        </HDateField.Input>
        <HDateField.Suffix
          className={cn(
            'pointer-events-auto flex h-full shrink-0 items-stretch overflow-hidden border-s border-slate-300',
            '!m-0 !mr-0 !ml-0 !p-0',
            calendarSlotWidthClass,
          )}
        >
          <HDatePicker.Trigger
            aria-label={placeholder}
            variant="ghost"
            className={cn(
              '!box-border flex !h-full !min-h-0 !w-full !min-w-0 !max-w-full items-center justify-center !gap-0 !rounded-none !p-0 !px-0 !py-0',
              '[&_svg]:!m-0 [&_svg]:!mx-0 [&_svg]:!my-0',
              iconSizeClass.replace('size-', '[&_svg]:!size-'),
            )}
          >
            <HDatePicker.TriggerIndicator className={cn('!m-0 inline-flex items-center justify-center', iconSizeClass)}>
              <CalendarDays className={iconSizeClass} strokeWidth={1.75} aria-hidden="true" />
            </HDatePicker.TriggerIndicator>
          </HDatePicker.Trigger>
        </HDateField.Suffix>
      </HDateField.Group>
      <HDatePicker.Popover className={DESIGNER_DATE_PICKER_POPOVER_CLASS}>
        <div className="flex flex-col gap-0">
          <DesignerDatePickerCalendar
            label={label ?? placeholder}
            firstDayOfWeek={firstDayOfWeek}
            visibleMonths={visibleMonths}
            pageBehavior={pageBehavior}
          />
          {showTimeField ? (
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-2">
              <HLabel className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time</HLabel>
              <HTimeField
                aria-label="Time"
                granularity={timeGranularity}
                hideTimeZone={hideTimeZone}
                shouldForceLeadingZeros={shouldForceLeadingZeros}
                {...(hourCycle !== 'auto' ? { hourCycle: Number(hourCycle) } : {})}
                value={pickerState?.timeValue}
                onChange={(nextValue: unknown) => {
                  pickerState?.setTimeValue?.(nextValue);
                }}
              >
                <HTimeField.Group variant="secondary" className={DESIGNER_DATE_PICKER_TIME_GROUP_CLASS}>
                  <HTimeField.Input dir={textDirection} className="flex items-center">
                    {(segment: unknown) => (
                      <HTimeField.Segment segment={segment} className={DESIGNER_DATE_PICKER_SEGMENT_CLASS} />
                    )}
                  </HTimeField.Input>
                </HTimeField.Group>
              </HTimeField>
            </div>
          ) : null}
        </div>
      </HDatePicker.Popover>
    </>
  );

  return (
    <FieldShell
      label={label}
      description={description}
      isRequired={isRequired}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      className={className}
    >
      {name ? <input type="hidden" name={name} value={serializedValue} readOnly={isDisabled} /> : null}
      <div
        data-designer-component="heroui.date-picker"
        data-calendar-system={calendarSystem}
        data-granularity={granularity}
        dir={textDirection}
        onBlur={onBlur}
        onMouseEnter={onMouseEnter}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <I18nProvider locale={i18nLocale}>
          {showTimeField ? (
            <HDatePicker {...datePickerProps}>
              {(renderProps: { state?: DesignerDatePickerRenderState }) => renderDatePickerContent(renderProps.state)}
            </HDatePicker>
          ) : (
            <HDatePicker {...datePickerProps}>
              {renderDatePickerContent()}
            </HDatePicker>
          )}
        </I18nProvider>
      </div>
    </FieldShell>
  );
};

export type DesignerColorEditorFieldProps = {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  showAlpha?: boolean;
  presetColors?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  description?: string;
  className?: string;
  name?: string;
  ariaLabel?: string;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
};

export const DesignerColorEditorField: React.FC<DesignerColorEditorFieldProps> = ({
  label,
  value,
  defaultValue,
  onChange,
  placeholder = '#RRGGBB',
  isDisabled,
  isRequired,
  isInvalid,
  errorMessage,
  description,
  className,
  name,
  ariaLabel,
  onBlur,
  onMouseEnter,
}) => {
  const initialValue = value ?? defaultValue ?? '';
  const [draft, setDraft] = React.useState(initialValue);

  React.useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  return (
    <FieldShell
      label={label}
      description={description}
      isRequired={isRequired}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      className={className}
    >
      {name ? <input type="hidden" name={name} value={draft} readOnly={isDisabled} /> : null}
      <div onBlur={onBlur} onMouseEnter={onMouseEnter}>
        <UiColorField
          value={draft}
          placeholder={placeholder}
          ariaLabel={ariaLabel || label || 'Color value'}
          disabled={isDisabled}
          isInvalid={isInvalid}
          className={isDisabled ? 'pointer-events-none opacity-60' : undefined}
          onChange={(nextValue) => {
            if (isDisabled) {
              return;
            }
            setDraft(nextValue);
            onChange?.(nextValue);
          }}
        />
      </div>
    </FieldShell>
  );
};

type CalculatorKeypadMode = 'basic' | 'scientific';

const BASIC_KEYPAD = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'] as const;
const SCIENTIFIC_KEYPAD = ['C', 'CE', '(', ')', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+', '%'] as const;

const clampCalculatorValue = (raw: string, min?: string, max?: string): string => {
  if (!raw.trim()) {
    return '';
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return raw;
  }

  const minValue = min?.trim() ? Number(min) : Number.NaN;
  const maxValue = max?.trim() ? Number(max) : Number.NaN;
  let next = parsed;

  if (Number.isFinite(minValue)) {
    next = Math.max(next, minValue);
  }
  if (Number.isFinite(maxValue)) {
    next = Math.min(next, maxValue);
  }

  return String(next);
};

const evaluateCalculatorExpression = (expression: string, decimalPlaces: number): string => {
  const trimmed = expression.trim();
  if (!trimmed) {
    return '';
  }

  const sanitized = trimmed.replace(/[^0-9+\-*/().%\s]/g, '');
  if (!sanitized) {
    return '';
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${sanitized});`)();
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return trimmed;
    }
    return decimalPlaces >= 0 ? result.toFixed(decimalPlaces) : String(result);
  } catch {
    return trimmed;
  }
};

export type DesignerCalculatorFieldProps = {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
  decimalPlaces?: number;
  showKeypad?: boolean;
  keypadMode?: CalculatorKeypadMode;
  allowManualInput?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  description?: string;
  className?: string;
  name?: string;
  ariaLabel?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLInputElement>;
};

export const DesignerCalculatorField: React.FC<DesignerCalculatorFieldProps> = ({
  label,
  value,
  defaultValue,
  onChange,
  placeholder = '0',
  min,
  max,
  step,
  decimalPlaces = 2,
  showKeypad = true,
  keypadMode = 'basic',
  allowManualInput = true,
  isDisabled,
  isRequired,
  isInvalid,
  errorMessage,
  description,
  className,
  name,
  ariaLabel,
  onBlur,
  onMouseEnter,
}) => {
  const initialValue = value ?? defaultValue ?? '';
  const [draft, setDraft] = React.useState(initialValue);
  const [expression, setExpression] = React.useState(initialValue);
  const keypadKeys = keypadMode === 'scientific' ? SCIENTIFIC_KEYPAD : BASIC_KEYPAD;
  const displayValue = showKeypad ? expression : draft;

  React.useEffect(() => {
    setDraft(initialValue);
    setExpression(initialValue);
  }, [initialValue]);

  const commitValue = (nextValue: string) => {
    const normalized = clampCalculatorValue(nextValue, min, max);
    setDraft(normalized);
    setExpression(normalized);
    onChange?.(normalized);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!allowManualInput || isDisabled) {
      return;
    }
    let nextValue = event.target.value;
    // Bug found (parity audit item 64): min/max were only applied via keypad `=` / `C`
    // (`commitValue`). Direct typing never clamped — and with `type="text"` native min/max
    // attributes are inert. Clamp complete numeric literals on change; leave incomplete
    // fragments (e.g. `12.`, `-`, expressions) alone so typing stays usable.
    if (/^-?\d+(?:\.\d+)?$/.test(nextValue.trim())) {
      nextValue = clampCalculatorValue(nextValue, min, max);
    }
    setDraft(nextValue);
    setExpression(nextValue);
    onChange?.(nextValue);
  };

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = (event) => {
    const clamped = clampCalculatorValue(event.currentTarget.value, min, max);
    if (clamped !== event.currentTarget.value) {
      setDraft(clamped);
      setExpression(clamped);
      onChange?.(clamped);
      // Keep event.value aligned so shared base validation (items 42/61) reads the clamped live value.
      event.currentTarget.value = clamped;
    }
    onBlur?.(event);
  };

  const handleKeyPress = (key: string) => {
    if (isDisabled) {
      return;
    }

    if (key === 'C') {
      setExpression('');
      commitValue('');
      return;
    }

    if (key === 'CE') {
      setExpression((previous) => {
        const nextExpression = previous.slice(0, -1);
        if (!showKeypad) {
          setDraft(nextExpression);
          onChange?.(nextExpression);
        }
        return nextExpression;
      });
      return;
    }

    if (key === '=') {
      const evaluated = evaluateCalculatorExpression(expression, decimalPlaces);
      commitValue(evaluated);
      return;
    }

    setExpression((previous) => `${previous}${key}`);
  };

  return (
    <FieldShell
      label={label}
      description={description}
      isRequired={isRequired}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      className={className}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="text"
          inputMode="decimal"
          name={name}
          value={displayValue}
          placeholder={placeholder}
          readOnly={!allowManualInput}
          disabled={isDisabled}
          min={min}
          max={max}
          step={step}
          aria-label={ariaLabel || label || 'Calculator input'}
          className={cn(
            'h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-sky-500',
            isInvalid ? 'border-rose-400' : '',
            isDisabled ? 'cursor-not-allowed opacity-60' : '',
          )}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onMouseEnter={onMouseEnter}
        />
      </div>

      {showKeypad ? (
        <div
          className="mt-2 grid grid-cols-4 gap-1 rounded-md border border-slate-200 bg-slate-50 p-2"
          data-designer-calculator-keypad="true"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {keypadKeys.map((key) => (
            <button
              key={key}
              type="button"
              disabled={isDisabled}
              className={cn(
                'h-8 rounded-md border text-sm font-semibold',
                key === '='
                  ? 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
                isDisabled ? 'cursor-not-allowed opacity-60' : '',
              )}
              onClick={() => handleKeyPress(key)}
            >
              {key}
            </button>
          ))}
        </div>
      ) : null}
    </FieldShell>
  );
};

export {
  DesignerHtmlEditorField,
  DesignerMarkdownEditorField,
  DesignerRichTextEditor,
  DESIGNER_HTML_EDITOR_DEFAULT_LINES,
  type DesignerHtmlEditorFieldProps,
  type DesignerMarkdownEditorFieldProps,
  type DesignerRichTextEditorProps,
} from './DesignerRichTextEditor';
