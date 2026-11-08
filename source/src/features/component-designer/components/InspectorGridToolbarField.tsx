import * as React from 'react';
import { Columns3, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import { listDesignerModalNodes } from '../../../domain/component-designer/bindingGridDetailEngine';
import type {
  DesignerGridToolbarConfig,
  DesignerGridToolbarFieldFilterConfig,
} from '../../../domain/component-designer/designerGridToolbarConfig';
import {
  buildServerQueryColumnFiltersFromGridColumns,
  DEFAULT_GRID_SERVER_QUERY_CONFIG,
  DEFAULT_GRID_TOOLBAR_PRESET,
  normalizeDesignerGridToolbarConfig,
  parseDesignerGridToolbarConfig,
  resolveEffectiveFieldFilters,
} from '../../../domain/component-designer/designerGridToolbarConfig';
import { parseDesignerAppTableGridColumns } from '../../../domain/component-designer/designerDataGridColumns';
import type { DesignerGridRowActionBehaviorKind } from '../../../domain/component-designer/designerGridActionColumns';
import {
  DEFAULT_FILTER_MATCH_LOGIC,
  type FilterMatchLogic,
} from '../../../shared/lib/filterMatchLogic';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { UiInput, UiSelect } from '../../../shared/ui';
import { DesignerFieldRow } from './DesignerFieldRow';
import { InspectorLucideIconPickerField } from './InspectorLucideIconPickerField';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';
import {
  InspectorFieldGroup,
  InspectorMicroLabel,
  InspectorSectionValueBadge,
  InspectorToggleChipGroup,
} from './inspectorFieldPrimitives';

type InspectorGridToolbarFieldProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

const BEHAVIOR_OPTIONS: ReadonlyArray<{ value: DesignerGridRowActionBehaviorKind; label: string }> = [
  { value: 'none', label: 'No behavior' },
  { value: 'open-modal', label: 'Open modal' },
];

const CONTROL_TYPE_OPTIONS = [
  { value: 'checkbox-group', label: 'Checkbox group' },
  { value: 'radio-group', label: 'Radio group' },
  { value: 'select', label: 'Select' },
] as const;

const OPTIONS_SOURCE_OPTIONS = [
  { value: 'static', label: 'Static options' },
  { value: 'lov', label: 'Shared LOV' },
] as const;

const MATCH_LOGIC_OPTIONS: ReadonlyArray<{ value: FilterMatchLogic; label: string }> = [
  { value: 'or', label: 'OR (any)' },
  { value: 'and', label: 'AND (all)' },
];

const readConfig = (node: DesignerNode): DesignerGridToolbarConfig =>
  parseDesignerGridToolbarConfig(node.props.toolbarConfig) ?? { enabled: false };

const createEmptyFieldFilter = (
  index: number,
  existing: readonly DesignerGridToolbarFieldFilterConfig[],
): DesignerGridToolbarFieldFilterConfig => {
  const idBase = `filter_${index + 1}`;
  let id = idBase;
  let suffix = 2;
  while (existing.some((filter) => filter.id === id)) {
    id = `${idBase}_${suffix}`;
    suffix += 1;
  }
  return {
    id,
    field: 'status',
    label: 'Status',
    controlType: 'select',
    optionsSource: 'static',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'archived', label: 'Archived' },
    ],
    apiParam: 'status',
    storePath: `gridToolbar.${id}`,
  };
};

