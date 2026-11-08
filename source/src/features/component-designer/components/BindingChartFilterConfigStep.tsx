import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DesignerChartToolbarConfig, DesignerChartToolbarSelectFilterConfig } from '../../../domain/component-designer/designerChartToolbarConfig';
import {
  buildDefaultChartToolbarConfig,
  normalizeDesignerChartToolbarConfig,
  resolveChartFilterStorePrefix,
} from '../../../domain/component-designer/designerChartToolbarConfig';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiCheckboxChoice, UiInput, UiSelect } from '../../../shared/ui';
import { DesignerFieldRow } from './DesignerFieldRow';
import { BindingDataFlowHint } from './BindingDataFlowHint';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

export type BindingChartFilterConfigStepProps = {
  nodeId: string;
  config: DesignerChartToolbarConfig;
  onChange: (config: DesignerChartToolbarConfig) => void;
  /** API response field names — used to suggest query param names */
  availableFields?: string[];
};

const COMMON_QUERY_PARAMS = ['search', 'q', 'query', 'status', 'type', 'category', 'from', 'to', 'dateFrom', 'dateTo', 'startDate', 'endDate'];

const buildParamOptions = (availableFields: string[]): string[] => {
  const merged = new Set<string>([...COMMON_QUERY_PARAMS, ...availableFields]);
  return Array.from(merged);
};

const createSelectFilter = (nodeId: string, index: number, availableFields: string[]): DesignerChartToolbarSelectFilterConfig => {
  const prefix = resolveChartFilterStorePrefix(nodeId);
  const suggestedParam = availableFields[index] ?? availableFields[0] ?? `filter${index + 1}`;
  // Bug found: `id` used to reuse `suggestedParam` directly — once `index >= availableFields.length`,
  // the fallback (`availableFields[0]`) is the SAME for every extra filter, so adding a second
  // Dropdown filter with fewer available fields than filters silently gave it the identical
  // `id`/`storePath` as an earlier filter — they'd overwrite each other's selection and desync
  // their highlighted option. `id` (and the storePath derived from it) must always be unique per
  // filter regardless of how many API fields are available; only the suggested label/query-param
  // name (which the user can freely edit) is allowed to repeat.
  const id = `filter-${index + 1}`;
  return {
    id,
    label: suggestedParam.charAt(0).toUpperCase() + suggestedParam.slice(1),
    apiParam: suggestedParam,
    storePath: `${prefix}.${id}`,
    options: [],
    placeholder: 'All',
  };
};

