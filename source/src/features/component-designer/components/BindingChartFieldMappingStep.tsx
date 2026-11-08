import * as React from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import type {
  ChartSeriesAggregation,
  DesignerChartBarLineFieldMapping,
  DesignerChartFieldMapping,
  DesignerChartMappingType,
  DesignerChartPieGaugeFieldMapping,
  DesignerChartSparklineFieldMapping,
  DesignerChartValueField,
} from '../../../domain/component-designer/bindingChartEngine';
import { resolveDefaultSeriesColor } from '../../../domain/component-designer/bindingChartEngine';
import { UiColorField } from '../../../components/ui/UiColorField';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiInput, UiSelect } from '../../../shared/ui';
import { DesignerFieldRow } from './DesignerFieldRow';
import { BindingDataFlowHint } from './BindingDataFlowHint';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

export type BindingChartFieldMappingStepProps = {
  availableFields: string[];
  mapping: DesignerChartFieldMapping;
  chartType: DesignerChartMappingType;
  onChange: (mapping: DesignerChartFieldMapping) => void;
  dataSourceOptions?: Array<{ id: string; name: string }>;
  allowComparisonSeries?: boolean;
};

const AGGREGATION_OPTIONS: Array<{ value: ChartSeriesAggregation; label: string; hint: string }> = [
  { value: 'sum', label: 'Sum', hint: 'Add values when categories repeat' },
  { value: 'avg', label: 'Average', hint: 'Mean of values per category' },
  { value: 'count', label: 'Count', hint: 'Number of rows per category' },
  { value: 'min', label: 'Min', hint: 'Smallest value per category' },
  { value: 'max', label: 'Max', hint: 'Largest value per category' },
  { value: 'none', label: 'No grouping', hint: 'One chart point per API row' },
];

const updateValueField = (
  mapping: DesignerChartBarLineFieldMapping,
  index: number,
  patch: Partial<DesignerChartValueField>,
): DesignerChartBarLineFieldMapping => ({
  ...mapping,
  valueFields: mapping.valueFields.map((entry, entryIndex) => (
    entryIndex === index ? { ...entry, ...patch } : entry
  )),
});

const syncSeriesKey = (apiField: string): string => apiField.trim();

const ensureBarLineMapping = (
  mapping: DesignerChartFieldMapping,
  chartType: 'bar' | 'line',
): DesignerChartBarLineFieldMapping => {
  if (mapping.chartType === 'bar' || mapping.chartType === 'line') {
    return { ...mapping, chartType };
  }
  if (mapping.chartType === 'pie' || mapping.chartType === 'donut' || mapping.chartType === 'gauge') {
    return {
      chartType,
      categoryField: mapping.labelField,
      categoryAs: 'label',
      valueFields: [{
        field: mapping.valueField,
        label: mapping.valueField,
        seriesKey: mapping.valueField,
        color: resolveDefaultSeriesColor(0),
        aggregation: 'sum',
      }],
    };
  }

  const sparkValue = mapping.chartType === 'sparkline' ? mapping.valueField : 'value';
  return {
    chartType,
    categoryField: 'label',
    categoryAs: 'label',
    valueFields: [{
      field: sparkValue,
      label: sparkValue,
      seriesKey: sparkValue,
      color: resolveDefaultSeriesColor(0),
      aggregation: 'sum',
    }],
  };
};

const ensurePieGaugeMapping = (
  mapping: DesignerChartFieldMapping,
  chartType: 'pie' | 'donut' | 'gauge',
): DesignerChartPieGaugeFieldMapping => {
  if (mapping.chartType === 'pie' || mapping.chartType === 'donut' || mapping.chartType === 'gauge') {
    return { ...mapping, chartType };
  }
  if (mapping.chartType === 'bar' || mapping.chartType === 'line') {
    return {
      chartType,
      labelField: mapping.categoryField,
      valueField: mapping.valueFields[0]?.field ?? 'value',
      ...(chartType === 'gauge' ? { gaugeMin: 0, gaugeMax: 100 } : {}),
    };
  }
  const sparkValue = mapping.chartType === 'sparkline' ? mapping.valueField : 'value';
  return {
    chartType,
    labelField: 'label',
    valueField: sparkValue,
    ...(chartType === 'gauge' ? { gaugeMin: 0, gaugeMax: 100 } : {}),
  };
};

