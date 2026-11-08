import * as React from 'react';
import {
  AlertTriangle,
  ClipboardCheck,
  LayoutPanelLeft,
  Link2,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react';
import type { DesignerApiOperationMethod } from '../../../domain/component-designer/types';
import {
  inferScenarioFromMethod,
  parseApiEndpointFromOpenApi,
  type ApiFormField,
} from '../../../domain/component-designer/apiFieldSchema';
import {
  AUTO_FORM_CONTROL_LABELS,
  AUTO_FORM_CONTROL_PALETTE_ITEM_IDS,
  humanizeFieldName,
  mapApiFieldToControl,
} from '../../../domain/component-designer/apiFieldToControl';
import {
  type AutoFormBuildConfig,
  type AutoFormDetailIdSource,
  type AutoFormFieldConfig,
  type AutoFormLayout,
} from '../../../domain/component-designer/autoFormTemplateBuilder';
import {
  buildDataSourceFromEndpoint,
  inferResourceNameFromEndpoint,
  type FormBindingScenario,
  type FormBindingSuccessBehavior,
} from '../../../domain/component-designer/bindingResourceModel';
import { useAccessibleApiRoutesQuery } from '../../../shared/api/queries/my-apis';
import {
  resolveEndpointFormFieldsFromOpenApi,
  useApiEndpointSchemaQuery,
} from '../../../shared/api/queries/api-endpoint-schema';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { StepWizardShell, type StepWizardStepDef } from '../../../shared/ui/StepWizardShell';
import { DesignerDialogHostContext } from '../../../shared/ui/designerDialogHostContext';
import { UiCheckbox, UiCheckboxChoice, UiInput, UiRadioGroup, UiSelect } from '../../../shared/ui';
import { BindingApiEndpointPicker } from './BindingApiEndpointPicker';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

const WIZARD_STEPS: readonly StepWizardStepDef[] = [
  { title: 'API', icon: Wand2, description: 'Pick the API endpoint to build the form from.' },
  { title: 'Fields', icon: ListChecks, description: 'Choose which fields to include and how each looks.' },
  { title: 'Layout', icon: LayoutPanelLeft, description: 'Name the form, set its layout and save behavior.' },
  { title: 'Review', icon: ClipboardCheck, description: 'Review and generate the form in the designer.' },
];

/** Content steps used by the catalog create wizard (Review is replaced by Name & tags). */
export const AUTO_FORM_CONTENT_STEPS: readonly StepWizardStepDef[] = WIZARD_STEPS.slice(0, 3);

export const resolveAutoFormBodyInnerClassName = (stepIndex: number): string | undefined => (
  stepIndex === 1 ? '!overflow-hidden flex flex-col min-h-0' : undefined
);

export type AutoFormWizardHandle = {
  validateStep: (stepIndex: number) => boolean;
  getResult: () => { config: AutoFormBuildConfig; suggestedName: string } | null;
  suggestedName: string;
  canFinish: boolean;
};

const SCENARIO_OPTIONS: Array<{ value: FormBindingScenario; label: string }> = [
  { value: 'createEdit', label: 'Save (create or update)' },
  { value: 'create', label: 'Create only' },
  { value: 'edit', label: 'Edit existing' },
  { value: 'detail', label: 'View only (no submit)' },
  { value: 'search', label: 'Search / filter' },
];

const SUCCESS_OPTIONS: Array<{ value: Exclude<FormBindingSuccessBehavior, 'none'>; label: string }> = [
  { value: 'refresh', label: 'Refresh data after save (recommended)' },
  { value: 'toast', label: 'Show success toast' },
  { value: 'reset', label: 'Reset form fields' },
  { value: 'close', label: 'Close dialog' },
];

const DETAIL_SCENARIOS = new Set<FormBindingScenario>(['edit', 'detail', 'createEdit']);

const scenarioFromApiScenario = (apiScenario: ReturnType<typeof inferScenarioFromMethod>): FormBindingScenario => (
  apiScenario === 'create'
    ? 'createEdit'
    : apiScenario
);

const apiScenarioToFormScenario = (method: string, path: string): FormBindingScenario =>
  scenarioFromApiScenario(inferScenarioFromMethod(method, path));

const isControlFieldLocation = (location: ApiFormField['location'], scenario: FormBindingScenario): boolean => {
  if (location === 'body') {
    return true;
  }
  if (location === 'query') {
    return scenario === 'search';
  }
  return false;
};

const buildFieldConfigsFromFields = (
  fields: ApiFormField[],
  scenario: FormBindingScenario,
): AutoFormFieldConfig[] => (
  fields
    .filter((field) => isControlFieldLocation(field.location, scenario))
    .map((field) => ({
      field,
      enabled: true,
      label: humanizeFieldName(field.name),
      controlPaletteItemId: mapApiFieldToControl(field).paletteItemId,
    }))
);

const defaultSubmitLabelForScenario = (scenario: FormBindingScenario): string => {
  switch (scenario) {
    case 'create':
      return 'Create';
    case 'edit':
      return 'Update';
    case 'search':
      return 'Search';
    default:
      return 'Save';
  }
};

export type AutoFormWizardEntryMode = 'catalog' | 'canvas';

export type AutoFormWizardDialogProps = {
  open: boolean;
  onClose: () => void;
  onGenerate: (config: AutoFormBuildConfig, meta: { suggestedName: string }) => void;
  /**
   * `catalog` = empty-list "From API" (fresh document).
   * `canvas` = editor toolbar / merge into selected Form/Modal.
   * Used for edit-alone warnings and copy.
   */
  entryMode?: AutoFormWizardEntryMode;
  /** Render only the step body (no shell) so a parent wizard can host these steps. */
  embedded?: boolean;
  /** Controlled inner step when `embedded` is true. */
  embeddedStep?: number;
};

export const AutoFormWizardDialog = React.forwardRef<AutoFormWizardHandle, AutoFormWizardDialogProps>(({
  open,
  onClose,
  onGenerate,
  entryMode = 'catalog',
  embedded = false,
  embeddedStep = 0,
}, ref) => {
  const routesQuery = useAccessibleApiRoutesQuery();

  const [step, setStep] = React.useState(0);
  const [formSourceMode, setFormSourceMode] = React.useState<'api' | 'static'>('api');
  const [endpointPath, setEndpointPath] = React.useState('');
  const [method, setMethod] = React.useState<DesignerApiOperationMethod>('POST');
  const [scenario, setScenario] = React.useState<FormBindingScenario>('createEdit');
  const [fieldConfigs, setFieldConfigs] = React.useState<AutoFormFieldConfig[]>([]);
  const [title, setTitle] = React.useState('');
  const [includeTitle, setIncludeTitle] = React.useState(true);
  const [layout, setLayout] = React.useState<AutoFormLayout>('single');
  const [submitLabel, setSubmitLabel] = React.useState('Save');
  const [successBehaviors, setSuccessBehaviors] = React.useState<Array<Exclude<FormBindingSuccessBehavior, 'none'>>>(['refresh']);
  const [detailIdSource, setDetailIdSource] = React.useState<AutoFormDetailIdSource>('selection');
  const [manualFieldName, setManualFieldName] = React.useState('');
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [fieldsWarning, setFieldsWarning] = React.useState<string | null>(null);
  /** UI-only bookkeeping (not part of AutoFormFieldConfig) so the Fields grid can badge
   * manually-typed fields as distinct from ones detected from the API schema. */
  const [manualFieldNames, setManualFieldNames] = React.useState<ReadonlySet<string>>(new Set());

  const isStaticMode = formSourceMode === 'static';
  const normalizedPath = endpointPath.trim().replace(/\/+$/, '').toLowerCase();

  const matchedRoute = React.useMemo(() => {
    const items = routesQuery.data ?? [];
    if (!normalizedPath || isStaticMode) {
      return undefined;
    }
    const matches = items.filter((route) => route.path.trim().replace(/\/+$/, '').toLowerCase() === normalizedPath);
    return matches.find((route) => route.method.toUpperCase() === method) ?? matches[0];
  }, [isStaticMode, method, normalizedPath, routesQuery.data]);

  const functionId = matchedRoute?.id ?? null;
  const schemaStep = embedded ? embeddedStep : step;
  const schemaQuery = useApiEndpointSchemaQuery(open && !isStaticMode ? functionId : null, { refresh: schemaStep >= 1 });

  const resolvedFormFields = React.useMemo(
    () => (schemaQuery.data ? resolveEndpointFormFieldsFromOpenApi(schemaQuery.data, method) : []),
    [method, schemaQuery.data],
  );

  const parsedEndpoint = React.useMemo(() => {
    if (!schemaQuery.data || isStaticMode) {
      return null;
    }

    const parsed = parseApiEndpointFromOpenApi(schemaQuery.data, { method });
    if (!parsed) {
      return null;
    }

    return {
      ...parsed,
      fields: resolvedFormFields,
      hasSchema: resolvedFormFields.length > 0,
    };
  }, [isStaticMode, method, resolvedFormFields, schemaQuery.data]);

  const isSchemaPending = Boolean(functionId) && schemaQuery.isLoading;
  const isSchemaUnavailable = Boolean(functionId) && schemaQuery.isError;
  const showStandaloneEditWarning = entryMode === 'catalog'
    && !isStaticMode
    && DETAIL_SCENARIOS.has(scenario);

  // Reset all state when the dialog opens.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    setStep(0);
    setFormSourceMode('api');
    setEndpointPath('');
    setMethod('POST');
    setScenario('createEdit');
    setFieldConfigs([]);
    setTitle('');
    setIncludeTitle(true);
    setLayout('single');
    setSubmitLabel('Save');
    setSuccessBehaviors(['refresh']);
    setDetailIdSource('selection');
    setManualFieldName('');
    setManualFieldNames(new Set());
    setValidationError(null);
    setFieldsWarning(null);
  }, [open]);

  // Populate fields + defaults whenever a new endpoint schema resolves.
  React.useEffect(() => {
    if (!open || !parsedEndpoint || isStaticMode) {
      return;
    }
    const inferredScenario = apiScenarioToFormScenario(parsedEndpoint.method, parsedEndpoint.path);
    setScenario(inferredScenario);
    setManualFieldNames(new Set());
    setFieldConfigs(buildFieldConfigsFromFields(parsedEndpoint.fields, inferredScenario));
    setSubmitLabel(defaultSubmitLabelForScenario(inferredScenario));
    setTitle((current) => current.trim() || `${inferResourceNameFromEndpoint(parsedEndpoint.path)} form`);
  }, [isStaticMode, open, parsedEndpoint]);

  // Re-filter controls when the user switches scenario (query fields only matter for search).
  React.useEffect(() => {
    if (!open || !parsedEndpoint || isStaticMode) {
      return;
    }
    setFieldConfigs((current) => {
      const byName = new Map(current.map((entry) => [entry.field.name, entry]));
      return buildFieldConfigsFromFields(parsedEndpoint.fields, scenario).map((fresh) => {
        const existing = byName.get(fresh.field.name);
        return existing ? { ...fresh, enabled: existing.enabled, label: existing.label, controlPaletteItemId: existing.controlPaletteItemId } : fresh;
      });
    });
    // Intentionally only re-run when scenario changes (parsedEndpoint handled above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  const enabledCount = fieldConfigs.filter((entry) => entry.enabled).length;
  const attachSubmit = scenario !== 'detail' && scenario !== 'search';
  const successOptionsForMode = isStaticMode
    ? SUCCESS_OPTIONS.filter((option) => option.value !== 'refresh')
    : SUCCESS_OPTIONS;

  const suggestedName = React.useMemo(() => {
    if (isStaticMode) {
      return 'Static Form';
    }
    const base = endpointPath.trim()
      ? inferResourceNameFromEndpoint(endpointPath)
      : 'New';
    return `${base} Form`;
  }, [endpointPath, isStaticMode]);

  const updateFieldConfig = (name: string, patch: Partial<AutoFormFieldConfig>) => {
    setFieldConfigs((current) =>
      current.map((entry) => (entry.field.name === name ? { ...entry, ...patch } : entry)),
    );
  };

  const handleAddManualField = () => {
    const name = manualFieldName.trim();
    if (!name) {
      return;
    }
    if (fieldConfigs.some((entry) => entry.field.name === name)) {
      setValidationError(`Field "${name}" already exists.`);
      return;
    }
    const field: ApiFormField = { name, type: 'string', location: 'body', required: false };
    setFieldConfigs((current) => [
      ...current,
      {
        field,
        enabled: true,
        label: humanizeFieldName(name),
        controlPaletteItemId: mapApiFieldToControl(field).paletteItemId,
      },
    ]);
    setManualFieldNames((current) => new Set(current).add(name));
    setManualFieldName('');
    setValidationError(null);
  };

  const handleFormSourceModeChange = (nextMode: 'api' | 'static') => {
    setFormSourceMode(nextMode);
    setValidationError(null);
    setFieldsWarning(null);
    if (nextMode === 'static') {
      setEndpointPath('');
      setFieldConfigs([]);
      setManualFieldNames(new Set());
      setScenario('create');
      setSubmitLabel('Submit');
      setTitle((current) => current.trim() || 'New form');
      setSuccessBehaviors((current) => {
        const withoutRefresh = current.filter((entry) => entry !== 'refresh');
        return withoutRefresh.length > 0 ? withoutRefresh : ['toast'];
      });
    } else {
      setSuccessBehaviors((current) => (current.includes('refresh') ? current : ['refresh', ...current]));
    }
  };

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      if (isStaticMode) {
        setFieldsWarning(null);
        setValidationError(null);
        return true;
      }
      if (!endpointPath.trim()) {
        setValidationError('Select or type an API endpoint before continuing.');
        return false;
      }
      if (isSchemaPending) {
        setValidationError('Reading endpoint schema — wait a moment, then try again.');
        return false;
      }
      if (isSchemaUnavailable) {
        setValidationError('Could not read the endpoint schema. Pick the route from Browse or retry.');
        return false;
      }
      if (functionId && resolvedFormFields.length === 0 && method === 'POST') {
        // Not a hard block — manual field entry on the next step is a fully valid path, and the
        // route's OpenAPI schema not exposing field names doesn't mean the route has none. Warn,
        // but let Next proceed to the Fields step where the user can add fields by hand.
        setFieldsWarning(
          'This POST route has no body fields in OpenAPI. Add fields manually on the next step, or edit input fields in Server Functions.',
        );
        return true;
      }
      setFieldsWarning(null);
      return true;
    }
    if (stepIndex === 1 && enabledCount === 0) {
      setValidationError('Enable at least one field.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const canGenerate = enabledCount > 0 && (isStaticMode || Boolean(endpointPath.trim()));

  const getResult = (): { config: AutoFormBuildConfig; suggestedName: string } | null => {
    if (!isStaticMode && !endpointPath.trim()) {
      setValidationError('Endpoint is required.');
      setStep(0);
      return null;
    }
    if (enabledCount === 0) {
      setValidationError('Enable at least one field.');
      setStep(1);
      return null;
    }

    const enabledFieldNames = fieldConfigs
      .filter((entry) => entry.enabled)
      .map((entry) => entry.field.name);

    const buildConfig: AutoFormBuildConfig = isStaticMode
      ? {
        title: title.trim() || 'New form',
        includeTitle,
        staticForm: true,
        scenario,
        fields: fieldConfigs,
        submitLabel,
        successBehaviors: successBehaviors.filter((entry) => entry !== 'refresh'),
        layout,
      }
      : {
        title: title.trim() || `${inferResourceNameFromEndpoint(endpointPath)} form`,
        includeTitle,
        dataSource: buildDataSourceFromEndpoint(endpointPath, {
          fields: Array.from(new Set(['id', ...enabledFieldNames])),
          primaryKey: 'id',
          method,
        }),
        scenario,
        fields: fieldConfigs,
        submitLabel,
        successBehaviors,
        layout,
        detailIdSource: DETAIL_SCENARIOS.has(scenario) ? detailIdSource : undefined,
      };

    return { config: buildConfig, suggestedName };
  };

  const handleGenerate = () => {
    const result = getResult();
    if (!result) {
      return;
    }
    onGenerate(result.config, { suggestedName: result.suggestedName });
    onClose();
  };

  React.useImperativeHandle(ref, () => ({
    validateStep,
    getResult,
    suggestedName,
    canFinish: canGenerate,
  }));

  if (!open) {
    return null;
  }

  const visibleStep = embedded ? embeddedStep : step;
  const wizardTitle = entryMode === 'canvas'
    ? 'Generate fields from API'
    : 'Build form from API';
  const wizardSubtitle = entryMode === 'canvas'
    ? 'Generate wired fields into the selected Form or Modal, then refine in the designer.'
    : 'Generate a fully wired form from an API endpoint, then refine it in the designer.';
  const finalActionLabel = entryMode === 'canvas'
    ? 'Build into selection'
    : 'Build & open in designer';

  const stepBody = (
    <>
        {validationError ? (
          <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {validationError}
          </div>
        ) : null}

        {!validationError && fieldsWarning ? (
          <div className="mb-3 flex shrink-0 items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{fieldsWarning}</span>
          </div>
        ) : null}

        {visibleStep === 0 ? (
          <div className="flex flex-col gap-4">
            <AppSurfaceBox tone="slate" title="Form source">
              <UiRadioGroup
                size="sm"
                ariaLabel="Form source"
                value={formSourceMode}
                onChange={(value) => handleFormSourceModeChange(value === 'static' ? 'static' : 'api')}
                options={[
                  { value: 'api', label: 'From API endpoint' },
                  { value: 'static', label: 'Static form (no API)' },
                ]}
              />
              {isStaticMode ? (
                <p className="mt-2 ps-[4px] text-[11px] leading-relaxed text-slate-500">
                  Build an empty form shell with manually added fields. Wire submit / data loading later in the Inspector.
                </p>
              ) : null}
            </AppSurfaceBox>

            {!isStaticMode ? (
              <>
                <AppSurfaceBox tone="violet" title="API endpoint" className="overflow-visible" bodyClassName="overflow-visible">
                  <BindingApiEndpointPicker
                    value={endpointPath}
                    method={method}
                    onChange={setEndpointPath}
                    onMethodChange={setMethod}
                    autoFocus
                  />
                </AppSurfaceBox>

                <AppSurfaceBox tone="cyan" title="Detected schema">
                  {!endpointPath.trim() ? (
                    <p className="text-xs text-slate-500">Pick an endpoint to detect its fields.</p>
                  ) : !functionId ? (
                    <p className="text-xs text-amber-600">
                      This path is not in your accessible API list — keep typing to pick a suggestion,
                      use the typed path, or create the route in Server Functions first.
                    </p>
                  ) : schemaQuery.isLoading || isSchemaPending ? (
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> Reading endpoint schema…
                    </p>
                  ) : schemaQuery.isError || isSchemaUnavailable ? (
                    <p className="text-xs text-rose-600">
                      Could not read the endpoint schema. Re-select the route from Browse or check Server Functions.
                    </p>
                  ) : parsedEndpoint?.hasSchema ? (
                    <p className="text-xs text-emerald-600">
                      Found <span className="font-semibold">{parsedEndpoint.fields.length}</span> field
                      {parsedEndpoint.fields.length === 1 ? '' : 's'} · suggested intent:{' '}
                      <span className="font-semibold">{scenario}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600">
                      No request fields described — continue to the next step to add fields manually
                      (e.g. topic_code, title, note), or edit the POST route input fields in Server
                      Functions and retry.
                    </p>
                  )}
                </AppSurfaceBox>
              </>
            ) : (
              <AppSurfaceBox tone="cyan" title="Static form">
                <p className="text-xs leading-relaxed text-slate-600">
                  Continue to Fields and add controls by name. No API data source or auto-submit mutation is wired.
                </p>
              </AppSurfaceBox>
            )}
          </div>
        ) : null}

        {visibleStep === 1 ? (
          <AppSurfaceBox
            tone="cyan"
            title="Form fields"
            headerExtra={(
              <span className="text-[10px] font-medium text-slate-500">{enabledCount} included</span>
            )}
            fill
            bodyClassName="!p-0"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="grid shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                <span>Use</span>
                <span>Label</span>
                <span>Control</span>
                <span>Req</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {fieldConfigs.length === 0 ? (
                  <p className="p-3 text-center text-xs text-slate-500">
                    No fields yet — add one below.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {fieldConfigs.map((entry) => (
                      <div
                        key={entry.field.name}
                        className={`grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white px-2 py-2`}
                      >
                        <UiCheckbox
                          checked={entry.enabled}
                          onChange={(event) => updateFieldConfig(entry.field.name, { enabled: event.target.checked })}
                          aria-label={`Include ${entry.field.name}`}
                        />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span
                            className={`w-fit rounded px-1 text-[9px] font-bold uppercase tracking-wide ${
                              manualFieldNames.has(entry.field.name) || isStaticMode
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {manualFieldNames.has(entry.field.name) || isStaticMode ? 'Custom' : 'From API'}
                          </span>
                          <UiInput
                            size="sm"
                            nested
                            className="w-full"
                            value={entry.label}
                            disabled={!entry.enabled}
                            onChange={(event) => updateFieldConfig(entry.field.name, { label: event.target.value })}
                          />
                        </div>
                        <UiSelect
                          size="sm"
                          nested
                          className="w-full"
                          value={entry.controlPaletteItemId}
                          disabled={!entry.enabled}
                          onChange={(event) => updateFieldConfig(entry.field.name, { controlPaletteItemId: event.target.value })}
                        >
                          {AUTO_FORM_CONTROL_PALETTE_ITEM_IDS.map((controlId) => (
                            <option key={controlId} value={controlId}>{AUTO_FORM_CONTROL_LABELS[controlId]}</option>
                          ))}
                        </UiSelect>
                        <div className="flex items-center justify-center">
                          {entry.field.required ? (
                            <span className="text-[10px] font-semibold text-rose-500" title="Required by the API">●</span>
                          ) : (
                            <button
                              type="button"
                              className="rounded p-0.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                              aria-label={`Remove ${entry.field.name}`}
                              onClick={() => setFieldConfigs((current) => current.filter((item) => item.field.name !== entry.field.name))}
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 border-t border-slate-200 bg-slate-50/70 px-3 py-2">
                <p className="mb-1.5 text-[10px] font-semibold text-slate-500">
                  Can&apos;t find a field above? Add it manually:
                </p>
                <div className="flex items-center gap-2">
                  <UiInput
                    size="sm"
                    className="min-w-0 flex-1"
                    placeholder="Add a field by name (e.g. notes)"
                    value={manualFieldName}
                    onChange={(event) => setManualFieldName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddManualField();
                      }
                    }}
                  />
                  <AppButton type="button" intent="secondary" size="sm" className="h-8 px-2.5" onClick={handleAddManualField}>
                    <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> Add
                  </AppButton>
                </div>
              </div>
            </div>
          </AppSurfaceBox>
        ) : null}

        {visibleStep === 2 ? (
          <div className="flex flex-col gap-3">
            {showStandaloneEditWarning ? (
              <div
                className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"
                data-testid="auto-form-standalone-edit-warning"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">Record selection required</span>
                  <span className="leading-relaxed">
                    This form loads/edits a single record and needs a selection mechanism
                    (for example a Grid detail action that writes{' '}
                    <span className="font-mono text-[10px]">selection.id</span>
                    ). Alone, it will stay empty unless you read the id from the URL below.
                  </span>
                </div>
              </div>
            ) : null}

            <AppSurfaceBox tone="violet" title="Form basics">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-[2px]">
                  <span className="ps-[4px] text-xs text-slate-500">Title</span>
                  <UiInput size="sm" className="w-full" value={title} onChange={(event) => setTitle(event.target.value)} />
                </div>
                <UiCheckboxChoice
                  checked={includeTitle}
                  onChange={(checked) => setIncludeTitle(checked)}
                >
                  Show title heading in the form
                </UiCheckboxChoice>
                <div className="flex flex-col gap-[2px]">
                  <span className="ps-[4px] text-xs text-slate-500">Behavior</span>
                  <UiSelect
                    size="sm"
                    className="w-full"
                    value={scenario}
                    onChange={(event) => setScenario(event.target.value as FormBindingScenario)}
                  >
                    {SCENARIO_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </UiSelect>
                </div>
                {!isStaticMode && DETAIL_SCENARIOS.has(scenario) ? (
                  <div className="flex flex-col gap-[2px]">
                    <span className="ps-[4px] text-xs text-slate-500">Record id source</span>
                    <UiRadioGroup
                      size="sm"
                      ariaLabel="Record id source"
                      value={detailIdSource}
                      onChange={(value) => setDetailIdSource(value === 'urlParam' ? 'urlParam' : 'selection')}
                      options={[
                        { value: 'selection', label: 'From selection store (selection.id — Grid detail flow)' },
                        { value: 'urlParam', label: 'From URL param (params.id — standalone ?id= page)' },
                      ]}
                    />
                  </div>
                ) : null}
                <div className="flex flex-col gap-[2px]">
                  <span className="ps-[4px] text-xs text-slate-500">Layout</span>
                  <UiSelect
                    size="sm"
                    className="w-full"
                    value={layout}
                    onChange={(event) => setLayout(event.target.value as AutoFormLayout)}
                  >
                    <option value="single">Single column</option>
                    <option value="two-column">Two columns</option>
                  </UiSelect>
                </div>
              </div>
            </AppSurfaceBox>

            {attachSubmit ? (
              <AppSurfaceBox tone="emerald" title="Submit">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-[2px]">
                    <span className="ps-[4px] text-xs text-slate-500">Submit button label</span>
                    <UiInput size="sm" className="w-full" value={submitLabel} onChange={(event) => setSubmitLabel(event.target.value)} />
                  </div>
                  <div className="flex flex-col gap-[2px]">
                    <span className="ps-[4px] text-xs text-slate-500">After save (combine any)</span>
                    <div className={`mt-[2px] flex flex-col gap-1.5 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white px-2.5 py-2`}>
                      {successOptionsForMode.map((option) => {
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
                      Leave all unchecked for no extra action. Reset targets this form; Close hides the nearest Modal/Drawer ancestor when present.
                    </span>
                  </div>
                </div>
              </AppSurfaceBox>
            ) : (
              <AppSurfaceBox tone="slate" title="No submit action">
                <p className="text-xs leading-relaxed text-slate-600">
                  This scenario loads data only — no submit button is added.
                </p>
              </AppSurfaceBox>
            )}
          </div>
        ) : null}

        {visibleStep === 3 ? (
          <div className="flex flex-col gap-3">
            <AppSurfaceBox tone="violet" title="Summary">
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li>
                  <span className="font-semibold text-slate-800">Source:</span>{' '}
                  {isStaticMode ? (
                    'Static form (no API)'
                  ) : (
                    <span className="font-mono text-[11px]">{method} {endpointPath || '—'}</span>
                  )}
                </li>
                <li><span className="font-semibold text-slate-800">Intent:</span> {scenario}</li>
                {!isStaticMode && DETAIL_SCENARIOS.has(scenario) ? (
                  <li>
                    <span className="font-semibold text-slate-800">Record id:</span>{' '}
                    {detailIdSource === 'urlParam' ? 'URL param (params.id)' : 'selection store (selection.id)'}
                  </li>
                ) : null}
                <li>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">Fields ({enabledCount}):</span>
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-primary-600 hover:text-primary-700"
                      onClick={() => setStep(1)}
                    >
                      Edit
                    </button>
                  </div>
                  {enabledCount === 0 ? (
                    <p className="mt-1 text-[11px] text-slate-500">No fields selected.</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {fieldConfigs.filter((entry) => entry.enabled).map((entry) => (
                        <span
                          key={entry.field.name}
                          className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-700`}
                          title={entry.field.location}
                        >
                          {entry.field.name}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
                <li><span className="font-semibold text-slate-800">Layout:</span> {layout === 'two-column' ? 'Two columns' : 'Single column'}</li>
                {attachSubmit ? (
                  <li><span className="font-semibold text-slate-800">Submit:</span> “{submitLabel}” · {successBehaviors.length > 0 ? successBehaviors.join(' + ') : 'none'}</li>
                ) : (
                  <li><span className="font-semibold text-slate-800">Submit:</span> none (view/search)</li>
                )}
              </ul>
            </AppSurfaceBox>
            <AppSurfaceBox tone="cyan" title="What happens next">
              <p className="text-xs leading-relaxed text-slate-600">
                {entryMode === 'canvas'
                  ? 'Fields are generated into the selected Form or Modal. Existing siblings outside that target stay intact.'
                  : isStaticMode
                    ? 'A static form shell is opened in the designer. Add submit/API wiring in the Inspector when ready.'
                    : 'The form is generated as a new, unsaved component and opened in the designer. Tweak it with the designer tools, or save it as-is — it is already wired to the API.'}
              </p>
            </AppSurfaceBox>
          </div>
        ) : null}
    </>
  );

  if (embedded) {
    return stepBody;
  }

  return (
    <DesignerDialogHostContext.Provider value>
      <StepWizardShell
        size="5xl"
        title={wizardTitle}
        titleIcon={Wand2}
        subtitle={wizardSubtitle}
        steps={WIZARD_STEPS}
        step={step}
        onStepChange={(next) => {
          setValidationError(null);
          if (next !== 1) {
            setFieldsWarning(null);
          }
          setStep(next);
        }}
        onClose={onClose}
        onBackdropClick={onClose}
        onNext={() => validateStep(step)}
        bodyInnerClassName={resolveAutoFormBodyInnerClassName(step)}
        finalStepAction={{
          label: finalActionLabel,
          icon: <Link2 className="h-3.5 w-3.5" strokeWidth={2} />,
          onClick: handleGenerate,
          disabled: !canGenerate,
        }}
      >
        {stepBody}
      </StepWizardShell>
    </DesignerDialogHostContext.Provider>
  );
});

AutoFormWizardDialog.displayName = 'AutoFormWizardDialog';