export const BindingChartFilterConfigStep: React.FC<BindingChartFilterConfigStepProps> = ({
  nodeId,
  config,
  onChange,
  availableFields = [],
}) => {
  const normalized = normalizeDesignerChartToolbarConfig(config.enabled === true ? config : buildDefaultChartToolbarConfig(nodeId), nodeId);
  const paramOptions = buildParamOptions(availableFields);

  const update = (patch: Partial<DesignerChartToolbarConfig>) => {
    onChange(normalizeDesignerChartToolbarConfig({
      ...normalized,
      ...patch,
      enabled: true,
      runtimeEnabled: patch.runtimeEnabled ?? true,
    }, nodeId));
  };

  const updateSelectFilter = (index: number, patch: Partial<DesignerChartToolbarSelectFilterConfig>) => {
    const next = [...(normalized.selectFilters ?? [])];
    next[index] = { ...next[index]!, ...patch };
    update({ selectFilters: next });
  };

  const updateSelectFilterOption = (
    filterIndex: number,
    optionIndex: number,
    patch: { value?: string; label?: string },
  ) => {
    const filter = normalized.selectFilters?.[filterIndex];
    if (!filter) return;
    const options = [...filter.options];
    options[optionIndex] = { ...options[optionIndex]!, ...patch };
    updateSelectFilter(filterIndex, { options });
  };

  return (
    <div className="space-y-3">
      <BindingDataFlowHint
        sourceLabel="User filters"
        targetLabel="API query"
        description="When end users change a filter, the value is sent as a query parameter on your list endpoint and the chart reloads automatically. Pick param names that your API already supports."
      />

      <DesignerFieldRow label="Runtime filters">
        <UiCheckboxChoice
          size="sm"
          checked={normalized.runtimeEnabled === true}
          onChange={(checked) => update({ runtimeEnabled: checked })}
        >
          Allow end users to change filters at runtime
        </UiCheckboxChoice>
      </DesignerFieldRow>

      <div className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2 space-y-2`}>
        <DesignerFieldRow label="Search filter">
          <UiCheckboxChoice
            size="sm"
            checked={normalized.search?.enabled === true}
            onChange={(checked) => update({
              search: checked
                ? {
                  enabled: true,
                  placeholder: normalized.search?.placeholder ?? '…',
                  storePath: normalized.search?.storePath,
                  apiParam: normalized.search?.apiParam ?? 'search',
                  debounceMs: normalized.search?.debounceMs ?? 300,
                }
                : undefined,
            })}
          >
            Enable text search
          </UiCheckboxChoice>
        </DesignerFieldRow>

        {normalized.search?.enabled ? (
          <div className="grid grid-cols-2 gap-2">
            <DesignerFieldRow label="Query param name">
              <UiSelect
                size="sm"
                nested
                value={normalized.search.apiParam ?? 'search'}
                onChange={(event) => update({ search: { ...normalized.search!, apiParam: event.target.value } })}
              >
                {paramOptions.map((param) => (
                  <option key={param} value={param}>{param}</option>
                ))}
              </UiSelect>
            </DesignerFieldRow>
            <DesignerFieldRow label="Placeholder text">
              <UiInput
                size="sm"
                nested
                value={normalized.search.placeholder ?? ''}
                onChange={(event) => update({ search: { ...normalized.search!, placeholder: event.target.value } })}
                placeholder="chart data…"
              />
            </DesignerFieldRow>
            <DesignerFieldRow label="Debounce (ms)">
              <UiInput
                size="sm"
                nested
                type="number"
                autoDir={false}
                value={normalized.search.debounceMs ?? 300}
                onChange={(event) => update({
                  search: {
                    ...normalized.search!,
                    debounceMs: Math.max(0, Number(event.target.value) || 0),
                  },
                })}
                placeholder="300"
              />
            </DesignerFieldRow>
          </div>
        ) : null}
      </div>

      <div className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2 space-y-2`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Dropdown filters</p>
            <p className="ps-[4px] text-[10px] text-slate-500">Fixed choices the user picks from (e.g. status, region).</p>
          </div>
          <AppButton
            type="button"
            intent="secondary"
            size="sm"
            className="h-7 shrink-0 px-2 text-[11px]"
            onClick={() => update({
              selectFilters: [...(normalized.selectFilters ?? []), createSelectFilter(nodeId, (normalized.selectFilters ?? []).length, availableFields)],
            })}
          >
            <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
            Add filter
          </AppButton>
        </div>

        {(normalized.selectFilters ?? []).map((filter, filterIndex) => (
          <div key={filter.id} className="space-y-2 border-t border-slate-100 pt-2">
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <DesignerFieldRow label="Filter label">
                <UiInput
                  size="sm"
                  nested
                  value={filter.label}
                  onChange={(event) => updateSelectFilter(filterIndex, { label: event.target.value })}
                  placeholder="Status"
                />
              </DesignerFieldRow>
              <DesignerFieldRow label="Query param">
                <UiSelect
                  size="sm"
                  nested
                  value={filter.apiParam}
                  onChange={(event) => updateSelectFilter(filterIndex, { apiParam: event.target.value })}
                >
                  {paramOptions.map((param) => (
                    <option key={`${filter.id}-${param}`} value={param}>{param}</option>
                  ))}
                </UiSelect>
              </DesignerFieldRow>
              <AppButton
                type="button"
                intent="destructive"
                size="sm"
                className="mb-[1px] h-8 w-8 px-0"
                onClick={() => update({
                  selectFilters: (normalized.selectFilters ?? []).filter((_, entryIndex) => entryIndex !== filterIndex),
                })}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </AppButton>
            </div>

            <div className="space-y-1.5 rounded-md bg-slate-50 p-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-slate-600">Options</p>
                <AppButton
                  type="button"
                  intent="secondary"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => updateSelectFilter(filterIndex, {
                    options: [...filter.options, { value: '', label: '' }],
                  })}
                >
                  <Plus className="mr-0.5 h-3 w-3" strokeWidth={2} />
                  Add option
                </AppButton>
              </div>
              {filter.options.length === 0 ? (
                <p className="ps-[4px] text-[10px] text-slate-500">Add at least one value and label (e.g. active → Active).</p>
              ) : null}
              {filter.options.map((option, optionIndex) => (
                <div key={`${filter.id}-opt-${optionIndex}`} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <DesignerFieldRow label="Value (sent to API)">
                    <UiInput
                      size="sm"
                      nested
                      value={option.value}
                      onChange={(event) => updateSelectFilterOption(filterIndex, optionIndex, { value: event.target.value })}
                      placeholder="active"
                    />
                  </DesignerFieldRow>
                  <DesignerFieldRow label="Label (shown to user)">
                    <UiInput
                      size="sm"
                      nested
                      value={option.label}
                      onChange={(event) => updateSelectFilterOption(filterIndex, optionIndex, { label: event.target.value })}
                      placeholder="Active"
                    />
                  </DesignerFieldRow>
                  <AppButton
                    type="button"
                    intent="destructive"
                    size="sm"
                    className="mb-[1px] h-8 w-8 px-0"
                    onClick={() => updateSelectFilter(filterIndex, {
                      options: filter.options.filter((_, i) => i !== optionIndex),
                    })}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </AppButton>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2 space-y-2`}>
        <DesignerFieldRow label="Date range filter">
          <UiCheckboxChoice
            size="sm"
            checked={normalized.dateRange?.enabled === true}
            onChange={(checked) => update({
              dateRange: checked
                ? {
                  enabled: true,
                  label: normalized.dateRange?.label ?? 'Date range',
                  fromApiParam: normalized.dateRange?.fromApiParam ?? 'from',
                  toApiParam: normalized.dateRange?.toApiParam ?? 'to',
                  fromStorePath: normalized.dateRange?.fromStorePath,
                  toStorePath: normalized.dateRange?.toStorePath,
                }
                : undefined,
            })}
          >
            Enable date range
          </UiCheckboxChoice>
        </DesignerFieldRow>

        {normalized.dateRange?.enabled ? (
          <div className="grid grid-cols-2 gap-2">
            <DesignerFieldRow label="From param">
              <UiSelect
                size="sm"
                nested
                value={normalized.dateRange.fromApiParam ?? 'from'}
                onChange={(event) => update({ dateRange: { ...normalized.dateRange!, fromApiParam: event.target.value } })}
              >
                {paramOptions.map((param) => (
                  <option key={`from-${param}`} value={param}>{param}</option>
                ))}
              </UiSelect>
            </DesignerFieldRow>
            <DesignerFieldRow label="To param">
              <UiSelect
                size="sm"
                nested
                value={normalized.dateRange.toApiParam ?? 'to'}
                onChange={(event) => update({ dateRange: { ...normalized.dateRange!, toApiParam: event.target.value } })}
              >
                {paramOptions.map((param) => (
                  <option key={`to-${param}`} value={param}>{param}</option>
                ))}
              </UiSelect>
            </DesignerFieldRow>
          </div>
        ) : null}
      </div>

      <DesignerFieldRow label="Refresh button">
        <UiCheckboxChoice
          size="sm"
          checked={normalized.refresh?.enabled === true}
          onChange={(checked) => update({ refresh: checked ? { enabled: true } : undefined })}
        >
          Show manual refresh button
        </UiCheckboxChoice>
      </DesignerFieldRow>
    </div>
  );
};
