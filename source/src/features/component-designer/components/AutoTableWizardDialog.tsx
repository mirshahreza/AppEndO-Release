import * as React from 'react';
import {
  ClipboardCheck,
  Columns3,
  Link2,
  ListChecks,
  Loader2,
  MousePointerClick,
  Table2,
  Wand2,
} from 'lucide-react';
import type { DesignerApiOperationMethod } from '../../../domain/component-designer/types';
import {
  resolveEndpointPathFromOpenApi,
} from '../../../domain/component-designer/apiFieldSchema';
import { humanizeFieldName } from '../../../domain/component-designer/apiFieldToControl';
import {
  buildAutoTableColumnConfigsFromFields,
  suggestCellKindForField,
  type AutoTableBuildConfig,
  type AutoTableCellKind,
  type AutoTableColumnConfig,
  type AutoTableRowActionId,
  type AutoTableToolbarOptions,
} from '../../../domain/component-designer/autoTableTemplateBuilder';
import {
  buildDataSourceFromEndpoint,
  inferResourceNameFromEndpoint,
} from '../../../domain/component-designer/bindingResourceModel';
import { useAccessibleApiRoutesQuery } from '../../../shared/api/queries/my-apis';
import {
  resolveEndpointResponseFormFieldsFromOpenApi,
  useApiEndpointSchemaQuery,
} from '../../../shared/api/queries/api-endpoint-schema';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { StepWizardShell, type StepWizardStepDef } from '../../../shared/ui/StepWizardShell';
import { DesignerDialogHostContext } from '../../../shared/ui/designerDialogHostContext';
import { UiCheckbox, UiInput, UiSelect } from '../../../shared/ui';
import { BindingApiEndpointPicker } from './BindingApiEndpointPicker';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

const WIZARD_STEPS: readonly StepWizardStepDef[] = [
  { title: 'API', icon: Wand2, description: 'Pick the list GET endpoint to build the table from.' },
  { title: 'Columns', icon: Columns3, description: 'Choose which response fields become grid columns.' },
  { title: 'Toolbar', icon: ListChecks, description: 'Enable search, refresh, and server query sync.' },
  { title: 'Actions', icon: MousePointerClick, description: 'Optional row actions (Details / Edit / Delete).' },
  { title: 'Review', icon: ClipboardCheck, description: 'Preview columns and generate the table.' },
];

/** Content steps used by the catalog create wizard (Review is replaced by Name & tags). */
export const AUTO_TABLE_CONTENT_STEPS: readonly StepWizardStepDef[] = WIZARD_STEPS.slice(0, 4);

export const resolveAutoTableBodyInnerClassName = (stepIndex: number): string | undefined => (
  stepIndex === 1 || stepIndex === 4 ? '!overflow-hidden flex flex-col min-h-0' : undefined
);

export type AutoTableWizardHandle = {
  validateStep: (stepIndex: number) => boolean;
  getResult: () => { config: AutoTableBuildConfig; suggestedName: string } | null;
  suggestedName: string;
  canFinish: boolean;
};

const CELL_KIND_OPTIONS: Array<{ value: AutoTableCellKind; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'boolean-icon', label: 'Boolean icon' },
  { value: 'date', label: 'Date' },
  { value: 'badge', label: 'Badge' },
  { value: 'avatar', label: 'Avatar' },
  { value: 'link', label: 'Link' },
  { value: 'chips', label: 'Chips' },
  { value: 'lock-status', label: 'Lock status' },
  { value: 'account', label: 'Account' },
  { value: 'audit', label: 'Audit' },
];

const ROW_ACTION_OPTIONS: Array<{ value: AutoTableRowActionId; label: string; hint: string }> = [
  { value: 'details', label: 'Details', hint: 'Opens detail flow for the selected row' },
  { value: 'edit', label: 'Edit', hint: 'Placeholder for Records page builder modal wiring' },
  { value: 'delete', label: 'Delete', hint: 'Placeholder for Records page builder mutation wiring' },
];

