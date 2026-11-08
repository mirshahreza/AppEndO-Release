import React, { useEffect } from 'react';
import {
  AppSelectionToggle,
  APP_SELECTION_TOGGLE_WRAP_CLASS,
  UiInput,
  UiSelect,
} from '../../../../shared/ui';
import { LOG_LEVELS, LOG_LEVEL_SETTINGS_FIELD } from '../../../../shared/api/contracts/logs/constants';
import type { LogLevel } from '../../../../shared/api/contracts/logs/types';
import {
  resolveSharedRetentionDays,
  resolveSharedRetentionOffload,
  RETENTION_DAY_OPTIONS,
  type RetentionOffload,
  type RetentionPolicy,
} from '../../../../shared/api/contracts/settings/retention';
import { GRID_PAGE_SIZES, type GridPageSize } from '../../../../shared/lib/gridPagingConstants';
import { useRetentionDestinationsQuery } from '../../../../shared/api/queries/retention';
import type { SettingsPageModel } from '../../hooks/useSettingsPage';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import { cn } from '../../../../lib/utils';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  SettingsField,
  SettingsFormGroup,
} from './SettingsFormPrimitives';

type LogsSettingsFieldsProps = {
  page: SettingsPageModel;
};

type DestinationItem = { id: string; name: string; type: string };

const FILE_DESTINATION_VALUE = 'json-files';

function resolveViewerPageSize(value: number): GridPageSize {
  if ((GRID_PAGE_SIZES as readonly number[]).includes(value)) {
    return value as GridPageSize;
  }
  return GRID_PAGE_SIZES.reduce((best, size) => (
    Math.abs(size - value) < Math.abs(best - value) ? size : best
  ));
}

const patchSharedOffload = (page: SettingsPageModel, offload: RetentionOffload): void => {
  page.setDraftSettings((prev) => ({
    ...prev,
    logRetention: {
      appLogs: { ...prev.logRetention.appLogs, offload },
      authAudit: { ...prev.logRetention.authAudit, offload },
      recordEvents: { ...prev.logRetention.recordEvents, offload },
      userMessageDispatches: { ...prev.logRetention.userMessageDispatches, offload },
    },
  }));
};

const patchSharedAge = (page: SettingsPageModel, olderThanDays: number): void => {
  page.setDraftSettings((prev) => {
    const shared = resolveSharedRetentionOffload(prev.logRetention);
    const nextFamily = (current: RetentionPolicy, followAppLogsAge?: boolean): RetentionPolicy => ({
      ...current,
      action: 'offload',
      olderThanDays,
      offload: shared,
      ...(followAppLogsAge ? { followAppLogsAge: true } : {}),
    });
    return {
      ...prev,
      logRetentionDays: olderThanDays,
      logRetention: {
        appLogs: nextFamily(prev.logRetention.appLogs),
        authAudit: nextFamily(prev.logRetention.authAudit, true),
        recordEvents: nextFamily(prev.logRetention.recordEvents),
        userMessageDispatches: nextFamily(prev.logRetention.userMessageDispatches),
      },
    };
  });
};

const RetentionCellSelect: React.FC<{
  ariaLabel: string;
  value: string;
  disabled?: boolean;
  minWidthClass?: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ ariaLabel, value, disabled, minWidthClass = 'min-w-[9.5rem]', onChange, children }) => (
  <UiSelect
    size="sm"
    className={cn(SETTINGS_CONTROL_CLASS, minWidthClass)}
    aria-label={ariaLabel}
    value={value}
    disabled={disabled}
    onChange={(event) => onChange(event.target.value)}
  >
    {children}
  </UiSelect>
);

const retentionDaysValue = (days: number | undefined): string => (
  RETENTION_DAY_OPTIONS.includes((days ?? 30) as typeof RETENTION_DAY_OPTIONS[number])
    ? String(days ?? 30)
    : '30'
);

const retentionDaysOptions = (
  t: (key: string, params?: Record<string, string | number>) => string,
): React.ReactNode => (
  <>
    <option value="7">{t('settings.forms.common.days', { count: 7 })}</option>
    <option value="30">{t('settings.forms.common.daysDefault', { count: 30 })}</option>
    <option value="90">{t('settings.forms.common.days', { count: 90 })}</option>
    <option value="180">{t('settings.forms.common.days', { count: 180 })}</option>
  </>
);

