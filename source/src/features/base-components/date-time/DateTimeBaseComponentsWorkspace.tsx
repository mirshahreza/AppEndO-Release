import * as React from 'react';
import { CalendarClock } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { DesignerDatePickerField, FormField, FormSection, UiSelect } from '../../../shared/ui';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import { BaseComponentsPreviewFrame, BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type DateTimeBaseComponentsConfig = {
  pattern: 'date-picker' | 'date-range' | 'date-time';
  calendar: 'gregorian' | 'persian' | 'islamic';
  locale: 'en-US' | 'en-GB' | 'fa-IR' | 'ar-IQ';
  constraints: 'none' | 'future-only' | 'release-window';
  timezone: 'local' | 'UTC' | 'America/New_York' | 'Asia/Tehran';
  state: 'default' | 'invalid' | 'disabled';
  viewport: 'desktop' | 'phone';
};

const DEFAULT_CONFIG: DateTimeBaseComponentsConfig = {
  pattern: 'date-picker',
  calendar: 'gregorian',
  locale: 'en-US',
  constraints: 'none',
  timezone: 'local',
  state: 'default',
  viewport: 'desktop',
};

const OPTIONS: { label: string; key: keyof DateTimeBaseComponentsConfig; values: readonly string[] }[] = [
  { label: 'Pattern', key: 'pattern', values: ['date-picker', 'date-range', 'date-time'] },
  { label: 'Calendar', key: 'calendar', values: ['gregorian', 'persian', 'islamic'] },
  { label: 'Locale', key: 'locale', values: ['en-US', 'en-GB', 'fa-IR', 'ar-IQ'] },
  { label: 'Constraints', key: 'constraints', values: ['none', 'future-only', 'release-window'] },
  { label: 'Timezone', key: 'timezone', values: ['local', 'UTC', 'America/New_York', 'Asia/Tehran'] },
  { label: 'State', key: 'state', values: ['default', 'invalid', 'disabled'] },
  { label: 'Viewport', key: 'viewport', values: ['desktop', 'phone'] },
];

export const dateTimeSelectionForPattern = (
  pattern: DateTimeBaseComponentsConfig['pattern'],
): 'single' | 'range' => (pattern === 'date-range' ? 'range' : 'single');

const DATE_SAMPLES_BY_CALENDAR: Record<DateTimeBaseComponentsConfig['calendar'], readonly [string, string]> = {
  gregorian: ['2026-08-10', '2026-08-14'],
  persian: ['1405-05-19', '1405-05-23'],
  islamic: ['1448-02-26', '1448-03-01'],
};

export const dateTimeConstraints = (
  calendar: DateTimeBaseComponentsConfig['calendar'],
  constraints: DateTimeBaseComponentsConfig['constraints'],
): { minValue?: string; maxValue?: string } => {
  const [sampleStart] = DATE_SAMPLES_BY_CALENDAR[calendar];
  if (constraints === 'future-only') return { minValue: sampleStart };
  if (constraints === 'release-window') {
    if (calendar === 'persian') return { minValue: '1405-05-10', maxValue: '1405-06-09' };
    if (calendar === 'islamic') return { minValue: '1448-02-18', maxValue: '1448-03-18' };
    return { minValue: '2026-08-01', maxValue: '2026-08-31' };
  }
  return {};
};

export const applyDateTimeOption = (
  current: DateTimeBaseComponentsConfig,
  start: string,
  end: string,
  key: keyof DateTimeBaseComponentsConfig,
  value: string,
): { config: DateTimeBaseComponentsConfig; start: string; end: string } => {
  const config = { ...current, [key]: value } as DateTimeBaseComponentsConfig;
  if (key !== 'calendar' || !(
    value === 'gregorian' || value === 'persian' || value === 'islamic'
  )) {
    return { config, start, end };
  }
  config.locale = value === 'persian' ? 'fa-IR' : value === 'islamic' ? 'ar-IQ' : 'en-US';
  const [nextStart, nextEnd] = DATE_SAMPLES_BY_CALENDAR[value];
  return { config, start: nextStart, end: nextEnd };
};

export const resolveDateTimeOptionLiveness = (config: DateTimeBaseComponentsConfig) => {
  const constraints = dateTimeConstraints(config.calendar, config.constraints);
  return {
    visibleOptions: [
      'pattern',
      'calendar',
      'locale',
      'constraints',
      ...(config.pattern === 'date-time' ? ['timezone'] : []),
      'state',
      'viewport',
    ],
    selectionMode: dateTimeSelectionForPattern(config.pattern),
    pickerCount: config.pattern === 'date-range' ? 2 : 1,
    viewportClass: config.viewport === 'phone' ? 'max-w-sm' : 'max-w-2xl',
    pickerProps: {
      calendarSystem: config.calendar === 'persian'
        ? 'jalali' as const
        : config.calendar === 'islamic'
          ? 'hijri' as const
          : 'gregorian' as const,
      locale: config.locale,
      granularity: config.pattern === 'date-time' ? 'minute' as const : 'day' as const,
      timeZone: config.pattern === 'date-time' && config.timezone !== 'local'
        ? config.timezone
        : undefined,
      isDisabled: config.state === 'disabled',
      isInvalid: config.state === 'invalid',
      errorMessage: config.state === 'invalid'
        ? 'Choose a date inside the release window.'
        : undefined,
      ...constraints,
    },
  };
};

export const DateTimeBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_CONFIG);
  const [start, setStart] = React.useState('2026-08-10');
  const [end, setEnd] = React.useState('2026-08-14');

  const setOption = (key: keyof DateTimeBaseComponentsConfig, value: string) => {
    const next = applyDateTimeOption(config, start, end, key, value);
    setConfig(next.config);
    setStart(next.start);
    setEnd(next.end);
  };

  const optionLiveness = resolveDateTimeOptionLiveness(config);
  const constraints = dateTimeConstraints(config.calendar, config.constraints);
  const json = React.useMemo(() => JSON.stringify({
    public: {
      calendar: config.calendar,
      locale: config.locale,
      selectionMode: dateTimeSelectionForPattern(config.pattern),
      ...constraints,
      timeZone: config.timezone,
    },
    composition: { presets: config.pattern === 'date-range' ? ['This week', 'Next 30 days'] : [] },
    demo: { pattern: config.pattern, state: config.state, viewport: config.viewport },
  }, null, 2), [config, constraints]);

  const sharedPickerProps = optionLiveness.pickerProps;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="date-time" json={json}>
          <BaseComponentsResetButton onClick={() => { setConfig(DEFAULT_CONFIG); setStart('2026-08-10'); setEnd('2026-08-14'); }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Date and time" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {OPTIONS.filter((option) => optionLiveness.visibleOptions.includes(option.key)).map((option) => (
                  <FormField key={option.key} label={option.label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config[option.key]}
                      onChange={(event) => setOption(option.key, event.target.value)}
                      ariaLabel={option.label}
                    >
                      {option.values.map((value) => <option key={value} value={value}>{value}</option>)}
                    </UiSelect>
                  </FormField>
                ))}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="date-time">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'items-center justify-center')}>
            <section
              className={cn(
                'w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm',
                optionLiveness.viewportClass,
              )}
            >
              <div className="mb-4 flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-cyan-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">Schedule release window</h2>
                  <p className="text-xs text-slate-500">Dates stay local until the record is saved.</p>
                </div>
              </div>
              <div className={cn('grid gap-3', config.pattern === 'date-range' && 'sm:grid-cols-2')}>
                <DesignerDatePickerField
                  {...sharedPickerProps}
                  label={config.pattern === 'date-range' ? 'Start date' : 'Release date'}
                  value={start}
                  onChange={setStart}
                  ariaLabel="Release start date"
                  size="sm"
                />
                {config.pattern === 'date-range' ? (
                  <DesignerDatePickerField
                    {...sharedPickerProps}
                    label="End date"
                    value={end}
                    onChange={setEnd}
                    ariaLabel="Release end date"
                    size="sm"
                  />
                ) : null}
              </div>
            </section>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