const ensureSparklineMapping = (mapping: DesignerChartFieldMapping): DesignerChartSparklineFieldMapping => {
  if (mapping.chartType === 'sparkline') {
    return mapping;
  }
  if (mapping.chartType === 'bar' || mapping.chartType === 'line') {
    return {
      chartType: 'sparkline',
      valueField: mapping.valueFields[0]?.field ?? 'value',
      ...(mapping.valueFields[1] ? { compareField: mapping.valueFields[1].field } : {}),
    };
  }
  if (mapping.chartType === 'pie' || mapping.chartType === 'donut' || mapping.chartType === 'gauge') {
    return { chartType: 'sparkline', valueField: mapping.valueField };
  }
  return { chartType: 'sparkline', valueField: 'value' };
};

const BarLineMappingForm: React.FC<{
  availableFields: string[];
  mapping: DesignerChartBarLineFieldMapping;
  onChange: (mapping: DesignerChartBarLineFieldMapping) => void;
  dataSourceOptions?: Array<{ id: string; name: string }>;
  allowComparisonSeries?: boolean;
}> = ({ availableFields, mapping, onChange, dataSourceOptions = [], allowComparisonSeries = false }) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const categoryOptions = availableFields.length > 0 ? availableFields : [mapping.categoryField];
  const numericFieldOptions = availableFields.filter((field) => field !== mapping.categoryField);

  const previewSummary = mapping.valueFields
    .map((entry) => {
      const agg = entry.aggregation && entry.aggregation !== 'none' ? ` (${entry.aggregation})` : '';
      return `${entry.label?.trim() || entry.field}${agg}`;
    })
    .join(' · ');

  return (
    <div className="space-y-3">
      <BindingDataFlowHint
        sourceLabel="List API"
        targetLabel={mapping.chartType === 'line' ? 'Line chart' : 'Bar chart'}
        description={`Pick the category (X axis) and one or more numeric series. Values are transformed automatically.${previewSummary ? ` Series: ${previewSummary}.` : ''}`}
      />

      <DesignerFieldRow label="Category (X axis)">
        <UiSelect
          size="sm"
          value={mapping.categoryField}
          onChange={(event) => onChange({ ...mapping, categoryField: event.target.value })}
        >
          {categoryOptions.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </UiSelect>
      </DesignerFieldRow>

      <div className={`space-y-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Value series (Y axis)</p>
            <p className="ps-[4px] text-[10px] text-slate-500">Numeric fields plotted on the chart. Add color and legend label for each.</p>
          </div>
          <AppButton
            type="button"
            intent="secondary"
            size="sm"
            className="h-7 shrink-0 px-2 text-[11px]"
            onClick={() => {
              const nextField = numericFieldOptions.find((field) => !mapping.valueFields.some((entry) => entry.field === field)) ?? 'value';
              const nextIndex = mapping.valueFields.length;
              onChange({
                ...mapping,
                valueFields: [...mapping.valueFields, {
                  field: nextField,
                  seriesKey: syncSeriesKey(nextField),
                  label: nextField,
                  color: resolveDefaultSeriesColor(nextIndex),
                  aggregation: 'sum',
                }],
              });
            }}
          >
            <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
            Add series
          </AppButton>
        </div>

        {mapping.valueFields.map((series, index) => (
          <div key={`series-${index}`} className="space-y-2 rounded-md border border-slate-100 bg-slate-50/80 p-2">
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <DesignerFieldRow label="API field">
                <UiSelect
                  size="sm"
                  nested
                  value={series.field}
                  onChange={(event) => {
                    const field = event.target.value;
                    onChange(updateValueField(mapping, index, {
                      field,
                      seriesKey: syncSeriesKey(field),
                      label: series.label?.trim() ? series.label : field,
                    }));
                  }}
                >
                  {(numericFieldOptions.length > 0 ? numericFieldOptions : [series.field]).map((field) => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </UiSelect>
              </DesignerFieldRow>
              <DesignerFieldRow label="Legend label">
                <UiInput
                  size="sm"
                  nested
                  value={series.label ?? series.field}
                  onChange={(event) => onChange(updateValueField(mapping, index, { label: event.target.value }))}
                  placeholder="Display name in legend"
                />
              </DesignerFieldRow>
              <AppButton
                type="button"
                intent="secondary"
                size="sm"
                className="mb-[1px] h-8 w-8 px-0 text-rose-600"
                disabled={mapping.valueFields.length <= 1}
                onClick={() => onChange({
                  ...mapping,
                  valueFields: mapping.valueFields.filter((_, entryIndex) => entryIndex !== index),
                })}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </AppButton>
            </div>

            <div className="grid grid-cols-[1fr_1fr] items-end gap-2">
              <DesignerFieldRow label="Aggregation">
                <UiSelect
                  size="sm"
                  nested
                  value={series.aggregation ?? 'sum'}
                  onChange={(event) => onChange(updateValueField(mapping, index, {
                    aggregation: event.target.value as ChartSeriesAggregation,
                  }))}
                >
                  {AGGREGATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} title={option.hint}>
                      {option.label}
                    </option>
                  ))}
                </UiSelect>
              </DesignerFieldRow>
              <DesignerFieldRow label="Color">
                <UiColorField
                  value={series.color ?? resolveDefaultSeriesColor(index)}
                  onChange={(color) => onChange(updateValueField(mapping, index, { color }))}
                  ariaLabel={`Color for ${series.label ?? series.field}`}
                />
              </DesignerFieldRow>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={`flex w-full items-center justify-between rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50 px-2 py-1.5 text-[10px] font-medium text-slate-600`}
        onClick={() => setShowAdvanced((current) => !current)}
      >
        Advanced (pivot / sort / top-N)
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>

      {showAdvanced ? (
        <div className="space-y-2">
          <DesignerFieldRow label="Category internal key">
            <UiInput
              size="sm"
              value={mapping.categoryAs ?? 'label'}
              onChange={(event) => onChange({ ...mapping, categoryAs: event.target.value })}
              placeholder="label"
              className="font-mono"
              autoDir={false}
            />
          </DesignerFieldRow>
          <DesignerFieldRow label="Series group field (pivot)">
            <UiSelect
              size="sm"
              value={mapping.seriesGroupField ?? ''}
              onChange={(event) => onChange({
                ...mapping,
                seriesGroupField: event.target.value.trim() || undefined,
              })}
            >
              <option value="">None</option>
              {availableFields.filter((field) => field !== mapping.categoryField).map((field) => (
                <option key={field} value={field}>{field}</option>
              ))}
            </UiSelect>
          </DesignerFieldRow>
        </div>
      ) : null}

      {allowComparisonSeries ? (
        <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/50 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">Period comparison</p>
          <p className="ps-[4px] text-[10px] text-violet-900/80">
            Fetch a second list endpoint (e.g. previous month) and render it as an additional series.
          </p>
          <DesignerFieldRow label="Comparison data source">
            <UiSelect
              size="sm"
              value={mapping.comparisonSeries?.dataSourceRef ?? ''}
              onChange={(event) => {
                const dataSourceRef = event.target.value.trim();
                if (!dataSourceRef) {
                  onChange({ ...mapping, comparisonSeries: undefined });
                  return;
                }
                onChange({
                  ...mapping,
                  comparisonSeries: {
                    dataSourceRef,
                    label: mapping.comparisonSeries?.label?.trim() || 'Previous period',
                  },
                });
              }}
            >
              <option value="">None</option>
              {dataSourceOptions.map((source) => (
                <option key={source.id} value={source.id}>{source.name}</option>
              ))}
            </UiSelect>
          </DesignerFieldRow>
          {mapping.comparisonSeries?.dataSourceRef ? (
            <DesignerFieldRow label="Comparison series label">
              <UiInput
                size="sm"
                value={mapping.comparisonSeries.label}
                onChange={(event) => onChange({
                  ...mapping,
                  comparisonSeries: {
                    dataSourceRef: mapping.comparisonSeries!.dataSourceRef,
                    label: event.target.value.trim() || 'Previous period',
                  },
                })}
                placeholder="Previous period"
              />
            </DesignerFieldRow>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const PieGaugeMappingForm: React.FC<{
  availableFields: string[];
  mapping: DesignerChartPieGaugeFieldMapping;
  onChange: (mapping: DesignerChartPieGaugeFieldMapping) => void;
}> = ({ availableFields, mapping, onChange }) => {
  const fieldOptions = availableFields.length > 0 ? availableFields : [mapping.labelField, mapping.valueField];
  const isGauge = mapping.chartType === 'gauge';

  return (
    <div className="space-y-3">
      <BindingDataFlowHint
        sourceLabel="List API"
        targetLabel={isGauge ? 'Gauge' : mapping.chartType === 'donut' ? 'Donut chart' : 'Pie chart'}
        description={isGauge
          ? 'Pick the label and numeric value. Set min/max and optional color thresholds for the gauge arc.'
          : 'Pick one label field (slice name) and one numeric value field.'}
      />

      <DesignerFieldRow label="Label field">
        <UiSelect
          size="sm"
          value={mapping.labelField}
          onChange={(event) => onChange({ ...mapping, labelField: event.target.value })}
        >
          {fieldOptions.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </UiSelect>
      </DesignerFieldRow>

      <DesignerFieldRow label="Value field">
        <UiSelect
          size="sm"
          value={mapping.valueField}
          onChange={(event) => onChange({ ...mapping, valueField: event.target.value })}
        >
          {fieldOptions.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </UiSelect>
      </DesignerFieldRow>

      {isGauge ? (
        <div className={`space-y-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Gauge range</p>
          <div className="grid grid-cols-2 gap-2">
            <DesignerFieldRow label="Min">
              <UiInput
                size="sm"
                nested
                type="number"
                value={String(mapping.gaugeMin ?? 0)}
                onChange={(event) => onChange({
                  ...mapping,
                  gaugeMin: event.target.value.trim().length === 0 ? undefined : Number(event.target.value),
                })}
                autoDir={false}
              />
            </DesignerFieldRow>
            <DesignerFieldRow label="Max">
              <UiInput
                size="sm"
                nested
                type="number"
                value={String(mapping.gaugeMax ?? 100)}
                onChange={(event) => onChange({
                  ...mapping,
                  gaugeMax: event.target.value.trim().length === 0 ? undefined : Number(event.target.value),
                })}
                autoDir={false}
              />
            </DesignerFieldRow>
          </div>
          <DesignerFieldRow label="Thresholds (JSON)">
            <UiInput
              size="sm"
              nested
              value={mapping.gaugeThresholds ? JSON.stringify(mapping.gaugeThresholds) : ''}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (!raw) {
                  onChange({ ...mapping, gaugeThresholds: undefined });
                  return;
                }
                try {
                  const parsed = JSON.parse(raw) as Array<{ value: number; color: string }>;
                  if (Array.isArray(parsed)) {
                    onChange({
                      ...mapping,
                      gaugeThresholds: parsed.filter((entry) => (
                        typeof entry?.value === 'number' && typeof entry?.color === 'string'
                      )),
                    });
                  }
                } catch {
                  // Keep typing; commit only valid JSON
                }
              }}
              placeholder='[{"value":70,"color":"#f59e0b"}]'
              className="font-mono"
              autoDir={false}
            />
          </DesignerFieldRow>
        </div>
      ) : null}
    </div>
  );
};