const RETENTION_SELECT_MIN = {
  age: 'w-full',
  destination: 'w-full',
} as const;

const destinationSelectValue = (
  offload: RetentionOffload | undefined,
  destinations: DestinationItem[],
  destinationsReady: boolean,
): string => {
  const connectionId = offload?.connectionId?.trim();
  if (offload?.mode === 'same-type-db' && connectionId) {
    if (!destinationsReady || destinations.some((item) => item.id === connectionId)) {
      return connectionId;
    }
  }
  return FILE_DESTINATION_VALUE;
};

const VISIBLE_LEVEL_UNSELECTED_CLASS =
  'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-800';

const VISIBLE_LEVEL_SELECTED_CLASS: Record<LogLevel, string> = {
  INFO: 'border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
  WARN: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
  ERROR: 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100',
  DEBUG: 'border-cyan-400 bg-cyan-50 text-cyan-900 hover:bg-cyan-100',
};

export const LogsSettingsFields: React.FC<LogsSettingsFieldsProps> = ({ page }) => {
  const t = useSettingsFormT();
  const destinationsQuery = useRetentionDestinationsQuery();
  const destinations = destinationsQuery.data ?? [];
  const destinationsReady = destinationsQuery.isSuccess;

  useEffect(() => {
    if (!destinationsQuery.isSuccess) return;
    const offload = resolveSharedRetentionOffload(page.draftSettings.logRetention);
    if (offload.mode !== 'same-type-db') return;
    const connectionId = offload.connectionId?.trim();
    if (connectionId && destinations.some((item) => item.id === connectionId)) return;
    patchSharedOffload(page, { mode: 'json-files' });
  }, [destinations, destinationsQuery.isSuccess, page]);

  const sharedOffload = resolveSharedRetentionOffload(page.draftSettings.logRetention);
  const sharedDays = resolveSharedRetentionDays(page.draftSettings.logRetention);

  const agePicker = (
    <RetentionCellSelect
      ariaLabel={t('settings.forms.logs.retention.olderThan')}
      minWidthClass={RETENTION_SELECT_MIN.age}
      value={retentionDaysValue(sharedDays)}
      onChange={(value) => patchSharedAge(page, Number(value))}
    >
      {retentionDaysOptions(t)}
    </RetentionCellSelect>
  );

  const missingConnection = destinationsReady
    && sharedOffload.mode === 'same-type-db'
    && Boolean(sharedOffload.connectionId?.trim())
    && !destinations.some((item) => item.id === sharedOffload.connectionId);

  const destinationPicker = (
    <div className="flex flex-col gap-1">
      <RetentionCellSelect
        ariaLabel={t('settings.forms.logs.retention.destination')}
        minWidthClass={RETENTION_SELECT_MIN.destination}
        value={destinationSelectValue(sharedOffload, destinations, destinationsReady)}
        disabled={destinationsQuery.isLoading}
        onChange={(value) => {
          if (value === FILE_DESTINATION_VALUE) {
            patchSharedOffload(page, { mode: 'json-files' });
            return;
          }
          patchSharedOffload(page, {
            mode: 'same-type-db',
            connectionId: value,
          });
        }}
      >
        {destinations.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
        <option value={FILE_DESTINATION_VALUE}>{t('settings.forms.logs.retention.file')}</option>
      </RetentionCellSelect>
      {destinationsQuery.isError ? (
        <p className="text-[11px] font-medium text-rose-600">
          {t('settings.forms.logs.destinationsFailed')}
        </p>
      ) : null}
      {missingConnection ? (
        <p className="text-[11px] font-medium text-amber-700">
          {t('settings.forms.logs.retention.connectionMissing')}
        </p>
      ) : null}
    </div>
  );

  const generalTitle = t('settings.forms.logs.general.title');
  const retentionTitle = t('settings.forms.logs.retention.policiesTitle');

  return (
    <>
      <SettingsFormGroup
        title={generalTitle}
        sectionId="logs"
        titleInfo={t('settings.forms.logs.persistence.info')}
      >
        <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
          <SettingsField
            label={t('settings.forms.logs.pageSize')}
            labelInfo={t('settings.forms.logs.pageSizeInfo')}
          >
            <UiSelect
              value={resolveViewerPageSize(page.draftSettings.logViewerLimit)}
              onChange={(event) => page.setDraftSettings((prev) => ({
                ...prev,
                logViewerLimit: Number(event.target.value),
              }))}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            >
              {GRID_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size === 1000
                    ? t('settings.forms.common.rowsDefault', { count: size })
                    : t('settings.forms.common.rows', { count: size })}
                </option>
              ))}
            </UiSelect>
          </SettingsField>

          <SettingsField
            label={t('settings.forms.logs.dbMinLevel')}
            labelInfo={t('settings.forms.logs.dbMinLevelInfo')}
          >
            <UiSelect
              value={page.draftSettings.logDbPersistMinLevel}
              onChange={(event) => page.setDraftSettings((prev) => ({
                ...prev,
                logDbPersistMinLevel: event.target.value as typeof prev.logDbPersistMinLevel,
              }))}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            >
              {LOG_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </UiSelect>
          </SettingsField>

          <SettingsField label={t('settings.forms.logs.batchSize')}>
            <UiInput
              type="number"
              min={1}
              max={500}
              value={page.draftSettings.logDbBatchSize}
              onChange={(event) => page.setDraftSettings((prev) => ({
                ...prev,
                logDbBatchSize: Number(event.target.value) || prev.logDbBatchSize,
              }))}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            />
          </SettingsField>

          <SettingsField label={t('settings.forms.logs.flushInterval')}>
            <UiInput
              type="number"
              min={25}
              max={5000}
              value={page.draftSettings.logDbFlushIntervalMs}
              onChange={(event) => page.setDraftSettings((prev) => ({
                ...prev,
                logDbFlushIntervalMs: Number(event.target.value) || prev.logDbFlushIntervalMs,
              }))}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            />
          </SettingsField>

          <SettingsField
            label={t('settings.forms.logs.maxQueue')}
            labelInfo={t('settings.forms.logs.maxQueueInfo')}
          >
            <UiInput
              type="number"
              min={100}
              max={50000}
              value={page.draftSettings.logDbMaxQueueSize}
              onChange={(event) => page.setDraftSettings((prev) => ({
                ...prev,
                logDbMaxQueueSize: Number(event.target.value) || prev.logDbMaxQueueSize,
              }))}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            />
          </SettingsField>

          <SettingsField
            label={t('settings.forms.logs.visibleLevels.title')}
            labelInfo={t('settings.forms.logs.visibleLevels.info')}
          >
            <div className={APP_SELECTION_TOGGLE_WRAP_CLASS} role="group" aria-label={t('settings.forms.logs.visibleLevels.title')}>
              {LOG_LEVELS.map((level) => {
                const field = LOG_LEVEL_SETTINGS_FIELD[level];
                const selected = page.draftSettings[field];
                return (
                  <AppSelectionToggle
                    key={field}
                    id={field}
                    selected={selected}
                    className={selected ? VISIBLE_LEVEL_SELECTED_CLASS[level] : VISIBLE_LEVEL_UNSELECTED_CLASS}
                    onClick={() => page.setDraftSettings((prev) => ({
                      ...prev,
                      [field]: !prev[field],
                    }))}
                  >
                    {level}
                  </AppSelectionToggle>
                );
              })}
            </div>
          </SettingsField>
        </div>
      </SettingsFormGroup>

      <SettingsFormGroup
        title={retentionTitle}
        sectionId="logs"
        titleInfo={t('settings.forms.logs.retention.info')}
      >
        <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
          <SettingsField label={t('settings.forms.logs.retention.olderThan')}>
            {agePicker}
          </SettingsField>
          <SettingsField label={t('settings.forms.logs.retention.destination')}>
            {destinationPicker}
          </SettingsField>
        </div>
      </SettingsFormGroup>
    </>
  );
};
