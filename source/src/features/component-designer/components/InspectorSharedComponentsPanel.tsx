import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  DataSourceDefinition,
  DesignerAction,
  DesignerApiOperation,
  DesignerApiOperationMethod,
  DesignerBindingDefinitions,
  DesignerDataResourceKind,
  LovDefinition,
} from '../../../domain/component-designer/types';
import { buildDefaultRestOperations, dataSourceToResource } from '../../../domain/component-designer/bindingResourceModel';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiInput, UiSelect, UiTextarea } from '../../../shared/ui';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { DesignerFieldRow } from './DesignerFieldRow';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

type InspectorSharedComponentsPanelProps = {
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

type RegistryTab = 'resources' | 'options';

const RESOURCE_KIND_OPTIONS: Array<{ value: DesignerDataResourceKind; label: string }> = [
  { value: 'collection', label: 'Collection (list)' },
  { value: 'record', label: 'Single record' },
  { value: 'custom', label: 'Custom API' },
];

const API_METHOD_OPTIONS: DesignerApiOperationMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const createRegistryId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}`;

const createCustomOperationKey = (): string => `customOp_${Date.now().toString(36)}`;

const upsertCustomOperation = (
  dataSource: DataSourceDefinition,
  key: string,
  operation: DesignerApiOperation,
  previousKey?: string,
): DataSourceDefinition => {
  const nextCustom = { ...(dataSource.operations?.custom ?? {}) };
  if (previousKey && previousKey !== key) {
    delete nextCustom[previousKey];
  }
  nextCustom[key] = operation;
  return {
    ...dataSource,
    operations: {
      ...(dataSource.operations ?? {}),
      custom: nextCustom,
    },
  };
};

const removeCustomOperation = (
  dataSource: DataSourceDefinition,
  key: string,
): DataSourceDefinition => {
  const nextCustom = { ...(dataSource.operations?.custom ?? {}) };
  delete nextCustom[key];
  const nextOperations = { ...(dataSource.operations ?? {}) };
  if (Object.keys(nextCustom).length > 0) {
    nextOperations.custom = nextCustom;
  } else {
    delete nextOperations.custom;
  }
  return {
    ...dataSource,
    operations: Object.keys(nextOperations).length > 0 ? nextOperations : undefined,
  };
};

export const InspectorSharedComponentsPanel: React.FC<InspectorSharedComponentsPanelProps> = ({
  bindingDefinitions,
  dispatch,
}) => {
  const [activeTab, setActiveTab] = React.useState<RegistryTab>('resources');
  const dataSources: DataSourceDefinition[] = Object.values(bindingDefinitions.dataSources);
  const lovs: LovDefinition[] = Object.values(bindingDefinitions.lovs);

  const handleAddDataSource = () => {
    const dataSourceId = createRegistryId('datasource');
    dispatch({
      type: 'set-data-source',
      dataSourceId,
      dataSource: {
        id: dataSourceId,
        name: 'New Data Source',
        endpoint: '',
        fields: [],
      },
    });
  };

  const handleAddLov = () => {
    const lovId = createRegistryId('lov');
    dispatch({
      type: 'set-lov',
      lovId,
      lov: {
        id: lovId,
        name: 'New LOV',
        endpoint: '',
        displayValue: 'label',
        returnValue: 'id',
      },
    });
  };

  const updateDataSource = (
    dataSourceId: string,
    updater: (dataSource: DataSourceDefinition) => DataSourceDefinition,
  ) => {
    const current = bindingDefinitions.dataSources[dataSourceId];
    if (!current) {
      return;
    }

    dispatch({
      type: 'set-data-source',
      dataSourceId,
      dataSource: updater(current),
    });
  };

  const updateLov = (lovId: string, updater: (lov: LovDefinition) => LovDefinition) => {
    const current = bindingDefinitions.lovs[lovId];
    if (!current) {
      return;
    }

    dispatch({
      type: 'set-lov',
      lovId,
      lov: updater(current),
    });
  };

  const updateDataSourceFields = (dataSourceId: string, rawFields: string) => {
    const fields = rawFields
      .split(/[\n,]/)
      .map((field) => field.trim())
      .filter((field) => field.length > 0);

    updateDataSource(dataSourceId, (current) => ({ ...current, fields }));
  };

  return (
    <div className="space-y-3">
      <div className={`flex gap-1 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50 p-0.5`}>
        <button
          type="button"
          className={`flex-1 rounded px-2 py-1 ${INSPECTOR_TEXT_XS} font-semibold transition-colors ${activeTab === 'resources' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
          onClick={() => setActiveTab('resources')}
        >
          Resources
        </button>
        <button
          type="button"
          className={`flex-1 rounded px-2 py-1 ${INSPECTOR_TEXT_XS} font-semibold transition-colors ${activeTab === 'options' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
          onClick={() => setActiveTab('options')}
        >
          Options (LOV)
        </button>
      </div>

      {activeTab === 'resources' ? (
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>
            Shared API resources for forms, grids, and record contexts.
          </p>
          <AppButton
            type="button"
            intent="secondary"
            size="sm"
            className={`h-7 shrink-0 px-2 ${INSPECTOR_TEXT_XS}`}
            onClick={handleAddDataSource}
          >
            <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
            Add Resource
          </AppButton>
        </div>

        {dataSources.length === 0 ? (
          <p className={`rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-3 text-center ${INSPECTOR_TEXT_SM} text-slate-500`}>
            No resources yet. Add one such as <span className="font-medium text-slate-700">customers</span> or <span className="font-medium text-slate-700">orders</span>.
          </p>
        ) : (
          <div className="space-y-2">
            {dataSources.map((dataSource) => {
              const resource = dataSourceToResource(dataSource);
              const operations = resource.operations;

              return (
              <div key={dataSource.id} className={`rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2.5`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={`ps-[4px] ${INSPECTOR_TEXT_XS} font-semibold uppercase tracking-[0.08em] text-slate-600`}>Resource</span>
                  <AppButton
                    type="button"
                    size="icon-sm"
                    className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS}`}
                    aria-label={`Remove data source ${dataSource.id}`}
                    onClick={() => dispatch({ type: 'remove-data-source', dataSourceId: dataSource.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </AppButton>
                </div>

                <div className="space-y-2">
                  <DesignerFieldRow label="ID">
                    <UiInput
                      nested
                      size="sm"
                      value={dataSource.id}
                      onChange={(event) => {
                        const nextId = event.target.value.trim();
                        if (!nextId || nextId === dataSource.id) {
                          return;
                        }

                        dispatch({
                          type: 'rename-data-source',
                          previousDataSourceId: dataSource.id,
                          dataSourceId: nextId,
                          dataSource: { ...dataSource, id: nextId },
                        });
                      }}
                    />
                  </DesignerFieldRow>

                  <DesignerFieldRow label="Name">
                    <UiInput
                      nested
                      size="sm"
                      value={dataSource.name}
                      onChange={(event) =>
                        updateDataSource(dataSource.id, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </DesignerFieldRow>

                  <DesignerFieldRow label="Type">
                    <UiSelect
                      nested
                      size="sm"
                      className="w-full"
                      value={dataSource.kind ?? 'collection'}
                      onChange={(event) =>
                        updateDataSource(dataSource.id, (current) => ({
                          ...current,
                          kind: event.target.value as DesignerDataResourceKind,
                        }))
                      }
                    >
                      {RESOURCE_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </UiSelect>
                  </DesignerFieldRow>

                  <DesignerFieldRow label="Base Endpoint">
                    <UiInput
                      nested
                      size="sm"
                      placeholder="/api/countries"
                      value={dataSource.endpoint}
                      onChange={(event) => {
                        const endpoint = event.target.value;
                        updateDataSource(dataSource.id, (current) => ({
                          ...current,
                          endpoint,
                          operations: buildDefaultRestOperations(endpoint, current.primaryKey),
                        }));
                      }}
                    />
                  </DesignerFieldRow>

                  <DesignerFieldRow label="Primary Key">
                    <UiInput
                      nested
                      size="sm"
                      placeholder="id"
                      value={dataSource.primaryKey ?? ''}
                      onChange={(event) => {
                        const primaryKey = event.target.value.trim() || undefined;
                        updateDataSource(dataSource.id, (current) => ({
                          ...current,
                          primaryKey,
                          operations: buildDefaultRestOperations(current.endpoint, primaryKey),
                        }));
                      }}
                    />
                  </DesignerFieldRow>

                  <DesignerFieldRow label="Polling Interval (ms)">
                    <UiInput
                      nested
                      size="sm"
                      type="number"
                      placeholder="0 (disabled)"
                      value={dataSource.pollingIntervalMs !== undefined ? String(dataSource.pollingIntervalMs) : ''}
                      onChange={(event) => {
                        const val = event.target.value.trim();
                        const pollingIntervalMs = val.length > 0 && Number.isFinite(Number(val)) ? Number(val) : undefined;
                        updateDataSource(dataSource.id, (current) => ({
                          ...current,
                          pollingIntervalMs,
                        }));
                      }}
                    />
                  </DesignerFieldRow>

                  <DesignerFieldRow label="Live Mode">
                    <UiSelect
                      nested
                      size="sm"
                      className="w-full"
                      value={dataSource.liveMode?.type ?? 'none'}
                      onChange={(event) => {
                        const type = event.target.value as 'none' | 'sse' | 'websocket';
                        updateDataSource(dataSource.id, (current) => ({
                          ...current,
                          liveMode: type === 'none'
                            ? { type: 'none' }
                            : {
                              type,
                              channel: current.liveMode?.channel,
                            },
                        }));
                      }}
                    >
                      <option value="none">None (no push)</option>
                      <option value="sse">SSE (Server-Sent Events)</option>
                      <option value="websocket">WebSocket</option>
                    </UiSelect>
                  </DesignerFieldRow>

                  {(dataSource.liveMode?.type === 'sse' || dataSource.liveMode?.type === 'websocket') ? (
                    <DesignerFieldRow label="Live Channel">
                      <UiInput
                        nested
                        size="sm"
                        autoDir={false}
                        placeholder="optional topic filter"
                        value={dataSource.liveMode?.channel ?? ''}
                        onChange={(event) => {
                          const channel = event.target.value.trim() || undefined;
                          updateDataSource(dataSource.id, (current) => ({
                            ...current,
                            liveMode: {
                              type: current.liveMode?.type === 'websocket' ? 'websocket' : 'sse',
                              channel,
                            },
                          }));
                        }}
                      />
                    </DesignerFieldRow>
                  ) : null}

                  <DesignerFieldRow label="Fields" align="start">
                    <UiTextarea
                      nested
                      className={`min-h-[72px] font-mono ${INSPECTOR_TEXT_XS} text-slate-700`}
                      value={dataSource.fields.join('\n')}
                      placeholder={'id\ncode\nname'}
                      rows={3}
                      onChange={(event) => updateDataSourceFields(dataSource.id, event.target.value)}
                    />
                  </DesignerFieldRow>

                  <details className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/60`} open={Boolean(Object.keys(operations.custom ?? {}).length)}>
                    <summary className={`cursor-pointer list-none px-2 py-1.5 ${INSPECTOR_TEXT_XS} font-medium text-slate-700`}>
                      REST operations
                    </summary>
                    <div className="space-y-2 border-t border-slate-200 px-2 py-2">
                      <div className={`space-y-1 font-mono ${INSPECTOR_TEXT_2XS} text-slate-600`}>
                        {(['list', 'detail', 'create', 'update', 'delete'] as const).map((key) => {
                          const operation = operations[key];
                          if (!operation) {
                            return null;
                          }

                          return (
                            <p key={key}>
                              <span className="font-semibold uppercase text-slate-700">{key}:</span>{' '}
                              {operation.method} {operation.endpoint}
                            </p>
                          );
                        })}
                      </div>

                      <div className="space-y-2 border-t border-slate-200 pt-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`ps-[4px] ${INSPECTOR_TEXT_XS} font-medium text-slate-700`}>Custom named operations</p>
                          <AppButton
                            type="button"
                            intent="secondary"
                            size="sm"
                            className={`h-7 shrink-0 px-2 ${INSPECTOR_TEXT_XS}`}
                            onClick={() => {
                              updateDataSource(dataSource.id, (current) => {
                                const key = createCustomOperationKey();
                                return upsertCustomOperation(current, key, {
                                  method: 'POST',
                                  endpoint: `${current.endpoint.replace(/\/+$/, '')}/:id/${key}`,
                                  label: key,
                                });
                              });
                            }}
                          >
                            <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
                            Add
                          </AppButton>
                        </div>

                        {Object.entries(operations.custom ?? {}).length === 0 ? (
                          <p className={`ps-[4px] ${INSPECTOR_TEXT_XS} text-slate-500`}>
                            Add non-CRUD endpoints (reset password, lock, assign roles, …) for Call Mutation.
                          </p>
                        ) : (
                          Object.entries(operations.custom ?? {}).map(([customKey, customOperation]) => (
                            <div
                              key={customKey}
                              className={`space-y-1.5 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
                                  <div className="flex flex-col gap-[2px]">
                                    <span className={`ps-[4px] ${INSPECTOR_TEXT_2XS} text-slate-500`}>Key</span>
                                    <UiInput
                                      nested
                                      key={customKey}
                                      size="sm"
                                      autoDir={false}
                                      defaultValue={customKey}
                                      onBlur={(event) => {
                                        const nextKey = event.target.value.trim();
                                        if (!nextKey || nextKey === customKey) {
                                          return;
                                        }
                                        updateDataSource(dataSource.id, (current) => {
                                          const existing = current.operations?.custom?.[customKey];
                                          if (!existing || current.operations?.custom?.[nextKey]) {
                                            return current;
                                          }
                                          return upsertCustomOperation(current, nextKey, existing, customKey);
                                        });
                                      }}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-[2px]">
                                    <span className={`ps-[4px] ${INSPECTOR_TEXT_2XS} text-slate-500`}>Label</span>
                                    <UiInput
                                      nested
                                      size="sm"
                                      value={customOperation.label ?? ''}
                                      placeholder={customKey}
                                      onChange={(event) => {
                                        const label = event.target.value;
                                        updateDataSource(dataSource.id, (current) =>
                                          upsertCustomOperation(current, customKey, {
                                            ...customOperation,
                                            label: label.trim() || undefined,
                                          }));
                                      }}
                                    />
                                  </div>
                                </div>
                                <AppButton
                                  type="button"
                                  size="icon-sm"
                                  className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS} mt-4`}
                                  aria-label={`Remove custom operation ${customKey}`}
                                  onClick={() => {
                                    updateDataSource(dataSource.id, (current) =>
                                      removeCustomOperation(current, customKey));
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                                </AppButton>
                              </div>
                              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-1.5">
                                <div className="flex flex-col gap-[2px]">
                                  <span className={`ps-[4px] ${INSPECTOR_TEXT_2XS} text-slate-500`}>Method</span>
                                  <UiSelect
                                    nested
                                    size="sm"
                                    className="w-full"
                                    value={customOperation.method}
                                    onChange={(event) => {
                                      const method = event.target.value as DesignerApiOperationMethod;
                                      updateDataSource(dataSource.id, (current) =>
                                        upsertCustomOperation(current, customKey, {
                                          ...customOperation,
                                          method,
                                        }));
                                    }}
                                  >
                                    {API_METHOD_OPTIONS.map((method) => (
                                      <option key={method} value={method}>{method}</option>
                                    ))}
                                  </UiSelect>
                                </div>
                                <div className="flex flex-col gap-[2px]">
                                  <span className={`ps-[4px] ${INSPECTOR_TEXT_2XS} text-slate-500`}>Endpoint</span>
                                  <UiInput
                                    nested
                                    size="sm"
                                    autoDir={false}
                                    className={`font-mono ${INSPECTOR_TEXT_XS}`}
                                    value={customOperation.endpoint}
                                    placeholder="/api/users/:id/reset-password"
                                    onChange={(event) => {
                                      const endpoint = event.target.value;
                                      updateDataSource(dataSource.id, (current) =>
                                        upsertCustomOperation(current, customKey, {
                                          ...customOperation,
                                          endpoint,
                                        }));
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </details>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>
      ) : null}

      {activeTab === 'options' ? (
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>
            Options sources for Select, Dropdown, and Autocomplete components.
          </p>
          <AppButton
            type="button"
            intent="secondary"
            size="sm"
            className={`h-7 shrink-0 px-2 ${INSPECTOR_TEXT_XS}`}
            onClick={handleAddLov}
          >
            <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
            Add Options Source
          </AppButton>
        </div>

        {lovs.length === 0 ? (
          <p className={`rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-3 text-center ${INSPECTOR_TEXT_SM} text-slate-500`}>
            No options sources yet. Add one such as <span className="font-medium text-slate-700">countryOptions</span>.
          </p>
        ) : (
          <div className="space-y-2">
            {lovs.map((lov) => (
              <div key={lov.id} className={`rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2.5`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={`ps-[4px] ${INSPECTOR_TEXT_XS} font-semibold uppercase tracking-[0.08em] text-slate-600`}>Options Source</span>
                  <AppButton
                    type="button"
                    size="icon-sm"
                    className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS}`}
                    aria-label={`Remove LOV ${lov.id}`}
                    onClick={() => dispatch({ type: 'remove-lov', lovId: lov.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </AppButton>
                </div>

                <div className="space-y-2">
                  <DesignerFieldRow label="ID">
                    <UiInput
                      nested
                      size="sm"
                      value={lov.id}
                      onChange={(event) => {
                        const nextId = event.target.value.trim();
                        if (!nextId || nextId === lov.id) {
                          return;
                        }

                        dispatch({ type: 'remove-lov', lovId: lov.id });
                        dispatch({
                          type: 'set-lov',
                          lovId: nextId,
                          lov: { ...lov, id: nextId },
                        });
                      }}
                    />
                  </DesignerFieldRow>

                  <DesignerFieldRow label="Name">
                    <UiInput
                      nested
                      size="sm"
                      value={lov.name}
                      onChange={(event) =>
                        updateLov(lov.id, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </DesignerFieldRow>

                  <DesignerFieldRow label="Endpoint">
                    <UiInput
                      nested
                      size="sm"
                      placeholder="/api/base-info/options?root=100.1&lang=en"
                      value={lov.endpoint}
                      onChange={(event) =>
                        updateLov(lov.id, (current) => ({
                          ...current,
                          endpoint: event.target.value,
                        }))
                      }
                    />
                  </DesignerFieldRow>

                  <DesignerFieldRow label="Display Column">
                    <UiInput
                      nested
                      size="sm"
                      placeholder="label"
                      value={lov.displayValue}
                      onChange={(event) =>
                        updateLov(lov.id, (current) => ({
                          ...current,
                          displayValue: event.target.value,
                        }))
                      }
                    />
                  </DesignerFieldRow>

                  <DesignerFieldRow label="Return Column">
                    <UiInput
                      nested
                      size="sm"
                      placeholder="id"
                      value={lov.returnValue}
                      onChange={(event) =>
                        updateLov(lov.id, (current) => ({
                          ...current,
                          returnValue: event.target.value,
                        }))
                      }
                    />
                  </DesignerFieldRow>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      ) : null}
    </div>
  );
};