const SparklineMappingForm: React.FC<{
  availableFields: string[];
  mapping: DesignerChartSparklineFieldMapping;
  onChange: (mapping: DesignerChartSparklineFieldMapping) => void;
}> = ({ availableFields, mapping, onChange }) => {
  const fieldOptions = availableFields.length > 0 ? availableFields : [mapping.valueField];

  return (
    <div className="space-y-3">
      <BindingDataFlowHint
        sourceLabel="List API"
        targetLabel="Sparkline"
        description="Pick the numeric field that forms the sparkline trend. Optionally pick a compare field for a second series."
      />

      <DesignerFieldRow label="Value field">
        <UiSelect
          size="sm"
          value={mapping.valueField}
          onChange={(event) => onChange({ ...mapping, valueField: event.target.value })}
        >
          {fieldOptions.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </UiSelect>
      </DesignerFieldRow>

      <DesignerFieldRow label="Compare field (optional)">
        <UiSelect
          size="sm"
          value={mapping.compareField ?? ''}
          onChange={(event) => onChange({
            ...mapping,
            compareField: event.target.value.trim() || undefined,
          })}
        >
          <option value="">None</option>
          {fieldOptions.filter((field) => field !== mapping.valueField).map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </UiSelect>
      </DesignerFieldRow>
    </div>
  );
};

export const BindingChartFieldMappingStep: React.FC<BindingChartFieldMappingStepProps> = ({
  availableFields,
  mapping,
  chartType,
  onChange,
  dataSourceOptions,
  allowComparisonSeries,
}) => {
  const lastAlignedTypeRef = React.useRef<DesignerChartMappingType | null>(null);

  React.useEffect(() => {
    if (lastAlignedTypeRef.current === chartType && mapping.chartType === chartType) {
      return;
    }
    lastAlignedTypeRef.current = chartType;
    if (mapping.chartType === chartType) {
      return;
    }
    if (chartType === 'bar' || chartType === 'line') {
      onChange(ensureBarLineMapping(mapping, chartType));
      return;
    }
    if (chartType === 'pie' || chartType === 'donut' || chartType === 'gauge') {
      onChange(ensurePieGaugeMapping(mapping, chartType));
      return;
    }
    onChange(ensureSparklineMapping(mapping));
    // Only realign when the wizard's chart type target changes — not on every mapping edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [chartType]);

  if (chartType === 'sparkline') {
    const spark = mapping.chartType === 'sparkline' ? mapping : ensureSparklineMapping(mapping);
    return (
      <SparklineMappingForm
        availableFields={availableFields}
        mapping={spark}
        onChange={onChange}
      />
    );
  }

  if (chartType === 'pie' || chartType === 'donut' || chartType === 'gauge') {
    const pie = (
      mapping.chartType === 'pie' || mapping.chartType === 'donut' || mapping.chartType === 'gauge'
    ) && mapping.chartType === chartType
      ? mapping
      : ensurePieGaugeMapping(mapping, chartType);
    return (
      <PieGaugeMappingForm
        availableFields={availableFields}
        mapping={pie}
        onChange={onChange}
      />
    );
  }

  const barLine = (
    mapping.chartType === 'bar' || mapping.chartType === 'line'
  ) && mapping.chartType === (chartType === 'line' ? 'line' : 'bar')
    ? mapping
    : ensureBarLineMapping(mapping, chartType === 'line' ? 'line' : 'bar');
  return (
    <BarLineMappingForm
      availableFields={availableFields}
      mapping={barLine}
      onChange={onChange}
      dataSourceOptions={dataSourceOptions}
      allowComparisonSeries={allowComparisonSeries}
    />
  );
};
