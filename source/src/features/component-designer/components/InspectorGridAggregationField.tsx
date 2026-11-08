import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DesignerAction, DesignerNode } from '../../../domain/component-designer/types';
import {
  parseDesignerAppTableGridColumns,
} from '../../../domain/component-designer/designerDataGridColumns';
import {
  parseGridAggregationConfig,
  serializeGridAggregationConfig,
  type GridAggregationConfig,
  type GridAggregationEntry,
  type GridAggregationFn,
  type GridAggregationFormat,
} from '../../../domain/component-designer/designerGridAggregation';
import { AppButton, UiInput, UiSelect } from '../../../shared/ui';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { DesignerFieldRow } from './DesignerFieldRow';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import {
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';
import {
  InspectorFieldGroup,
  InspectorSectionValueBadge,
  InspectorToggleChipGroup,
} from './inspectorFieldPrimitives';

type InspectorGridAggregationFieldProps = {
  node: DesignerNode;
  dispatch: React.Dispatch<DesignerAction>;
};

const FN_OPTIONS: Array<{ value: GridAggregationFn; label: string }> = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

const FORMAT_OPTIONS: Array<{ value: GridAggregationFormat | ''; label: string }> = [
  { value: '', label: 'Default' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
];

const readConfig = (node: DesignerNode): GridAggregationConfig | null =>
  parseGridAggregationConfig(node.props.gridAggregationConfig);

const defaultAggregationEntry = (fieldKeys: string[]): GridAggregationEntry => ({
  field: fieldKeys[0] ?? 'amount',
  fn: 'sum',
  label: 'Total',
  format: 'number',
});

export const InspectorGridAggregationField: React.FC<InspectorGridAggregationFieldProps> = ({
  node,
  dispatch,
}) => {
  const fieldColumns = React.useMemo(
    () => parseDesignerAppTableGridColumns(node.props.columns)
      .filter((column) => !String(column.key).startsWith('__action_')),
    [node.props.columns],
  );
  const fieldKeys = fieldColumns.map((column) => column.key);

  const [config, setConfig] = React.useState<GridAggregationConfig | null>(() => readConfig(node));
  const skipPropSyncRef = React.useRef(false);

  React.useEffect(() => {
    if (skipPropSyncRef.current) {
      skipPropSyncRef.current = false;
      return;
    }
    setConfig(readConfig(node));
  }, [node.id, node.props.gridAggregationConfig]);

  const persistConfig = React.useCallback((next: GridAggregationConfig | null) => {
    skipPropSyncRef.current = true;
    setConfig(next);
    dispatch({
      type: 'set-node-prop',
      nodeId: node.id,
      key: 'gridAggregationConfig',
      value: serializeGridAggregationConfig(next),
    });
  }, [dispatch, node.id]);

  const ensureConfig = React.useCallback((): GridAggregationConfig => {
    if (config) {
      return config;
    }
    const initial: GridAggregationConfig = {
      groupByFields: fieldKeys[0] ? [fieldKeys[0]] : [],
      aggregations: [defaultAggregationEntry(fieldKeys)],
      showSubtotalPerGroup: true,
      showGrandTotal: true,
    };
    persistConfig(initial);
    return initial;
  }, [config, fieldKeys, persistConfig]);

  const updateConfig = React.useCallback((patch: Partial<GridAggregationConfig>) => {
    const base = ensureConfig();
    persistConfig({ ...base, ...patch });
  }, [ensureConfig, persistConfig]);

  const enabled = config !== null;

  return (
    <DesignerFieldRow label="Aggregation / Grouping" layout="stack" align="start">
      <div className="flex w-full flex-col gap-2" {...preventInspectorDetailsToggle}>
        <AppSurfaceBox
          tone="cyan"
          title="Aggregation / Grouping"
          layout="panel"
          collapsible
          defaultOpen
          headerExtra={(
            <InspectorSectionValueBadge
              active={enabled}
              label="On"
            />
          )}
        >
          <div className="flex flex-col gap-2">
            <InspectorToggleChipGroup
              aria-label="Aggregation enabled"
              options={[{ key: 'enabled', label: 'Enable grouping & totals' }]}
              activeKeys={new Set(enabled ? ['enabled'] : [])}
              onToggle={() => {
                if (enabled) {
                  persistConfig(null);
                  return;
                }
                ensureConfig();
              }}
            />

            {enabled && config ? (
              <div className={`space-y-3 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2`}>
                <DesignerFieldRow label="Group by fields">
                  <InspectorToggleChipGroup
                    aria-label="Group by fields"
                    options={fieldKeys.map((fieldKey) => ({ key: fieldKey, label: fieldKey }))}
                    activeKeys={new Set(config.groupByFields ?? [])}
                    onToggle={(fieldKey) => {
                      const current = config.groupByFields ?? [];
                      const next = current.includes(fieldKey)
                        ? current.filter((entry) => entry !== fieldKey)
                        : [...current, fieldKey];
                      updateConfig({ groupByFields: next });
                    }}
                  />
                </DesignerFieldRow>

                <div className="space-y-2">
                  <div className={`${INSPECTOR_TEXT_XS} font-medium uppercase tracking-wide text-slate-500`}>Aggregations</div>
                  {config.aggregations.map((entry, index) => (
                    <div
                      key={`${node.id}:agg:${index}`}
                      className="grid grid-cols-[minmax(0,1fr)_90px_90px_minmax(0,1fr)_28px] items-center gap-2"
                    >
                      <UiSelect
                        size="sm"
                        nested
                        aria-label="Aggregation field"
                        value={entry.field}
                        onChange={(event) => {
                          const next = config.aggregations.map((item, itemIndex) => (
                            itemIndex === index ? { ...item, field: event.target.value } : item
                          ));
                          updateConfig({ aggregations: next });
                        }}
                      >
                        {fieldKeys.map((fieldKey) => (
                          <option key={fieldKey} value={fieldKey}>{fieldKey}</option>
                        ))}
                      </UiSelect>
                      <UiSelect
                        size="sm"
                        nested
                        aria-label="Aggregation function"
                        value={entry.fn}
                        onChange={(event) => {
                          const next = config.aggregations.map((item, itemIndex) => (
                            itemIndex === index ? { ...item, fn: event.target.value as GridAggregationFn } : item
                          ));
                          updateConfig({ aggregations: next });
                        }}
                      >
                        {FN_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </UiSelect>
                      <UiSelect
                        size="sm"
                        nested
                        aria-label="Aggregation format"
                        value={entry.format ?? ''}
                        onChange={(event) => {
                          const format = event.target.value as GridAggregationFormat | '';
                          const next = config.aggregations.map((item, itemIndex) => (
                            itemIndex === index
                              ? { ...item, ...(format ? { format } : { format: undefined }) }
                              : item
                          ));
                          updateConfig({ aggregations: next });
                        }}
                      >
                        {FORMAT_OPTIONS.map((option) => (
                          <option key={option.label} value={option.value}>{option.label}</option>
                        ))}
                      </UiSelect>
                      <UiInput
                        size="sm"
                        nested
                        autoDir={false}
                        aria-label="Aggregation label"
                        value={entry.label}
                        onChange={(event) => {
                          const next = config.aggregations.map((item, itemIndex) => (
                            itemIndex === index ? { ...item, label: event.target.value } : item
                          ));
                          updateConfig({ aggregations: next });
                        }}
                      />
                      <AppButton
                        type="button"
                        intent="utility"
                        size="sm"
                        className="h-7 w-7 min-w-0 px-0"
                        aria-label="Remove aggregation"
                        onClick={() => {
                          const next = config.aggregations.filter((_, itemIndex) => itemIndex !== index);
                          updateConfig({ aggregations: next.length > 0 ? next : [defaultAggregationEntry(fieldKeys)] });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </AppButton>
                    </div>
                  ))}
                  <AppButton
                    type="button"
                    intent="utility"
                    size="sm"
                    onClick={() => {
                      updateConfig({
                        aggregations: [...config.aggregations, defaultAggregationEntry(fieldKeys)],
                      });
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add aggregation
                  </AppButton>
                </div>

                <InspectorToggleChipGroup
                  aria-label="Aggregation display options"
                  options={[
                    { key: 'subtotal', label: 'Show subtotal per group' },
                    { key: 'grandTotal', label: 'Show grand total row' },
                    { key: 'collapsible', label: 'Collapsible groups' },
                  ]}
                  activeKeys={new Set([
                    ...(config.showSubtotalPerGroup === true ? ['subtotal'] as const : []),
                    ...(config.showGrandTotal === true ? ['grandTotal'] as const : []),
                    ...(config.collapsibleGroups === true ? ['collapsible'] as const : []),
                  ])}
                  onToggle={(key) => {
                    if (key === 'subtotal') {
                      updateConfig({ showSubtotalPerGroup: !(config.showSubtotalPerGroup === true) });
                      return;
                    }
                    if (key === 'grandTotal') {
                      updateConfig({ showGrandTotal: !(config.showGrandTotal === true) });
                      return;
                    }
                    if (key === 'collapsible') {
                      updateConfig({ collapsibleGroups: !(config.collapsibleGroups === true) });
                    }
                  }}
                />

                <div className="space-y-2 border-t border-slate-100 pt-2">
                  <div className={`${INSPECTOR_TEXT_XS} font-medium uppercase tracking-wide text-slate-500`}>Pivot mode (optional)</div>
                  <InspectorFieldGroup columns={2}>
                    <UiInput
                      size="sm"
                      nested
                      autoDir={false}
                      label="Row field"
                      value={config.pivotMode?.rowField ?? ''}
                      onChange={(event) => {
                        const rowField = event.target.value.trim();
                        if (!rowField) {
                          updateConfig({ pivotMode: undefined });
                          return;
                        }
                        updateConfig({
                          pivotMode: {
                            rowField,
                            columnField: config.pivotMode?.columnField ?? fieldKeys[1] ?? fieldKeys[0] ?? '',
                            valueField: config.pivotMode?.valueField ?? fieldKeys[2] ?? fieldKeys[0] ?? '',
                            aggFn: config.pivotMode?.aggFn ?? 'sum',
                          },
                        });
                      }}
                    />
                    <UiInput
                      size="sm"
                      nested
                      autoDir={false}
                      label="Column field"
                      value={config.pivotMode?.columnField ?? ''}
                      onChange={(event) => {
                        const columnField = event.target.value.trim();
                        if (!config.pivotMode?.rowField || !columnField) {
                          return;
                        }
                        updateConfig({
                          pivotMode: {
                            ...config.pivotMode,
                            columnField,
                          },
                        });
                      }}
                    />
                    <UiInput
                      size="sm"
                      nested
                      autoDir={false}
                      label="Value field"
                      value={config.pivotMode?.valueField ?? ''}
                      onChange={(event) => {
                        const valueField = event.target.value.trim();
                        if (!config.pivotMode?.rowField || !valueField) {
                          return;
                        }
                        updateConfig({
                          pivotMode: {
                            ...config.pivotMode,
                            valueField,
                          },
                        });
                      }}
                    />
                    <UiSelect
                      size="sm"
                      nested
                      label="Pivot aggregation"
                      value={config.pivotMode?.aggFn ?? 'sum'}
                      onChange={(event) => {
                        if (!config.pivotMode?.rowField) {
                          return;
                        }
                        updateConfig({
                          pivotMode: {
                            ...config.pivotMode,
                            aggFn: event.target.value as GridAggregationFn,
                          },
                        });
                      }}
                    >
                      {FN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </UiSelect>
                  </InspectorFieldGroup>
                </div>
              </div>
            ) : null}
          </div>
        </AppSurfaceBox>
      </div>
    </DesignerFieldRow>
  );
};
