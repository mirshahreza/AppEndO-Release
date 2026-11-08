import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerDynamicAction,
  DesignerDynamicActionType,
} from '../../../domain/component-designer/types';
import {
  createDynamicAction,
  defaultSetValueStorePathForNode,
  DESIGNER_TOAST_VARIANTS,
  listDocumentNodeOptions,
  sanitizeTrueActions,
} from '../../../domain/component-designer/bindingDynamicActionsEngine';
import { listCallMutationOperationOptions } from '../../../domain/component-designer/bindingResourceModel';
import type { DesignerToastVariant } from '../../../domain/component-designer/types';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiCheckbox, UiInput, UiSelect } from '../../../shared/ui';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { DesignerFieldRow } from './DesignerFieldRow';
import { InspectorKeyValueListField } from './InspectorKeyValueListField';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import { INSPECTOR_TEXT_SM, INSPECTOR_TEXT_XS, NESTED_LAYER_DIVIDER_CLASS } from './inspectorDesignTokens';

type InspectorDynamicActionsFieldProps = {
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  trueActions: DesignerDynamicAction[];
  onChange: (nextActions: DesignerDynamicAction[]) => void;
};

const ACTION_TYPE_OPTIONS: Array<{ value: DesignerDynamicActionType; label: string }> = [
  { value: 'setValue', label: 'Set Value' },
  { value: 'showHide', label: 'Show / Hide' },
  { value: 'showToast', label: 'Show Toast' },
  { value: 'callMutation', label: 'Call Mutation' },
  { value: 'refreshDataSource', label: 'Refresh Data Source' },
  { value: 'resetForm', label: 'Reset Form' },
  { value: 'navigate', label: 'Navigate' },
  { value: 'updateFilterFromClick', label: 'Update Filter From Click' },
  { value: 'exportData', label: 'Export Data' },
  { value: 'triggerWorkflow', label: 'Trigger Workflow' },
];

const SHOW_HIDE_OPTIONS = [
  { value: 'show', label: 'Show' },
  { value: 'hide', label: 'Hide' },
  { value: 'toggle', label: 'Toggle' },
] as const;

const TOAST_VARIANT_OPTIONS: Array<{ value: DesignerToastVariant; label: string }> = DESIGNER_TOAST_VARIANTS.map(
  (variant) => ({
    value: variant,
    label: variant.charAt(0).toUpperCase() + variant.slice(1),
  }),
);