export const InspectorGridToolbarField: React.FC<InspectorGridToolbarFieldProps> = ({
  node,
  document,
  bindingDefinitions,
  dispatch,
}) => {
  const [config, setConfig] = React.useState<DesignerGridToolbarConfig>(() => readConfig(node));
  const skipPropSyncRef = React.useRef(false);
  const modalNodes = React.useMemo(() => listDesignerModalNodes(document), [document]);
  const gridColumns = React.useMemo(
    () => parseDesignerAppTableGridColumns(node.props.columns),
    [node.props.columns],
  );
  const lovEntries = React.useMemo(
    () => Object.entries(bindingDefinitions.lovs ?? {}).map(([id, lov]) => ({
      id,
      name: lov.name?.trim() || id,
    })),
    [bindingDefinitions.lovs],
  );
  const fieldFilters = resolveEffectiveFieldFilters(config);

  React.useEffect(() => {
    if (skipPropSyncRef.current) {
      skipPropSyncRef.current = false;
      return;
    }
    setConfig(readConfig(node));
  }, [node.id, node.props.toolbarConfig]);

  const persistConfig = React.useCallback((
    updater: DesignerGridToolbarConfig | ((current: DesignerGridToolbarConfig) => DesignerGridToolbarConfig),
  ) => {
    setConfig((current) => {
      const nextConfig = typeof updater === 'function' ? updater(current) : updater;
      const normalized = normalizeDesignerGridToolbarConfig(nextConfig);
      skipPropSyncRef.current = true;
      dispatch({
        type: 'set-grid-toolbar-config',
        nodeId: node.id,
        config: normalized,
      });
      return normalized;
    });
  }, [dispatch, node.id]);

  const applyStandardPreset = () => {
    persistConfig(DEFAULT_GRID_TOOLBAR_PRESET);
  };

  const syncColumnFiltersFromGrid = () => {
    const columnFilters = buildServerQueryColumnFiltersFromGridColumns(gridColumns);
    persistConfig((current) => ({
      ...current,
      serverQuery: {
        ...(current.serverQuery ?? DEFAULT_GRID_SERVER_QUERY_CONFIG),
        enabled: true,
        columnFilters,
      },
    }));
  };

  const updateFieldFilter = (
    filterId: string,
    patch: Partial<DesignerGridToolbarFieldFilterConfig>,
  ) => {
    persistConfig((current) => {
      const currentFilters = resolveEffectiveFieldFilters(current);
      return {
        ...current,
        fieldFilters: currentFilters.map((filter) => (
          filter.id === filterId ? { ...filter, ...patch } : filter
        )),
        roleFilters: undefined,
        paramFilters: undefined,
      };
    });
  };

  const createBehavior = config.create?.behavior;

  return (
    <DesignerFieldRow label="Page Toolbar" layout="stack" align="start">
      <div className="flex w-full flex-col gap-2" {...preventInspectorDetailsToggle}>
        <AppSurfaceBox
          tone="cyan"
          title="Grid page toolbar"
          layout="panel"
          collapsible
          defaultOpen
          headerExtra={(
            <InspectorSectionValueBadge
              active={config.enabled === true}
              label="On"
            />
          )}
        >
          <div className="flex flex-col gap-2">
            <InspectorToggleChipGroup
              aria-label="Toolbar enabled"
              options={[{ key: 'enabled', label: 'Enable toolbar' }]}
              activeKeys={new Set(config.enabled === true ? ['enabled'] : [])}
              onToggle={() => persistConfig((current) => ({
                ...current,
                enabled: !(current.enabled === true),
              }))}
            />

            {config.enabled ? (
              <>
                <InspectorToggleChipGroup
                  aria-label="Toolbar feature flags"
                  options={[
                    { key: 'search', label: 'Search input' },
                    { key: 'create', label: 'Create button' },
                    { key: 'refresh', label: 'Refresh button' },
                    { key: 'export', label: 'Export button (CSV / Excel / PDF)' },
                    { key: 'serverQuery', label: 'Sync filters to API (server mode)' },
                  ]}
                  activeKeys={new Set([
                    ...(config.search?.enabled === true ? ['search'] as const : []),
                    ...(config.create?.enabled === true ? ['create'] as const : []),
                    ...(config.refresh?.enabled === true ? ['refresh'] as const : []),
                    ...(config.export?.enabled === true || config.showExportButton === true ? ['export'] as const : []),
                    ...(config.serverQuery?.enabled === true ? ['serverQuery'] as const : []),
                  ])}
                  onToggle={(key) => {
                    if (key === 'search') {
                      persistConfig((current) => {
                        const checked = !(current.search?.enabled === true);
                        return {
                          ...current,
                          search: {
                            ...(current.search ?? { enabled: false }),
                            enabled: checked,
                            placeholder: current.search?.placeholder ?? '…',
                            storePath: current.search?.storePath ?? 'gridToolbar.search',
                            apiParam: current.search?.apiParam ?? 'search',
                          },
                          ...(checked ? {
                            serverQuery: {
                              ...(current.serverQuery ?? DEFAULT_GRID_SERVER_QUERY_CONFIG),
                              enabled: true,
                            },
                          } : {}),
                        };
                      });
                      return;
                    }
                    if (key === 'create') {
                      persistConfig((current) => {
                        const checked = !(current.create?.enabled === true);
                        return {
                          ...current,
                          create: {
                            ...(current.create ?? { enabled: false }),
                            enabled: checked,
                            label: current.create?.label ?? 'Add',
                            icon: current.create?.icon ?? 'Plus',
                          },
                        };
                      });
                      return;
                    }
                    if (key === 'refresh') {
                      persistConfig((current) => ({
                        ...current,
                        refresh: { enabled: !(current.refresh?.enabled === true) },
                      }));
                      return;
                    }
                    if (key === 'export') {
                      persistConfig((current) => {
                        const checked = !(current.export?.enabled === true || current.showExportButton === true);
                        return {
                          ...current,
                          export: checked ? { enabled: true, defaultFormat: 'csv' } : undefined,
                          showExportButton: checked,
                        };
                      });
                      return;
                    }
                    if (key === 'serverQuery') {
                      persistConfig((current) => ({
                        ...current,
                        serverQuery: {
                          ...(current.serverQuery ?? DEFAULT_GRID_SERVER_QUERY_CONFIG),
                          enabled: !(current.serverQuery?.enabled === true),
                        },
                      }));
                    }
                  }}
                />

                {config.search?.enabled ? (
                  <div className="flex flex-col gap-[2px]">
                    <InspectorMicroLabel>Search placeholder</InspectorMicroLabel>
                    <UiInput
                      size="md"
                      className="w-full bg-white text-slate-700"
                      value={config.search.placeholder ?? ''}
                      onChange={(event) => persistConfig((current) => ({
                        ...current,
                        search: {
                          ...current.search!,
                          placeholder: event.target.value,
                        },
                      }))}
                      ariaLabel="Toolbar search placeholder"
                    />
                    <InspectorMicroLabel className="pt-2">Search debounce (ms)</InspectorMicroLabel>
                    <UiInput
                      size="md"
                      type="number"
                      autoDir={false}
                      className="w-full bg-white text-slate-700"
                      value={config.search.debounceMs ?? 300}
                      onChange={(event) => persistConfig((current) => ({
                        ...current,
                        search: {
                          ...current.search!,
                          debounceMs: Math.max(0, Number(event.target.value) || 0),
                        },
                      }))}
                      ariaLabel="Toolbar search debounce"
                    />
                  </div>
                ) : null}

                <div className={`flex flex-col gap-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white/70 p-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`${INSPECTOR_TEXT_XS} font-semibold text-slate-700`}>Field Filters</span>
                    <AppButton
                      type="button"
                      size="sm"
                      intent="secondary"
                      onClick={() => persistConfig((current) => {
                        const currentFilters = resolveEffectiveFieldFilters(current);
                        return {
                          ...current,
                          fieldFilters: [
                            ...currentFilters,
                            createEmptyFieldFilter(currentFilters.length, currentFilters),
                          ],
                          roleFilters: undefined,
                          paramFilters: undefined,
                          serverQuery: {
                            ...(current.serverQuery ?? DEFAULT_GRID_SERVER_QUERY_CONFIG),
                            enabled: true,
                          },
                        };
                      })}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Filter
                    </AppButton>
                  </div>

                  {fieldFilters.length === 0 ? (
                    <p className={`${INSPECTOR_TEXT_2XS} text-slate-500`}>
                      Add checkbox or radio filters for any data-source field (with optional AND/OR match logic).
                    </p>
                  ) : null}

                  {fieldFilters.map((filter) => {
                    const optionsText = (filter.options ?? [])
                      .map((option) => option.value)
                      .join(', ');
                    return (
                      <div
                        key={filter.id}
                        className="flex flex-col gap-2 rounded border border-slate-100 bg-slate-50/80 p-2"
                        data-testid={`inspector-grid-toolbar-field-filter-${filter.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`${INSPECTOR_TEXT_2XS} font-semibold uppercase tracking-wide text-slate-500`}>
                            {filter.label || filter.field || filter.id}
                          </span>
                          <AppButton
                            type="button"
                            size="sm"
                            intent="destructive"
                            onClick={() => persistConfig((current) => ({
                              ...current,
                              fieldFilters: resolveEffectiveFieldFilters(current)
                                .filter((entry) => entry.id !== filter.id),
                              roleFilters: undefined,
                              paramFilters: undefined,
                            }))}
                            aria-label={`Remove filter ${filter.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </AppButton>
                        </div>

                        <InspectorFieldGroup columns={2}>
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Field</InspectorMicroLabel>
                            <UiInput
                              size="md"
                              nested
                              className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
                              value={filter.field}
                              onChange={(event) => updateFieldFilter(filter.id, {
                                field: event.target.value,
                              })}
                              ariaLabel={`${filter.id} field`}
                              autoDir={false}
                            />
                          </div>
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Label</InspectorMicroLabel>
                            <UiInput
                              size="md"
                              nested
                              className="w-full bg-white text-slate-700"
                              value={filter.label}
                              onChange={(event) => updateFieldFilter(filter.id, {
                                label: event.target.value,
                              })}
                              ariaLabel={`${filter.id} label`}
                            />
                          </div>
                        </InspectorFieldGroup>

                        <InspectorFieldGroup columns={2}>
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Control</InspectorMicroLabel>
                            <UiSelect
                              size="md"
                              nested
                              className="w-full bg-white text-slate-700"
                              value={filter.controlType}
                              onChange={(event) => {
                                const controlType = event.target.value as DesignerGridToolbarFieldFilterConfig['controlType'];
                                updateFieldFilter(filter.id, {
                                  controlType,
                                  ...(controlType === 'checkbox-group'
                                    ? {
                                      matchLogic: filter.matchLogic ?? DEFAULT_FILTER_MATCH_LOGIC,
                                      matchLogicApiParam: filter.matchLogicApiParam,
                                      matchLogicStorePath: filter.matchLogicStorePath,
                                    }
                                    : {
                                      matchLogic: undefined,
                                      matchLogicApiParam: undefined,
                                      matchLogicStorePath: undefined,
                                    }),
                                });
                              }}
                            >
                              {CONTROL_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </UiSelect>
                          </div>
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Options source</InspectorMicroLabel>
                            <UiSelect
                              size="md"
                              nested
                              className="w-full bg-white text-slate-700"
                              value={filter.optionsSource}
                              onChange={(event) => updateFieldFilter(filter.id, {
                                optionsSource: event.target.value as DesignerGridToolbarFieldFilterConfig['optionsSource'],
                              })}
                            >
                              {OPTIONS_SOURCE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </UiSelect>
                          </div>
                        </InspectorFieldGroup>

                        {filter.optionsSource === 'lov' ? (
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Shared LOV</InspectorMicroLabel>
                            <UiSelect
                              size="md"
                              nested
                              className="w-full bg-white text-slate-700"
                              value={filter.lovRef ?? ''}
                              onChange={(event) => updateFieldFilter(filter.id, {
                                lovRef: event.target.value,
                              })}
                            >
                              <option value="">Select a shared LOV…</option>
                              {lovEntries.map((lov) => (
                                <option key={lov.id} value={lov.id}>{lov.name}</option>
                              ))}
                            </UiSelect>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>
                              Options (comma-separated values)
                            </InspectorMicroLabel>
                            <UiInput
                              size="md"
                              nested
                              className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
                              placeholder="e.g. ADMIN, USER"
                              value={optionsText}
                              onChange={(event) => {
                                const options = event.target.value
                                  .split(',')
                                  .map((entry) => entry.trim())
                                  .filter(Boolean)
                                  .map((value) => ({ value, label: value }));
                                updateFieldFilter(filter.id, { options });
                              }}
                              ariaLabel={`${filter.id} options`}
                              autoDir={false}
                            />
                          </div>
                        )}

                        {filter.controlType === 'checkbox-group' ? (
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Match logic</InspectorMicroLabel>
                            <UiSelect
                              size="md"
                              nested
                              className="w-full bg-white text-slate-700"
                              value={filter.matchLogic ?? DEFAULT_FILTER_MATCH_LOGIC}
                              onChange={(event) => updateFieldFilter(filter.id, {
                                matchLogic: event.target.value as FilterMatchLogic,
                              })}
                            >
                              {MATCH_LOGIC_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </UiSelect>
                          </div>
                        ) : null}

                        <InspectorFieldGroup columns={2}>
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>API param</InspectorMicroLabel>
                            <UiInput
                              size="md"
                              nested
                              className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
                              value={filter.apiParam}
                              onChange={(event) => updateFieldFilter(filter.id, {
                                apiParam: event.target.value,
                              })}
                              ariaLabel={`${filter.id} api param`}
                              autoDir={false}
                            />
                          </div>
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Store path</InspectorMicroLabel>
                            <UiInput
                              size="md"
                              nested
                              className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
                              value={filter.storePath}
                              onChange={(event) => updateFieldFilter(filter.id, {
                                storePath: event.target.value,
                              })}
                              ariaLabel={`${filter.id} store path`}
                              autoDir={false}
                            />
                          </div>
                        </InspectorFieldGroup>
                      </div>
                    );
                  })}
                </div>

                {config.create?.enabled ? (
                  <>
                    <div className="flex flex-col gap-[2px]">
                      <InspectorMicroLabel>Create label</InspectorMicroLabel>
                      <UiInput
                        size="md"
                        className="w-full bg-white text-slate-700"
                        value={config.create.label ?? ''}
                        onChange={(event) => persistConfig((current) => ({
                          ...current,
                          create: {
                            ...current.create!,
                            label: event.target.value,
                          },
                        }))}
                        ariaLabel="Toolbar create button label"
                      />
                    </div>
                    <InspectorLucideIconPickerField
                      label="Create icon"
                      value={config.create.icon ?? 'Plus'}
                      onChange={(icon) => persistConfig((current) => ({
                        ...current,
                        create: {
                          ...current.create!,
                          icon,
                        },
                      }))}
                      ariaLabel="Toolbar create icon"
                    />
                    <div className="flex flex-col gap-[2px]">
                      <InspectorMicroLabel>On click</InspectorMicroLabel>
                      <UiSelect
                        size="md"
                        className="w-full bg-white text-slate-700"
                        value={createBehavior?.kind ?? 'none'}
                        onChange={(event) => {
                          const nextKind = event.target.value as DesignerGridRowActionBehaviorKind;
                          persistConfig((current) => ({
                            ...current,
                            create: {
                              ...current.create!,
                              behavior: {
                                kind: nextKind,
                                ...(nextKind === 'open-modal' && modalNodes[0]
                                  ? { modalNodeId: modalNodes[0].id }
                                  : {}),
                              },
                            },
                          }));
                        }}
                      >
                        {BEHAVIOR_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </UiSelect>
                    </div>
                    {createBehavior?.kind === 'open-modal' ? (
                      <div className="flex flex-col gap-[2px]">
                        <InspectorMicroLabel>Create modal</InspectorMicroLabel>
                        <UiSelect
                          size="md"
                          className="w-full bg-white text-slate-700"
                          value={createBehavior.modalNodeId ?? ''}
                          onChange={(event) => persistConfig((current) => ({
                            ...current,
                            create: {
                              ...current.create!,
                              behavior: {
                                ...createBehavior,
                                modalNodeId: event.target.value,
                              },
                            },
                          }))}
                        >
                          <option value="">Select modal…</option>
                          {modalNodes.map((modalNode) => (
                            <option key={modalNode.id} value={modalNode.id}>
                              {typeof modalNode.props.title === 'string' && modalNode.props.title.trim().length > 0
                                ? modalNode.props.title
                                : modalNode.id}
                            </option>
                          ))}
                        </UiSelect>
                      </div>
                    ) : null}
                  </>
                ) : null}

                <div className={`flex flex-col gap-[2px] rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/80 p-2`}>
                  <span className={`ps-[4px] ${INSPECTOR_TEXT_2XS} font-semibold uppercase tracking-[0.08em] text-slate-500`}>
                    Bulk actions
                  </span>
                  <p className={`ps-[4px] ${INSPECTOR_TEXT_XS} leading-snug text-slate-600`}>
                    Shown when Selection Mode is multiple/single and at least one row is selected.
                    Each action runs its Dynamic Action chain per selected primary key.
                  </p>
                  <UiInput
                    size="sm"
                    nested
                    className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
                    autoDir={false}
                    value={config.selectionStorePath ?? 'gridSelection.selectedKeys'}
                    onChange={(event) => persistConfig((current) => ({
                      ...current,
                      selectionStorePath: event.target.value.trim() || undefined,
                    }))}
                    ariaLabel="Selection store path"
                  />
                  <AppButton
                    type="button"
                    size="sm"
                    intent="secondary"
                    onClick={() => persistConfig((current) => ({
                      ...current,
                      bulkActions: [
                        ...(current.bulkActions ?? []),
                        {
                          id: `bulk-${Date.now().toString(36)}`,
                          label: 'Delete selected',
                          icon: 'Trash2',
                          actions: [{
                            id: `act-${Date.now().toString(36)}`,
                            type: 'callMutation' as const,
                            mutationOperation: 'delete',
                            mutationRecordIdStorePath: 'gridSelection.activeId',
                          }],
                          runPerSelectedKey: true,
                        },
                      ],
                    }))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add bulk action
                  </AppButton>
                  {(config.bulkActions ?? []).map((action) => (
                    <div key={action.id} className="flex items-center gap-2">
                      <UiInput
                        size="sm"
                        nested
                        className={`w-full bg-white ${INSPECTOR_TEXT_XS}`}
                        value={action.label}
                        onChange={(event) => persistConfig((current) => ({
                          ...current,
                          bulkActions: (current.bulkActions ?? []).map((entry) => (
                            entry.id === action.id
                              ? { ...entry, label: event.target.value }
                              : entry
                          )),
                        }))}
                        ariaLabel={`Bulk action ${action.id} label`}
                      />
                      <AppButton
                        type="button"
                        size="sm"
                        intent="destructive-soft"
                        aria-label={`Remove bulk action ${action.label}`}
                        onClick={() => persistConfig((current) => ({
                          ...current,
                          bulkActions: (current.bulkActions ?? []).filter((entry) => entry.id !== action.id),
                        }))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </AppButton>
                    </div>
                  ))}
                </div>

                {config.serverQuery?.enabled ? (
                  <AppButton type="button" size="sm" intent="secondary" onClick={syncColumnFiltersFromGrid}>
                    <Columns3 className="h-3.5 w-3.5" />
                    Map column filters from grid
                  </AppButton>
                ) : null}
              </>
            ) : null}

            <AppButton type="button" size="sm" intent="secondary" onClick={applyStandardPreset}>
              <LayoutTemplate className="h-3.5 w-3.5" />
              Apply standard toolbar preset
            </AppButton>
          </div>
        </AppSurfaceBox>
      </div>
    </DesignerFieldRow>
  );
};