export type AutoTableWizardEntryMode = 'catalog' | 'canvas';

export type AutoTableWizardDialogProps = {
  open: boolean;
  onClose: () => void;
  onGenerate: (config: AutoTableBuildConfig, meta: { suggestedName: string }) => void;
  /**
   * `catalog` = empty-list "Table from API" (fresh document).
   * `canvas` = editor toolbar / insert into root or selected container.
   */
  entryMode?: AutoTableWizardEntryMode;
  embedded?: boolean;
  embeddedStep?: number;
};

export const AutoTableWizardDialog = React.forwardRef<AutoTableWizardHandle, AutoTableWizardDialogProps>(({
  open,
  onClose,
  onGenerate,
  entryMode = 'catalog',
  embedded = false,
  embeddedStep = 0,
}, ref) => {
  const routesQuery = useAccessibleApiRoutesQuery();

  const [step, setStep] = React.useState(0);
  const [endpointPath, setEndpointPath] = React.useState('');
  const [method, setMethod] = React.useState<DesignerApiOperationMethod>('GET');
  const [columnConfigs, setColumnConfigs] = React.useState<AutoTableColumnConfig[]>([]);
  const [title, setTitle] = React.useState('');
  const [includeTitle, setIncludeTitle] = React.useState(true);
  const [toolbar, setToolbar] = React.useState<AutoTableToolbarOptions>({
    search: true,
    refresh: true,
    createButton: false,
  });
  const [rowActions, setRowActions] = React.useState<AutoTableRowActionId[]>([]);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [columnsWarning, setColumnsWarning] = React.useState<string | null>(null);

  const normalizedPath = endpointPath.trim().replace(/\/+$/, '').toLowerCase();

  const matchedRoute = React.useMemo(() => {
    const items = routesQuery.data ?? [];
    if (!normalizedPath) {
      return undefined;
    }
    const matches = items.filter((route) => route.path.trim().replace(/\/+$/, '').toLowerCase() === normalizedPath);
    return matches.find((route) => route.method.toUpperCase() === method) ?? matches[0];
  }, [method, normalizedPath, routesQuery.data]);

  const functionId = matchedRoute?.id ?? null;
  const schemaStep = embedded ? embeddedStep : step;
  const schemaQuery = useApiEndpointSchemaQuery(open ? functionId : null, { refresh: schemaStep >= 1 });

  const resolvedResponseFields = React.useMemo(
    () => (schemaQuery.data ? resolveEndpointResponseFormFieldsFromOpenApi(schemaQuery.data, method) : []),
    [method, schemaQuery.data],
  );

  const resolvedPath = React.useMemo(() => {
    if (!schemaQuery.data) {
      return endpointPath.trim();
    }
    return resolveEndpointPathFromOpenApi(schemaQuery.data, method) ?? endpointPath.trim();
  }, [endpointPath, method, schemaQuery.data]);

  const isSchemaPending = Boolean(functionId) && schemaQuery.isLoading;
  const isSchemaUnavailable = Boolean(functionId) && schemaQuery.isError;

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setStep(0);
    setEndpointPath('');
    setMethod('GET');
    setColumnConfigs([]);
    setTitle('');
    setIncludeTitle(true);
    setToolbar({ search: true, refresh: true, createButton: false });
    setRowActions([]);
    setValidationError(null);
    setColumnsWarning(null);
  }, [open]);

  React.useEffect(() => {
    if (!open || resolvedResponseFields.length === 0) {
      return;
    }
    setColumnConfigs(buildAutoTableColumnConfigsFromFields(resolvedResponseFields));
    setTitle((current) => current.trim() || `${inferResourceNameFromEndpoint(resolvedPath || endpointPath)} table`);
  }, [endpointPath, open, resolvedPath, resolvedResponseFields]);

  const enabledCount = columnConfigs.filter((entry) => entry.enabled).length;

  const suggestedName = React.useMemo(() => {
    const base = endpointPath.trim()
      ? inferResourceNameFromEndpoint(endpointPath)
      : 'New';
    return `${base} Table`;
  }, [endpointPath]);

  const updateColumnConfig = (name: string, patch: Partial<AutoTableColumnConfig>) => {
    setColumnConfigs((current) =>
      current.map((entry) => (entry.field.name === name ? { ...entry, ...patch } : entry)),
    );
  };

  const toggleRowAction = (actionId: AutoTableRowActionId, enabled: boolean) => {
    setRowActions((current) => {
      if (enabled) {
        return current.includes(actionId) ? current : [...current, actionId];
      }
      return current.filter((entry) => entry !== actionId);
    });
  };

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      if (!endpointPath.trim()) {
        setValidationError('Select or type a list GET endpoint before continuing.');
        return false;
      }
      if (method !== 'GET') {
        setValidationError('Auto Table Builder needs a GET list endpoint (response array schema).');
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
      if (functionId && resolvedResponseFields.length === 0) {
        setColumnsWarning(
          'This GET route has no response row fields in OpenAPI. You can still continue if you add columns later in the Inspector.',
        );
      } else {
        setColumnsWarning(null);
      }
      setValidationError(null);
      return true;
    }
    if (stepIndex === 1 && enabledCount === 0) {
      setValidationError('Enable at least one column.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const canGenerate = enabledCount > 0 && Boolean(endpointPath.trim());

  const getResult = (): { config: AutoTableBuildConfig; suggestedName: string } | null => {
    if (!endpointPath.trim()) {
      setValidationError('Endpoint is required.');
      setStep(0);
      return null;
    }
    if (enabledCount === 0) {
      setValidationError('Enable at least one column.');
      setStep(1);
      return null;
    }

    const enabledFieldNames = columnConfigs
      .filter((entry) => entry.enabled)
      .map((entry) => entry.field.name);

    const buildConfig: AutoTableBuildConfig = {
      title: title.trim() || `${inferResourceNameFromEndpoint(endpointPath)} table`,
      includeTitle,
      dataSource: buildDataSourceFromEndpoint(endpointPath, {
        fields: Array.from(new Set(['id', ...enabledFieldNames])),
        primaryKey: 'id',
        method: 'GET',
      }),
      columns: columnConfigs,
      toolbar,
      rowActions,
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
    ? 'Generate table from API'
    : 'Build table from API';
  const wizardSubtitle = entryMode === 'canvas'
    ? 'Insert a wired App Table Grid into the canvas root or selected container.'
    : 'Generate a fully wired App Table Grid from a list API, then refine it in the designer.';
  const finalActionLabel = entryMode === 'canvas'
    ? 'Build into canvas'
    : 'Build & open in designer';
  const previewColumns = columnConfigs.filter((entry) => entry.enabled);

  const stepBody = (
    <>
        {validationError ? (
          <AppSurfaceBox tone="rose" className="mb-3 shrink-0 px-3 py-2 text-sm">
            {validationError}
          </AppSurfaceBox>
        ) : null}

        {visibleStep === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Choose a <span className="font-semibold">GET list</span> endpoint. Columns are inferred from the
              response row schema (not the request body).
            </p>
            <BindingApiEndpointPicker
              value={endpointPath}
              method={method}
              onChange={setEndpointPath}
              onMethodChange={setMethod}
              autoFocus
            />
            {isSchemaPending ? (
              <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading OpenAPI response schema…
              </p>
            ) : null}
            {!isSchemaPending && functionId && resolvedResponseFields.length > 0 ? (
              <p className="text-sm text-emerald-700">
                Detected {resolvedResponseFields.length} response field
                {resolvedResponseFields.length === 1 ? '' : 's'} for columns.
              </p>
            ) : null}
          </div>
        ) : null}

        {visibleStep === 1 ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {columnsWarning ? (
              <AppSurfaceBox tone="amber" className="shrink-0 px-3 py-2 text-sm">
                {columnsWarning}
              </AppSurfaceBox>
            ) : null}
            <div className={`min-h-0 flex-1 overflow-auto rounded-md ${NESTED_LAYER_DIVIDER_CLASS}`}>
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">On</th>
                    <th className="px-3 py-2 font-semibold">Field</th>
                    <th className="px-3 py-2 font-semibold">Label</th>
                    <th className="px-3 py-2 font-semibold">Display</th>
                    <th className="px-3 py-2 font-semibold">Sort</th>
                    <th className="px-3 py-2 font-semibold">Filter</th>
                  </tr>
                </thead>
                <tbody>
                  {columnConfigs.map((entry) => (
                    <tr key={entry.field.name} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        <UiCheckbox
                          size="sm"
                          checked={entry.enabled}
                          onChange={(event) => updateColumnConfig(entry.field.name, {
                            enabled: event.target.checked,
                          })}
                          aria-label={`Enable ${entry.field.name}`}
                        />
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs text-slate-700">{entry.field.name}</td>
                      <td className="px-3 py-1.5">
                        <UiInput
                          size="sm"
                          nested
                          value={entry.label}
                          onChange={(event) => updateColumnConfig(entry.field.name, { label: event.target.value })}
                          aria-label={`Label for ${entry.field.name}`}
                        />
                      </td>
                      <td className="px-3 py-1.5 min-w-[9rem]">
                        <UiSelect
                          size="sm"
                          nested
                          className="w-full"
                          value={entry.cellKind}
                          disabled={!entry.enabled}
                          onChange={(event) => updateColumnConfig(entry.field.name, {
                            cellKind: event.target.value as AutoTableCellKind,
                          })}
                          aria-label={`Display kind for ${entry.field.name}`}
                        >
                          {CELL_KIND_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </UiSelect>
                      </td>
                      <td className="px-3 py-1.5">
                        <UiCheckbox
                          size="sm"
                          checked={entry.sortable}
                          onChange={(event) => updateColumnConfig(entry.field.name, {
                            sortable: event.target.checked,
                          })}
                          aria-label={`Sortable ${entry.field.name}`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <UiCheckbox
                          size="sm"
                          checked={entry.filterable}
                          onChange={(event) => updateColumnConfig(entry.field.name, {
                            filterable: event.target.checked,
                          })}
                          aria-label={`Filterable ${entry.field.name}`}
                        />
                      </td>
                    </tr>
                  ))}
                  {columnConfigs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                        No response fields detected. Go back and pick another GET list endpoint.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="shrink-0 text-xs text-slate-500">
              {enabledCount} column{enabledCount === 1 ? '' : 's'} enabled
            </p>
          </div>
        ) : null}

        {visibleStep === 2 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-[2px]">
              <span className="ps-[4px] text-xs font-semibold uppercase tracking-wide text-slate-500">Page title</span>
              <div className="mt-[2px] flex flex-col gap-2">
                <UiCheckbox
                  size="sm"
                  checked={includeTitle}
                  onChange={(event) => setIncludeTitle(event.target.checked)}
                >
                  Include heading above the table
                </UiCheckbox>
                {includeTitle ? (
                  <UiInput
                    size="sm"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Users table"
                    aria-label="Table title"
                  />
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="ps-[4px] text-xs font-semibold uppercase tracking-wide text-slate-500">Toolbar</span>
              <UiCheckbox
                size="sm"
                checked={toolbar.search}
                onChange={(event) => setToolbar((current) => ({ ...current, search: event.target.checked }))}
              >
                Search box (syncs to API query string)
              </UiCheckbox>
              <UiCheckbox
                size="sm"
                checked={toolbar.refresh}
                onChange={(event) => setToolbar((current) => ({ ...current, refresh: event.target.checked }))}
              >
                Refresh button
              </UiCheckbox>
              <UiCheckbox
                size="sm"
                checked={toolbar.createButton}
                onChange={(event) => setToolbar((current) => ({ ...current, createButton: event.target.checked }))}
              >
                Create / Add button (wire in Records page builder)
              </UiCheckbox>
              <p className="text-xs text-slate-500">
                Server query sync (sort / page / column filters) is always enabled for API-backed tables so Export
                builds real query strings from day one.
              </p>
            </div>
          </div>
        ) : null}

        {visibleStep === 3 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Optional row actions. Edit / Delete are scaffolding for the Records page builder; Details uses the
              existing detail-flow behavior.
            </p>
            {ROW_ACTION_OPTIONS.map((option) => (
              <div key={option.value} className={`flex flex-col gap-[2px] rounded-md ${NESTED_LAYER_DIVIDER_CLASS} px-3 py-2`}>
                <UiCheckbox
                  size="sm"
                  checked={rowActions.includes(option.value)}
                  onChange={(event) => toggleRowAction(option.value, event.target.checked)}
                >
                  {option.label}
                </UiCheckbox>
                <p className="ps-[4px] text-xs text-slate-500">{option.hint}</p>
              </div>
            ))}
          </div>
        ) : null}

        {visibleStep === 4 ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <AppSurfaceBox tone="slate" className="shrink-0 px-3 py-2 text-sm">
              <div className="font-semibold text-slate-800">{suggestedName}</div>
              <div className="mt-1 text-slate-600">
                Endpoint <span className="font-mono text-xs">{endpointPath || '—'}</span>
                {' · '}
                {enabledCount} column{enabledCount === 1 ? '' : 's'}
                {toolbar.search ? ' · search' : ''}
                {toolbar.refresh ? ' · refresh' : ''}
                {rowActions.length > 0 ? ` · actions: ${rowActions.join(', ')}` : ''}
              </div>
            </AppSurfaceBox>
            <div className={`min-h-0 flex-1 overflow-auto rounded-md ${NESTED_LAYER_DIVIDER_CLASS}`}>
              <table className="w-full border-collapse text-left text-sm" data-testid="auto-table-column-preview">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {previewColumns.map((entry) => (
                      <th key={entry.field.name} className="px-3 py-2 font-semibold">
                        {entry.label || humanizeFieldName(entry.field.name)}
                      </th>
                    ))}
                    {rowActions.length > 0 ? (
                      <th className="px-3 py-2 font-semibold">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100 text-slate-400">
                    {previewColumns.map((entry) => (
                      <td key={entry.field.name} className="px-3 py-2">
                        <span className="font-mono text-[11px]">{entry.cellKind}</span>
                      </td>
                    ))}
                    {rowActions.length > 0 ? (
                      <td className="px-3 py-2 text-xs">{rowActions.join(' / ')}</td>
                    ) : null}
                  </tr>
                </tbody>
              </table>
            </div>
            <AppButton
              intent="secondary"
              size="sm"
              className="self-start"
              onClick={() => {
                setColumnConfigs((current) => current.map((entry) => ({
                  ...entry,
                  cellKind: suggestCellKindForField(entry.field),
                })));
              }}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Re-suggest display kinds
            </AppButton>
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
        titleIcon={Table2}
        subtitle={wizardSubtitle}
        steps={WIZARD_STEPS}
        step={step}
        onStepChange={(next) => {
          setValidationError(null);
          if (next !== 1) {
            setColumnsWarning(null);
          }
          setStep(next);
        }}
        onClose={onClose}
        onBackdropClick={onClose}
        onNext={() => validateStep(step)}
        bodyInnerClassName={resolveAutoTableBodyInnerClassName(step)}
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

AutoTableWizardDialog.displayName = 'AutoTableWizardDialog';
