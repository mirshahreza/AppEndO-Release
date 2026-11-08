import * as React from 'react';
import {
  ClipboardCheck,
  Link2,
  Wand2,
} from 'lucide-react';
import type { DataSourceDefinition, DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  buildDefaultFieldMappings,
  buildFormBindingWizardActions,
  collectBindableRegionFieldNodes,
  FORM_BINDING_ADVANCED_SCENARIOS,
  FORM_BINDING_PRIMARY_SCENARIOS,
  mergeResourceFieldsFromMappings,
  resolveFormWizardRecordFieldOptions,
  summarizeFormBindingPreview,
  type FormBindingScenario,
  type FormBindingSuccessBehavior,
  type FormFieldMappingDraft,
} from '../../../domain/component-designer/bindingResourceModel';
import { getDataSources } from '../../../domain/component-designer/bindingRegistry';
import { collectRegionBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import { getNodeRegionDataSourceRef } from '../../../domain/component-designer/bindingRegionEngine';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { StepWizardShell, type StepWizardStepDef } from '../../../shared/ui/StepWizardShell';
import { DesignerDialogHostContext } from '../../../shared/ui/designerDialogHostContext';
import { UiCheckbox, UiSelect } from '../../../shared/ui';
import { BindingHealthSummary } from './BindingHealthSummary';
import { BindingResourceQuickConnect } from './BindingResourceQuickConnect';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

const WIZARD_STEPS: readonly StepWizardStepDef[] = [
  {
    title: 'Connect',
    icon: Wand2,
    description: 'Choose what this form does and connect it to an API resource.',
  },
  {
    title: 'Map fields',
    icon: Link2,
    description: 'We auto-match inputs to resource fields — adjust anything that looks wrong.',
  },
  {
    title: 'Done',
    icon: ClipboardCheck,
    description: 'Review the request preview and apply.',
  },
];

const SUCCESS_OPTIONS: Array<{ value: Exclude<FormBindingSuccessBehavior, 'none'>; label: string }> = [
  { value: 'refresh', label: 'Refresh data after save (recommended)' },
  { value: 'toast', label: 'Show success toast' },
  { value: 'reset', label: 'Reset form fields' },
  { value: 'close', label: 'Close dialog' },
];

type BindingFormWizardDialogProps = {
  open: boolean;
  onClose: () => void;
  document: DesignerDocument;
  regionNode: DesignerNode;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

export const BindingFormWizardDialog: React.FC<BindingFormWizardDialogProps> = ({
  open,
  onClose,
  document,
  regionNode,
  bindingDefinitions,
  dispatch,
}) => {
  const dataSourceOptions = React.useMemo(
    () => Object.values(getDataSources(bindingDefinitions)),
    [bindingDefinitions],
  );

  const [step, setStep] = React.useState(0);
  const [scenario, setScenario] = React.useState<FormBindingScenario>('createEdit');
  const [showAdvancedScenarios, setShowAdvancedScenarios] = React.useState(false);
  const [dataSourceId, setDataSourceId] = React.useState(() => getNodeRegionDataSourceRef(regionNode) ?? dataSourceOptions[0]?.id ?? '');
  const [quickEndpoint, setQuickEndpoint] = React.useState('');
  const [fieldMappings, setFieldMappings] = React.useState<FormFieldMappingDraft[]>(() =>
    buildDefaultFieldMappings(document, regionNode.id, bindingDefinitions),
  );
  const [successBehaviors, setSuccessBehaviors] = React.useState<Array<Exclude<FormBindingSuccessBehavior, 'none'>>>(['refresh']);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [quickConnectSession, setQuickConnectSession] = React.useState(0);

  const bindableFieldNodes = React.useMemo(
    () => collectBindableRegionFieldNodes(document, regionNode.id, bindingDefinitions, { dataSourceId }),
    [bindingDefinitions, dataSourceId, document, regionNode.id],
  );

  const suggestedFields = React.useMemo(
    () => resolveFormWizardRecordFieldOptions(
      bindingDefinitions.dataSources[dataSourceId]?.fields ?? [],
      fieldMappings.filter((mapping) => mapping.enabled),
      bindableFieldNodes,
    ),
    [bindableFieldNodes, bindingDefinitions.dataSources, dataSourceId, fieldMappings],
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const existingRef = getNodeRegionDataSourceRef(regionNode);
    const existingSource = existingRef ? bindingDefinitions.dataSources[existingRef] : undefined;
    const initialSourceId = existingRef ?? dataSourceOptions[0]?.id ?? '';

    setStep(0);
    setScenario('createEdit');
    setShowAdvancedScenarios(false);
    setDataSourceId(initialSourceId);
    setQuickEndpoint(existingSource?.endpoint ?? '');
    setFieldMappings(buildDefaultFieldMappings(document, regionNode.id, bindingDefinitions, {
      dataSourceId: initialSourceId,
    }));
    setSuccessBehaviors(['refresh']);
    setValidationError(null);
    setQuickConnectSession((current) => current + 1);
  }, [open, regionNode.id, document, bindingDefinitions, dataSourceOptions]);

  React.useEffect(() => {
    if (!open || !dataSourceId) {
      return;
    }

    setFieldMappings(buildDefaultFieldMappings(document, regionNode.id, {
      ...bindingDefinitions,
      dataSources: {
        ...bindingDefinitions.dataSources,
        [dataSourceId]: mergeResourceFieldsFromMappings(
          bindingDefinitions.dataSources[dataSourceId] ?? {
            id: dataSourceId,
            name: dataSourceId,
            endpoint: '',
            fields: [],
          },
          suggestedFields,
        ),
      },
    }, { dataSourceId }));
  // Re-map when resource changes; suggestedFields intentionally excluded to avoid loops on every mapping edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dataSourceId, regionNode.id, document, bindingDefinitions]);

  const preview = React.useMemo(
    () => summarizeFormBindingPreview(document, bindingDefinitions, {
      scenario,
      regionNodeId: regionNode.id,
      dataSourceId,
      fieldMappings,
      successBehaviors,
      submitEventTarget: regionNode.type === 'html' ? 'onSubmit' : 'onClick',
    }),
    [bindingDefinitions, dataSourceId, document, fieldMappings, regionNode.id, regionNode.type, scenario, successBehaviors],
  );

  const health = React.useMemo(
    () => collectRegionBindingHealth(document, bindingDefinitions, regionNode),
    [bindingDefinitions, document, regionNode],
  );

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0 && !dataSourceId.trim()) {
      setValidationError('Connect an API path or select a resource before continuing.');
      return false;
    }

    if (stepIndex === 1 && fieldMappings.filter((mapping) => mapping.enabled && mapping.column.trim()).length === 0) {
      setValidationError('Enable at least one field mapping.');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleNext = (): boolean => validateStep(step);

  const upsertDataSource = (dataSource: DataSourceDefinition) => {
    dispatch({
      type: 'set-data-source',
      dataSourceId: dataSource.id,
      dataSource,
    });
    setDataSourceId(dataSource.id);
    setFieldMappings(buildDefaultFieldMappings(document, regionNode.id, {
      ...bindingDefinitions,
      dataSources: {
        ...bindingDefinitions.dataSources,
        [dataSource.id]: dataSource,
      },
    }, { dataSourceId: dataSource.id }));
  };

  const handleApply = () => {
    if (!dataSourceId.trim()) {
      setValidationError('Resource is required.');
      setStep(0);
      return;
    }

    const mappedColumns = fieldMappings
      .filter((mapping) => mapping.enabled && mapping.column.trim().length > 0)
      .map((mapping) => mapping.column.trim());

    const currentSource = bindingDefinitions.dataSources[dataSourceId];
    if (currentSource) {
      const merged = mergeResourceFieldsFromMappings(currentSource, mappedColumns);
      if (merged.fields.length !== currentSource.fields.length) {
        upsertDataSource(merged);
      }
    }

    const actions = buildFormBindingWizardActions(document, bindingDefinitions, {
      scenario,
      regionNodeId: regionNode.id,
      dataSourceId,
      fieldMappings,
      successBehaviors,
      submitEventTarget: regionNode.type === 'html' ? 'onSubmit' : 'onClick',
    });

    for (const action of actions) {
      dispatch(action);
    }

    onClose();
  };

  const updateFieldMapping = (nodeId: string, patch: Partial<FormFieldMappingDraft>) => {
    setFieldMappings((current) =>
      current.map((mapping) => (mapping.nodeId === nodeId ? { ...mapping, ...patch } : mapping)),
    );
  };

  const selectedDataSource = dataSourceId ? getDataSources(bindingDefinitions)[dataSourceId] : undefined;
  const availableColumns = React.useMemo(
    () => resolveFormWizardRecordFieldOptions(
      selectedDataSource?.fields ?? [],
      fieldMappings,
      bindableFieldNodes,
    ),
    [bindableFieldNodes, fieldMappings, selectedDataSource?.fields],
  );
  const mappedFieldCount = fieldMappings.filter((mapping) => mapping.enabled && mapping.column.trim()).length;
  const skipsSubmitStep = scenario === 'detail' || scenario === 'search';

  if (!open) {
    return null;
  }

  return (
    <DesignerDialogHostContext.Provider value>
      <StepWizardShell
      size="5xl"
      title="Connect Form to API"
      titleIcon={Wand2}
      subtitle="3 quick steps — resource, field mapping, and save behavior"
      steps={WIZARD_STEPS}
      step={step}
      onStepChange={(next) => {
        setValidationError(null);
        setStep(next);
      }}
      onClose={onClose}
      onBackdropClick={onClose}
      onNext={handleNext}
      bodyInnerClassName={step === 1 ? '!overflow-hidden flex flex-col min-h-0' : undefined}
      finalStepAction={{
        label: 'Apply & connect',
        icon: <Link2 className="h-3.5 w-3.5" strokeWidth={2} />,
        onClick: handleApply,
        disabled: !dataSourceId.trim() || mappedFieldCount === 0,
      }}
    >
      {validationError ? (
        <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {validationError}
        </div>
      ) : null}

      {step === 0 ? (
        <div className="flex flex-col gap-4">
          <AppSurfaceBox tone="violet" title="What should this form do?">
            <div className="grid gap-2 sm:grid-cols-3">
              {FORM_BINDING_PRIMARY_SCENARIOS.map((option) => {
                const isSelected = scenario === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-lg border p-3 text-left transition-colors ${isSelected
                      ? 'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                    onClick={() => setScenario(option.value)}
                  >
                    <span className="block text-sm font-semibold text-slate-800">{option.label}</span>
                    <span className="mt-1 block text-xs leading-snug text-slate-500">{option.hint}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="mt-2 ps-[4px] text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
              onClick={() => setShowAdvancedScenarios((current) => !current)}
            >
              {showAdvancedScenarios ? 'Hide advanced scenarios' : 'More scenarios…'}
            </button>

            {showAdvancedScenarios ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {FORM_BINDING_ADVANCED_SCENARIOS.map((option) => {
                  const isSelected = scenario === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`rounded-lg border p-2.5 text-left transition-colors ${isSelected
                        ? 'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      onClick={() => setScenario(option.value)}
                    >
                      <span className="block text-xs font-semibold text-slate-800">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </AppSurfaceBox>

          <BindingResourceQuickConnect
            key={quickConnectSession}
            bindingDefinitions={bindingDefinitions}
            dataSourceId={dataSourceId}
            quickEndpoint={quickEndpoint}
            suggestedFields={suggestedFields}
            onDataSourceIdChange={setDataSourceId}
            onQuickEndpointChange={setQuickEndpoint}
            onCreateResource={upsertDataSource}
          />
        </div>
      ) : null}

      {step === 1 ? (
        <AppSurfaceBox
          tone="cyan"
          title="Input → record field"
          headerExtra={(
            <span className="text-[10px] font-medium text-slate-500">
              {mappedFieldCount} mapped automatically
            </span>
          )}
          fill
          bodyClassName="!p-0"
        >
          {fieldMappings.length === 0 ? (
            <div className="space-y-2 p-4 text-center text-xs text-slate-600">
              <p className="font-semibold text-slate-800">No form inputs on the canvas yet.</p>
              <p>
                For an empty form, use toolbar <span className="font-semibold">Build form from API</span> (wand icon)
                instead of this wizard — it creates inputs and bindings together.
              </p>
              <p className="text-slate-500">
                Use <span className="font-semibold">Connect to API</span> only when the form already has input controls.
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="grid shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                <span>Map</span>
                <span>Input</span>
                <span>Record field</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <div className="space-y-2">
                  {fieldMappings.map((mapping) => {
                    const bindable = document.nodes[mapping.nodeId];
                    const label = typeof bindable?.props.label === 'string'
                      ? bindable.props.label
                      : mapping.nodeId;

                    return (
                      <div
                        key={mapping.nodeId}
                        className={`grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white px-2 py-2`}
                      >
                        <UiCheckbox
                          checked={mapping.enabled}
                          onChange={(event) => updateFieldMapping(mapping.nodeId, { enabled: event.target.checked })}
                          aria-label={`Map ${label}`}
                        />
                        <span className="truncate text-sm text-slate-700">{label}</span>
                        <UiSelect
                          size="sm"
                          nested
                          className="w-full"
                          placeholder="Select field…"
                          value={mapping.column}
                          disabled={!mapping.enabled}
                          onChange={(event) => updateFieldMapping(mapping.nodeId, { column: event.target.value })}
                        >
                          {availableColumns.length === 0 ? (
                            <option value={mapping.column}>{mapping.column || mapping.fieldKey}</option>
                          ) : (
                            availableColumns.map((column) => (
                              <option key={`${mapping.nodeId}:${column}`} value={column}>{column}</option>
                            ))
                          )}
                        </UiSelect>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </AppSurfaceBox>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-3">
          {!skipsSubmitStep ? (
            <AppSurfaceBox tone="emerald" title="After save">
              <p className="text-xs leading-relaxed text-slate-600">
                Submit uses the mapped fields automatically — no manual payload wiring needed.
              </p>
              <div className="mt-3">
                <div className="flex flex-col gap-[2px]">
                  <span className="ps-[4px] text-xs text-slate-500">After save (combine any)</span>
                  <div className={`mt-[2px] flex flex-col gap-1.5 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white px-2.5 py-2`}>
                    {SUCCESS_OPTIONS.map((option) => {
                      const checked = successBehaviors.includes(option.value);
                      return (
                        <label key={option.value} className="flex items-center gap-2 text-xs text-slate-700">
                          <UiCheckbox
                            size="sm"
                            checked={checked}
                            onChange={() => {
                              setSuccessBehaviors((current) => (
                                checked
                                  ? current.filter((entry) => entry !== option.value)
                                  : [...current, option.value]
                              ));
                            }}
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <span className="ps-[4px] text-[11px] text-slate-500">
                    Leave all unchecked for no extra action. Close only works when the form is inside a Modal/Drawer.
                  </span>
                </div>
              </div>
            </AppSurfaceBox>
          ) : (
            <AppSurfaceBox tone="slate" title="No submit action">
              <p className="text-xs leading-relaxed text-slate-600">
                This scenario loads data only. Add search or navigation actions under Interactions if needed.
              </p>
            </AppSurfaceBox>
          )}

          <BindingHealthSummary summary={health} />

          <AppSurfaceBox tone="violet" title="Request preview">
            {preview.loadEndpoint ? (
              <p className="text-xs text-slate-700">
                <span className="font-semibold text-slate-800">Load:</span>{' '}
                <span className="font-mono text-[11px]">GET {preview.loadEndpoint}</span>
              </p>
            ) : null}
            {!skipsSubmitStep ? (
              <p className="mt-2 text-xs text-slate-700">
                <span className="font-semibold text-slate-800">Submit:</span>{' '}
                <span className="font-mono text-[11px]">{preview.submitMethod} {preview.submitEndpoint}</span>
              </p>
            ) : null}
            <p className="mt-2 text-xs text-slate-700">
              <span className="font-semibold text-slate-800">Body:</span>
              {' '}
              mapped from {preview.mappedFieldCount} field{preview.mappedFieldCount === 1 ? '' : 's'}
            </p>
          </AppSurfaceBox>
        </div>
      ) : null}
      </StepWizardShell>
    </DesignerDialogHostContext.Provider>
  );
};
