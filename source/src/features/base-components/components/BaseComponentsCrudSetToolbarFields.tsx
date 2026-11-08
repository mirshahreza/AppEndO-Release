import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  CRUD_SET_EXPORT_FORMATS,
  CRUD_SET_EXPORT_FORMAT_LABELS,
  toggleCrudSetExportFormat,
  type CrudSetExportFormat,
  type CrudSetFilterBarConfig,
  type CrudSetFilterBarFilter,
} from '../../../domain/component-designer/crudSetSpec';
import {
  AppButton,
  AppSurfaceBox,
  CrudSetConfigCheckbox,
  CrudSetFilterBarFilterFields,
  FormField,
  FormSection,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import {
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_DELETE_CLASS,
} from '../../../shared/ui/surfaceClasses';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { markBaseComponentsConfigSectionSource } from './baseComponentsConfigSectionSource';

export type BaseComponentsCrudSetToolbarFieldsProps = {
  filterBar: CrudSetFilterBarConfig;
  onFilterBarChange: (next: CrudSetFilterBarConfig) => void;
  exportEnabled: boolean;
  exportFormats: readonly CrudSetExportFormat[];
  exportFormat: CrudSetExportFormat;
  refreshEnabled: boolean;
  onExportEnabledChange: (enabled: boolean) => void;
  onExportFormatsChange: (formats: CrudSetExportFormat[]) => void;
  onExportFormatChange: (format: CrudSetExportFormat) => void;
  onRefreshEnabledChange: (enabled: boolean) => void;
  fieldOptions: readonly string[];
  onAddFilter: () => void;
};

const TOOLBAR_GROUP_LABEL_CLASS = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

/** CRUD Set toolbar chrome: filter bar (left) + export / refresh (right). */
export const BaseComponentsCrudSetToolbarFields: React.FC<BaseComponentsCrudSetToolbarFieldsProps> = ({
  filterBar,
  onFilterBarChange,
  exportEnabled,
  exportFormats,
  exportFormat,
  refreshEnabled,
  onExportEnabledChange,
  onExportFormatsChange,
  onExportFormatChange,
  onRefreshEnabledChange,
  fieldOptions,
  onAddFilter,
}) => (
  <FormSection title="Toolbar" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
    <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
      <p className={TOOLBAR_GROUP_LABEL_CLASS}>Filter bar</p>
      <FormField label="Include" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
          value={filterBar.enabled !== false ? 'on' : 'off'}
          onChange={(event) => onFilterBarChange({
            ...filterBar,
            enabled: event.target.value === 'on',
          })}
          ariaLabel="CRUD Set filter bar"
        >
          <option value="on">on</option>
          <option value="off">off</option>
        </UiSelect>
      </FormField>
      {filterBar.enabled !== false ? (
        <>
          <CrudSetConfigCheckbox
            label="Search"
            checked={filterBar.search !== false}
            fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
            selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
            onChange={(checked) => onFilterBarChange({ ...filterBar, search: checked })}
          />
          {filterBar.search !== false ? (
            <CrudSetConfigCheckbox
              label="Search clear"
              checked={filterBar.searchClear !== false}
              fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
              selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
              onChange={(checked) => onFilterBarChange({ ...filterBar, searchClear: checked })}
            />
          ) : null}
          <FormField label="Search placeholder" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
            <UiInput
              size="sm"
              autoDir={false}
              className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
              value={filterBar.searchPlaceholder ?? ''}
              onChange={(event) => onFilterBarChange({
                ...filterBar,
                searchPlaceholder: event.target.value,
              })}
              ariaLabel="CRUD Set search placeholder"
            />
          </FormField>
          {(filterBar.filters ?? []).map((filter, index) => (
            <AppSurfaceBox key={filter.id} className="flex flex-col gap-2 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Filter {index + 1}
                </span>
                <AppButton
                  type="button"
                  size="icon-sm"
                  className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DELETE_CLASS)}
                  aria-label={`Remove filter ${index + 1}`}
                  onClick={() => onFilterBarChange({
                    ...filterBar,
                    filters: (filterBar.filters ?? []).filter((item) => item.id !== filter.id),
                  })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </AppButton>
              </div>
              <CrudSetFilterBarFilterFields
                filter={filter}
                fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                fieldOptions={fieldOptions}
                onChange={(next) => onFilterBarChange({
                  ...filterBar,
                  filters: (filterBar.filters ?? []).map((item) => (
                    item.id === filter.id ? next : item
                  )),
                })}
              />
            </AppSurfaceBox>
          ))}
          <AppButton size="sm" intent="utility" onClick={onAddFilter}>
            <Plus className="h-3.5 w-3.5" />
            Add toolbar filter
          </AppButton>
        </>
      ) : null}

      <p className={TOOLBAR_GROUP_LABEL_CLASS}>Actions</p>
      <FormField label="Export" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
          value={exportEnabled ? 'on' : 'off'}
          onChange={(event) => onExportEnabledChange(event.target.value === 'on')}
          ariaLabel="CRUD Set export"
        >
          <option value="on">on</option>
          <option value="off">off</option>
        </UiSelect>
      </FormField>
      <FormField label="Refresh" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
          value={refreshEnabled !== false ? 'on' : 'off'}
          onChange={(event) => onRefreshEnabledChange(event.target.value === 'on')}
          ariaLabel="CRUD Set refresh"
        >
          <option value="on">on</option>
          <option value="off">off</option>
        </UiSelect>
      </FormField>
      {exportEnabled ? (
        <>
          {CRUD_SET_EXPORT_FORMATS.map((format) => (
            <CrudSetConfigCheckbox
              key={format}
              label={CRUD_SET_EXPORT_FORMAT_LABELS[format]}
              checked={(exportFormats ?? CRUD_SET_EXPORT_FORMATS).includes(format)}
              fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
              selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
              onChange={(checked) => {
                const nextFormats = toggleCrudSetExportFormat(
                  [...(exportFormats ?? CRUD_SET_EXPORT_FORMATS)],
                  format,
                  checked,
                );
                onExportFormatsChange(nextFormats);
                if (!nextFormats.includes(exportFormat)) {
                  onExportFormatChange(nextFormats[0] ?? 'xlsx');
                }
              }}
            />
          ))}
          {(exportFormats ?? CRUD_SET_EXPORT_FORMATS).length > 1 ? (
            <FormField label="Default format" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
              <UiSelect
                size="sm"
                className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                value={exportFormat}
                onChange={(event) => onExportFormatChange(event.target.value === 'csv' ? 'csv' : 'xlsx')}
                ariaLabel="CRUD Set default export format"
              >
                {(exportFormats ?? CRUD_SET_EXPORT_FORMATS).map((item) => (
                  <option key={item} value={item}>{CRUD_SET_EXPORT_FORMAT_LABELS[item]}</option>
                ))}
              </UiSelect>
            </FormField>
          ) : null}
        </>
      ) : null}
    </div>
  </FormSection>
);

markBaseComponentsConfigSectionSource(BaseComponentsCrudSetToolbarFields);