export const InspectorDynamicActionsField: React.FC<InspectorDynamicActionsFieldProps> = ({
  document,
  bindingDefinitions,
  trueActions,
  onChange,
}) => {
  const nodeOptions = React.useMemo(() => listDocumentNodeOptions(document), [document]);
  const dataSourceOptions = React.useMemo(
    () => Object.values(bindingDefinitions.dataSources),
    [bindingDefinitions.dataSources],
  );

  const updateAction = (actionId: string, updater: (action: DesignerDynamicAction) => DesignerDynamicAction) => {
    const nextActions = trueActions.map((action) => (action.id === actionId ? updater(action) : action));
    onChange(sanitizeTrueActions(nextActions));
  };

  const removeAction = (actionId: string) => {
    onChange(trueActions.filter((action) => action.id !== actionId));
  };

  const addAction = (type: DesignerDynamicActionType) => {
    onChange([...trueActions, createDynamicAction(type)]);
  };

  return (
    <div className="space-y-2" {...preventInspectorDetailsToggle}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-[2px]">
          <span className={`ps-[4px] ${INSPECTOR_TEXT_XS} font-semibold text-slate-700`}>True Actions</span>
          <span className={`ps-[4px] ${INSPECTOR_TEXT_XS} text-slate-500`}>
            Declarative steps executed when this event fires.
          </span>
        </div>
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          className={`h-7 px-2 ${INSPECTOR_TEXT_XS}`}
          onClick={() => addAction('setValue')}
        >
          <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
          Add Action
        </AppButton>
      </div>

      {trueActions.length === 0 ? (
        <p
          className={`rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-3 text-center ${INSPECTOR_TEXT_SM} text-slate-500`}
        >
          No dynamic actions yet. Add Set Value, Show/Hide, Show Toast, Call Mutation, Refresh Data Source, Reset Form,
          Navigate, or Export Data steps.
        </p>
      ) : (
        <div className="space-y-2">
          {trueActions.map((action, index) => (
            <div key={action.id} className={`rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2.5`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className={`ps-[4px] ${INSPECTOR_TEXT_XS} font-semibold uppercase tracking-[0.08em] text-slate-600`}
                >
                  Action {index + 1}
                </span>
                <AppButton
                  type="button"
                  size="icon-sm"
                  className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS}`}
                  aria-label="Remove dynamic action"
                  onClick={() => removeAction(action.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </AppButton>
              </div>

              <div className="space-y-2">
                <DesignerFieldRow label="Action">
                  <UiSelect
                    size="sm"
                    nested
                    className="w-full"
                    value={action.type}
                    onChange={(event) => {
                      const nextType = event.target.value as DesignerDynamicActionType;
                      updateAction(action.id, () => createDynamicAction(nextType));
                    }}
                  >
                    {ACTION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </UiSelect>
                </DesignerFieldRow>

                {action.type === 'refreshDataSource' ? (
                  <DesignerFieldRow label="Data Source">
                    <UiSelect
                      size="sm"
                      nested
                      className="w-full"
                      value={action.dataSourceRef ?? ''}
                      onChange={(event) => {
                        updateAction(action.id, (current) => ({
                          ...current,
                          dataSourceRef: event.target.value,
                        }));
                      }}
                    >
                      <option value="">Select data source</option>
                      {dataSourceOptions.map((dataSource) => (
                        <option key={dataSource.id} value={dataSource.id}>
                          {dataSource.name}
                        </option>
                      ))}
                    </UiSelect>
                  </DesignerFieldRow>
                ) : null}

                {action.type === 'setValue' ? (
                  <>
                    <DesignerFieldRow label="Target Node">
                      <UiSelect
                        size="sm"
                        nested
                        className="w-full"
                        value={action.targetNodeId ?? ''}
                        onChange={(event) => {
                          const targetNodeId = event.target.value;
                          const storePath = defaultSetValueStorePathForNode(targetNodeId);
                          updateAction(action.id, (current) => ({
                            ...current,
                            targetNodeId,
                            storePath,
                          }));
                        }}
                      >
                        <option value="">Select node</option>
                        {nodeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </UiSelect>
                    </DesignerFieldRow>

                    <DesignerFieldRow label="Store Path">
                      <UiInput
                        size="sm"
                        nested
                        value={
                          action.storePath ??
                          (action.targetNodeId ? defaultSetValueStorePathForNode(action.targetNodeId) : '')
                        }
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            storePath: event.target.value,
                          }));
                        }}
                      />
                    </DesignerFieldRow>

                    <DesignerFieldRow label="Value Source">
                      <UiSelect
                        size="sm"
                        nested
                        className="w-full"
                        value={action.valueSource ?? 'static'}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            valueSource: event.target.value as 'static' | 'expression',
                          }));
                        }}
                      >
                        <option value="static">Static</option>
                        <option value="expression">Expression</option>
                      </UiSelect>
                    </DesignerFieldRow>

                    {action.valueSource === 'expression' ? (
                      <DesignerFieldRow label="Expression">
                        <UiInput
                          size="sm"
                          nested
                          placeholder="event.target.value"
                          value={action.valueExpression ?? ''}
                          onChange={(event) => {
                            updateAction(action.id, (current) => ({
                              ...current,
                              valueExpression: event.target.value,
                            }));
                          }}
                        />
                      </DesignerFieldRow>
                    ) : (
                      <DesignerFieldRow label="Static Value">
                        <UiInput
                          size="sm"
                          nested
                          value={action.staticValue ?? ''}
                          onChange={(event) => {
                            updateAction(action.id, (current) => ({
                              ...current,
                              staticValue: event.target.value,
                            }));
                          }}
                        />
                      </DesignerFieldRow>
                    )}
                  </>
                ) : null}

                {action.type === 'showHide' ? (
                  <>
                    <DesignerFieldRow label="Target Node">
                      <UiSelect
                        size="sm"
                        nested
                        className="w-full"
                        value={action.targetNodeId ?? ''}
                        onChange={(event) => {
                          const targetNodeId = event.target.value;
                          updateAction(action.id, (current) => ({
                            ...current,
                            targetNodeId,
                          }));
                        }}
                      >
                        <option value="">Select node</option>
                        {nodeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </UiSelect>
                    </DesignerFieldRow>

                    <DesignerFieldRow label="Effect">
                      <UiSelect
                        size="sm"
                        nested
                        className="w-full"
                        value={action.showHideEffect ?? 'show'}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            showHideEffect: event.target.value as 'show' | 'hide' | 'toggle',
                          }));
                        }}
                      >
                        {SHOW_HIDE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </UiSelect>
                    </DesignerFieldRow>
                  </>
                ) : null}

                {action.type === 'showToast' ? (
                  <>
                    <DesignerFieldRow label="Title">
                      <UiInput
                        size="sm"
                        nested
                        value={action.toastTitle ?? ''}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            toastTitle: event.target.value,
                          }));
                        }}
                      />
                    </DesignerFieldRow>

                    <DesignerFieldRow label="Description">
                      <UiInput
                        size="sm"
                        nested
                        value={action.toastDescription ?? ''}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            toastDescription: event.target.value,
                          }));
                        }}
                      />
                    </DesignerFieldRow>

                    <DesignerFieldRow label="Variant">
                      <UiSelect
                        size="sm"
                        nested
                        className="w-full"
                        value={action.toastVariant ?? 'default'}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            toastVariant: event.target.value as DesignerToastVariant,
                          }));
                        }}
                      >
                        {TOAST_VARIANT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </UiSelect>
                    </DesignerFieldRow>

                    <DesignerFieldRow label="Duration (ms)">
                      <UiInput
                        size="sm"
                        nested
                        type="number"
                        value={action.toastDuration != null ? String(action.toastDuration) : ''}
                        onChange={(event) => {
                          const raw = event.target.value.trim();
                          const parsed = Number(raw);
                          updateAction(action.id, (current) => ({
                            ...current,
                            toastDuration: raw.length > 0 && Number.isFinite(parsed) ? parsed : undefined,
                          }));
                        }}
                      />
                    </DesignerFieldRow>
                  </>
                ) : null}

                {action.type === 'callMutation' ? (
                  <>
                    <DesignerFieldRow label="Data Source">
                      <UiSelect
                        size="sm"
                        nested
                        className="w-full"
                        value={action.dataSourceRef ?? ''}
                        onChange={(event) => {
                          const nextRef = event.target.value;
                          const nextDataSource = nextRef ? bindingDefinitions.dataSources[nextRef] : undefined;
                          const operationOptions = listCallMutationOperationOptions(nextDataSource);
                          const currentOp = action.mutationOperation ?? 'delete';
                          const stillValid = operationOptions.some((option) => option.value === currentOp);
                          updateAction(action.id, (current) => ({
                            ...current,
                            dataSourceRef: nextRef,
                            mutationOperation: stillValid ? currentOp : (operationOptions[0]?.value ?? 'delete'),
                          }));
                        }}
                      >
                        <option value="">Select data source</option>
                        {dataSourceOptions.map((dataSource) => (
                          <option key={dataSource.id} value={dataSource.id}>
                            {dataSource.name}
                          </option>
                        ))}
                      </UiSelect>
                    </DesignerFieldRow>

                    <DesignerFieldRow label="Operation">
                      <UiSelect
                        size="sm"
                        nested
                        className="w-full"
                        value={action.mutationOperation ?? 'delete'}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            mutationOperation: event.target.value,
                          }));
                        }}
                      >
                        {listCallMutationOperationOptions(
                          action.dataSourceRef ? bindingDefinitions.dataSources[action.dataSourceRef] : undefined,
                        ).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </UiSelect>
                    </DesignerFieldRow>

                    <DesignerFieldRow label="Record ID from store path">
                      <UiInput
                        size="sm"
                        nested
                        placeholder="selection.id"
                        value={action.mutationRecordIdStorePath ?? ''}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            mutationRecordIdStorePath: event.target.value,
                          }));
                        }}
                      />
                    </DesignerFieldRow>
                  </>
                ) : null}

                {action.type === 'resetForm' ? (
                  <DesignerFieldRow label="Target Node (form / region)">
                    <UiSelect
                      size="sm"
                      nested
                      className="w-full"
                      value={action.targetNodeId ?? ''}
                      onChange={(event) => {
                        updateAction(action.id, (current) => ({
                          ...current,
                          targetNodeId: event.target.value,
                        }));
                      }}
                    >
                      <option value="">Select node</option>
                      {nodeOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </UiSelect>
                  </DesignerFieldRow>
                ) : null}

                {action.type === 'navigate' ? (
                  <>
                    <DesignerFieldRow
                      label="Target path"
                      hint="Supports {store.x} / {selection.id} placeholders resolved from designer store."
                    >
                      <UiInput
                        size="sm"
                        nested
                        placeholder="/orders/{selection.id}"
                        value={action.navigateTarget ?? ''}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            navigateTarget: event.target.value,
                          }));
                        }}
                      />
                    </DesignerFieldRow>
                    <UiCheckbox
                      size="sm"
                      checked={action.navigateReplace === true}
                      onChange={(event) => {
                        updateAction(action.id, (current) => ({
                          ...current,
                          navigateReplace: event.target.checked,
                        }));
                      }}
                    >
                      Replace history (no back entry)
                    </UiCheckbox>
                  </>
                ) : null}

                {action.type === 'updateFilterFromClick' ? (
                  <>
                    <DesignerFieldRow label="Filter store path">
                      <UiInput
                        size="sm"
                        nested
                        placeholder="dashboardFilters.category"
                        autoDir={false}
                        value={action.filterStorePath ?? ''}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            filterStorePath: event.target.value,
                          }));
                        }}
                      />
                    </DesignerFieldRow>
                    <DesignerFieldRow label="Value from click">
                      <UiSelect
                        size="sm"
                        nested
                        value={action.filterValueSource ?? 'clickCategory'}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            filterValueSource: event.target.value as DesignerDynamicAction['filterValueSource'],
                          }));
                        }}
                      >
                        <option value="clickCategory">Category (bar/segment label)</option>
                        <option value="clickSeriesKey">Series key</option>
                        <option value="expression">Expression</option>
                      </UiSelect>
                    </DesignerFieldRow>
                    {action.filterValueSource === 'expression' ? (
                      <DesignerFieldRow label="Expression">
                        <UiInput
                          size="sm"
                          nested
                          placeholder="event.target.category"
                          autoDir={false}
                          value={action.filterValueExpression ?? ''}
                          onChange={(event) => {
                            updateAction(action.id, (current) => ({
                              ...current,
                              filterValueExpression: event.target.value,
                            }));
                          }}
                        />
                      </DesignerFieldRow>
                    ) : null}
                  </>
                ) : null}

                {action.type === 'exportData' ? (
                  <>
                    <DesignerFieldRow label="Format">
                      <UiSelect
                        size="sm"
                        nested
                        className="w-full"
                        value={action.exportFormat ?? 'csv'}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            exportFormat: event.target.value as DesignerDynamicAction['exportFormat'],
                          }));
                        }}
                      >
                        <option value="csv">CSV (client-side)</option>
                        <option value="xlsx">Excel (server)</option>
                        <option value="pdf">PDF (server)</option>
                      </UiSelect>
                    </DesignerFieldRow>
                    <DesignerFieldRow label="Source">
                      <UiSelect
                        size="sm"
                        nested
                        className="w-full"
                        value={action.exportSource ?? 'gridListResource'}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            exportSource: event.target.value as DesignerDynamicAction['exportSource'],
                          }));
                        }}
                      >
                        <option value="gridListResource">Grid (filtered / sorted rows)</option>
                        <option value="chartDataResource">Chart data</option>
                      </UiSelect>
                    </DesignerFieldRow>
                    <DesignerFieldRow label="Filename">
                      <UiInput
                        size="sm"
                        nested
                        autoDir={false}
                        placeholder="export"
                        value={action.exportFilename ?? ''}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            exportFilename: event.target.value,
                          }));
                        }}
                      />
                    </DesignerFieldRow>
                  </>
                ) : null}

                {action.type === 'triggerWorkflow' ? (
                  <>
                    <DesignerFieldRow label="Workflow Definition ID">
                      <UiInput
                        size="sm"
                        nested
                        autoDir={false}
                        placeholder="42"
                        value={action.workflowDefinitionId ?? ''}
                        onChange={(event) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            workflowDefinitionId: event.target.value,
                          }));
                        }}
                      />
                    </DesignerFieldRow>
                    <DesignerFieldRow label="Payload mapping">
                      <InspectorKeyValueListField
                        value={action.payloadMapping}
                        onChange={(nextMapping) => {
                          updateAction(action.id, (current) => ({
                            ...current,
                            payloadMapping: nextMapping,
                          }));
                        }}
                        keyPlaceholder="orderId"
                        valuePlaceholder="selection.id"
                        addLabel="Add Mapping"
                        fieldLabel="Payload mapping"
                      />
                    </DesignerFieldRow>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
