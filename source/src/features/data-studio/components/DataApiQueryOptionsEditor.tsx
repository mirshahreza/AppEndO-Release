import React from 'react';
import { FormField, UiCheckbox, UiInput, UiSelect } from '../../../shared/ui';
import type { ConfigureDataApiQueryOptions } from '../lib/configureDataApiTypes';

type PresetOption = { id: string; label: string };

type DataApiQueryOptionsEditorProps = {
  queryOptions: ConfigureDataApiQueryOptions;
  supportsPaging: boolean;
  presetOptions?: readonly PresetOption[];
  onChange: (queryOptions: ConfigureDataApiQueryOptions) => void;
};

const toggleId = (ids: string[], id: string, checked: boolean): string[] => {
  const set = new Set(ids);
  if (checked) {
    set.add(id);
  } else {
    set.delete(id);
  }
  return [...set];
};

export const DataApiQueryOptionsEditor: React.FC<DataApiQueryOptionsEditorProps> = ({
  queryOptions,
  supportsPaging,
  presetOptions = [],
  onChange,
}) => (
  <div className="grid gap-3 md:grid-cols-2">
    <div className="md:col-span-2 flex flex-col gap-2">
      <UiCheckbox
        size="sm"
        isSelected={queryOptions.allowFilter}
        onChange={(checked) => onChange({ ...queryOptions, allowFilter: checked })}
      >
        Allow filter query params
      </UiCheckbox>
      <UiCheckbox
        size="sm"
        isSelected={queryOptions.allowSort}
        onChange={(checked) => onChange({ ...queryOptions, allowSort: checked })}
      >
        Allow sort query param
      </UiCheckbox>
      <UiCheckbox
        size="sm"
        isSelected={queryOptions.allowLangParam}
        onChange={(checked) => onChange({ ...queryOptions, allowLangParam: checked })}
      >
        Allow ?lang= for Base Info title enrichment
      </UiCheckbox>
    </div>

    {supportsPaging ? (
      <>
        <FormField label="Default page size">
          <UiInput
            size="sm"
            type="number"
            value={String(queryOptions.defaultPageSize)}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange({
                ...queryOptions,
                defaultPageSize: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 20,
              });
            }}
          />
        </FormField>
        <FormField label="Max page size">
          <UiInput
            size="sm"
            type="number"
            value={String(queryOptions.maxPageSize)}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange({
                ...queryOptions,
                maxPageSize: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 100,
              });
            }}
          />
        </FormField>
        <FormField
          label="List total count (COUNT)"
          hint="Controls whether list responses run an exact Sequelize COUNT. Designer grids send includeCount=false by default."
        >
          <UiSelect
            size="sm"
            value={queryOptions.listCountMode}
            onChange={(event) => {
              const value = event.target.value as typeof queryOptions.listCountMode;
              onChange({
                ...queryOptions,
                listCountMode: value,
              });
            }}
          >
            <option value="inherit">Platform default (exact count)</option>
            <option value="query">Respect ?includeCount query param</option>
            <option value="none">Never count</option>
            <option value="exact">Always count</option>
          </UiSelect>
        </FormField>
        {queryOptions.listCountMode === 'query' ? (
          <div className="md:col-span-2">
            <UiCheckbox
              size="sm"
              isSelected={queryOptions.defaultIncludeCountWhenQuery}
              onChange={(checked) => onChange({
                ...queryOptions,
                defaultIncludeCountWhenQuery: checked,
              })}
            >
              Include exact count when the client omits ?includeCount
            </UiCheckbox>
          </div>
        ) : null}
      </>
    ) : null}

    {presetOptions.length > 0 ? (
      <div className="md:col-span-2 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <p className="text-sm font-medium text-slate-800">Predefined query presets</p>
        <p className="text-xs text-slate-600">
          Forced presets always apply on this list API. Client presets limit which optional chips appear in UI.
        </p>
        <FormField label="Always apply (forced)">
          <div className="flex flex-col gap-1.5">
            {presetOptions.map((preset) => (
              <UiCheckbox
                key={`forced-${preset.id}`}
                size="sm"
                isSelected={queryOptions.forcedPresetIds.includes(preset.id)}
                onChange={(checked) => onChange({
                  ...queryOptions,
                  forcedPresetIds: toggleId(queryOptions.forcedPresetIds, preset.id, checked),
                })}
              >
                {preset.label}
                <span className="ms-1 font-mono text-[11px] text-slate-500">{preset.id}</span>
              </UiCheckbox>
            ))}
          </div>
        </FormField>
        <FormField
          label="Optional in client UI"
          hint="Leave all unchecked to expose every optional preset defined on the model."
        >
          <div className="flex flex-col gap-1.5">
            {presetOptions.map((preset) => (
              <UiCheckbox
                key={`client-${preset.id}`}
                size="sm"
                isSelected={queryOptions.clientPresetIds.includes(preset.id)}
                onChange={(checked) => onChange({
                  ...queryOptions,
                  clientPresetIds: toggleId(queryOptions.clientPresetIds, preset.id, checked),
                })}
              >
                {preset.label}
              </UiCheckbox>
            ))}
          </div>
        </FormField>
      </div>
    ) : null}
  </div>
);
