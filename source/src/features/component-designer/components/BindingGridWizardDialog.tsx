import * as React from 'react';
import { ClipboardCheck, Columns3, Link2, Table2 } from 'lucide-react';
import type { DataSourceDefinition, DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  buildGridBindingWizardActions,
  suggestGridColumnFieldMapping,
} from '../../../domain/component-designer/bindingGridEngine';
import { buildGridListRequestPreview } from '../../../domain/component-designer/bindingPayloadPreview';
import {
  buildGridColumnWizardRows,
  isActionGridColumn,
  isDefaultDesignerDataGridColumnsValue,
  parseDesignerDataGridColumns,
  wizardRowsToGridColumns,
  type GridColumnWizardRow,
} from '../../../domain/component-designer/designerDataGridColumns';
import { getNodeGridListResourceRef } from '../../../domain/component-designer/bindingGridEngine';
import { getDataSources } from '../../../domain/component-designer/bindingRegistry';
import { buildDataSourceFieldsSyncKey } from '../../../domain/component-designer/bindingResourceModel';
import { collectNodeBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { StepWizardShell, type StepWizardStepDef } from '../../../shared/ui/StepWizardShell';
import { DesignerDialogHostContext } from '../../../shared/ui/designerDialogHostContext';
import { BindingGridColumnConfigStep } from './BindingGridColumnConfigStep';
import { BindingHealthSummary } from './BindingHealthSummary';
import { BindingRequestPreview } from './BindingRequestPreview';
import { BindingResourceQuickConnect } from './BindingResourceQuickConnect';

const WIZARD_STEPS: readonly StepWizardStepDef[] = [
  {
    title: 'Connect',
    icon: Table2,
    description: 'Connect this grid to a list API endpoint.',
  },
  {
    title: 'Columns',
    icon: Columns3,
    description: 'Choose visible columns and sort/filter behavior.',
  },
  {
    title: 'Done',
    icon: ClipboardCheck,
    description: 'Confirm and apply the grid binding.',
  },
];

type BindingGridWizardDialogProps = {
  open: boolean;
  onClose: () => void;
  document: DesignerDocument;
  gridNode: DesignerNode;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

export const BindingGridWizardDialog: React.FC<BindingGridWizardDialogProps> = ({
  open,
  onClose,
  document,
  gridNode,
  bindingDefinitions,
  dispatch,
}) => {
  const dataSourceOptions = React.useMemo(
    () => Object.values(getDataSources(bindingDefinitions)),
    [bindingDefinitions],
  );

  const [step, setStep] = React.useState(0);
  const [dataSourceId, setDataSourceId] = React.useState(() => getNodeGridListResourceRef(gridNode) ?? dataSourceOptions[0]?.id ?? '');
  const [quickEndpoint, setQuickEndpoint] = React.useState('');
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [columnRows, setColumnRows] = React.useState<GridColumnWizardRow[]>([]);
  const [quickConnectSession, setQuickConnectSession] = React.useState(0);

  const hasExistingListBinding = Boolean(getNodeGridListResourceRef(gridNode));
  const selectedDataSource = dataSourceId ? bindingDefinitions.dataSources[dataSourceId] : undefined;

  const columns = React.useMemo(
    () => parseDesignerDataGridColumns(gridNode.props.columns),
    [gridNode.props.columns],
  );

  const suggestedFields = React.useMemo(() => {
    if (isDefaultDesignerDataGridColumnsValue(gridNode.props.columns)) {
      return [];
    }

    return columns
      .map((column) => column.key)
      .filter((key) => !key.startsWith('__action_'));
  }, [gridNode.props.columns, columns]);

  const buildColumnRows = React.useCallback((
    source: DataSourceDefinition | undefined,
    sourceId: string,
  ): GridColumnWizardRow[] => {
    if (!source) {
      return buildGridColumnWizardRows(gridNode.props.columns, [], hasExistingListBinding);
    }

    return buildGridColumnWizardRows(
      gridNode.props.columns,
      source.fields,
      sourceId === getNodeGridListResourceRef(gridNode) && hasExistingListBinding,
    );
  }, [gridNode.props.columns, hasExistingListBinding, gridNode]);

  const initializedColumnSourceRef = React.useRef<string | null>(null);

  const columnSourceSyncKey = selectedDataSource
    ? buildDataSourceFieldsSyncKey(dataSourceId, selectedDataSource)
    : dataSourceId;

  React.useEffect(() => {
    if (!open) {
      initializedColumnSourceRef.current = null;
      return;
    }

    const existingRef = getNodeGridListResourceRef(gridNode);
    const existingSource = existingRef ? bindingDefinitions.dataSources[existingRef] : undefined;
    const initialSourceId = existingRef ?? dataSourceOptions[0]?.id ?? '';

    setStep(0);
    setDataSourceId(initialSourceId);
    setQuickEndpoint(existingSource?.endpoint ?? '');
    setValidationError(null);
    setColumnRows(buildColumnRows(existingSource, initialSourceId));
    initializedColumnSourceRef.current = buildDataSourceFieldsSyncKey(initialSourceId, existingSource);
    setQuickConnectSession((current) => current + 1);
  }, [open, gridNode, bindingDefinitions, dataSourceOptions, buildColumnRows]);

  React.useEffect(() => {
    if (!open || !selectedDataSource || !dataSourceId.trim()) {
      return;
    }

    if (initializedColumnSourceRef.current === columnSourceSyncKey) {
      return;
    }

    setColumnRows(buildColumnRows(selectedDataSource, dataSourceId));
    initializedColumnSourceRef.current = columnSourceSyncKey;
  }, [open, selectedDataSource, dataSourceId, columnSourceSyncKey, buildColumnRows]);

  const previewColumns = React.useMemo(
    () => wizardRowsToGridColumns(columnRows),
    [columnRows],
  );

  const fieldMappings = selectedDataSource
    ? previewColumns
      .filter((column) => !isActionGridColumn(column))
      .map((column) => ({
        column: column.key,
        field: suggestGridColumnFieldMapping(column.key, selectedDataSource.fields.length > 0
          ? selectedDataSource.fields
          : suggestedFields),
      }))
    : [];

  const requestPreview = dataSourceId ? buildGridListRequestPreview(dataSourceId, bindingDefinitions) : null;
  const health = React.useMemo(
    () => collectNodeBindingHealth(document, bindingDefinitions, gridNode.id),
    [bindingDefinitions, document, gridNode.id],
  );

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0 && !dataSourceId.trim()) {
      setValidationError('Connect an API path or select a list resource.');
      return false;
    }

    if (stepIndex === 1) {
      const enabledDataColumns = columnRows.filter((row) => row.enabled && !row.isAction);
      if (enabledDataColumns.length === 0) {
        setValidationError('Enable at least one data column for the grid.');
        return false;
      }
    }

    setValidationError(null);
    return true;
  };

  const upsertDataSource = (dataSource: DataSourceDefinition) => {
    dispatch({
      type: 'set-data-source',
      dataSourceId: dataSource.id,
      dataSource,
    });
    setDataSourceId(dataSource.id);
    setColumnRows(buildColumnRows(dataSource, dataSource.id));
    initializedColumnSourceRef.current = buildDataSourceFieldsSyncKey(dataSource.id, dataSource);
  };

  const handleApply = () => {
    if (!dataSourceId.trim()) {
      setValidationError('Resource is required.');
      setStep(0);
      return;
    }

    const resolvedSource = bindingDefinitions.dataSources[dataSourceId];
    if (!resolvedSource) {
      setValidationError('Connect an API path or select a resource first.');
      setStep(0);
      return;
    }

    const nextColumns = wizardRowsToGridColumns(columnRows);
    if (nextColumns.filter((column) => !isActionGridColumn(column)).length === 0) {
      setValidationError('Enable at least one data column for the grid.');
      setStep(1);
      return;
    }

    for (const action of buildGridBindingWizardActions(gridNode, resolvedSource, { columns: nextColumns })) {
      dispatch(action);
    }

    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <DesignerDialogHostContext.Provider value>
      <StepWizardShell
      size="4xl"
      title="Connect Grid to API"
      titleIcon={Table2}
      subtitle="Paste a list endpoint — rows load automatically"
      steps={WIZARD_STEPS}
      step={step}
      onStepChange={(next) => {
        setValidationError(null);
        setStep(next);
      }}
      onClose={onClose}
      onBackdropClick={onClose}
      onNext={validateStep}
      finalStepAction={{
        label: 'Apply & connect',
        icon: <Link2 className="h-3.5 w-3.5" strokeWidth={2} />,
        onClick: handleApply,
        disabled: !dataSourceId.trim(),
      }}
    >
      {validationError ? (
        <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {validationError}
        </div>
      ) : null}

      {step === 0 ? (
        <BindingResourceQuickConnect
          key={quickConnectSession}
          bindingDefinitions={bindingDefinitions}
          dataSourceId={dataSourceId}
          quickEndpoint={quickEndpoint}
          suggestedFields={suggestedFields}
          defaultMethod="GET"
          methodFilter={['GET']}
          fieldSource="response"
          onDataSourceIdChange={setDataSourceId}
          onQuickEndpointChange={setQuickEndpoint}
          onCreateResource={upsertDataSource}
        />
      ) : null}

      {step === 1 ? (
        <BindingGridColumnConfigStep
          rows={columnRows}
          onRowsChange={setColumnRows}
        />
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-3">
          {fieldMappings.length > 0 ? (
            <AppSurfaceBox tone="cyan" title="Columns from API">
              <p className="mb-2 ps-[4px] text-xs text-slate-600">
                These columns will appear in the grid after apply. Adjust them anytime in the inspector.
              </p>
              <ul className="space-y-0.5 font-mono text-[11px] text-slate-600">
                {fieldMappings.map((entry) => (
                  <li key={entry.column} className="rounded-md border border-slate-100 bg-white px-2 py-1">
                    {entry.column} → {entry.field || entry.column}
                  </li>
                ))}
              </ul>
            </AppSurfaceBox>
          ) : (
            <AppSurfaceBox tone="amber" title="No columns selected">
              <p className="text-xs text-slate-600">
                Go back to the Columns step and enable at least one field.
              </p>
            </AppSurfaceBox>
          )}

          {requestPreview ? (
            <BindingRequestPreview
              summary={{
                method: requestPreview.method,
                endpoint: requestPreview.endpoint,
                bodyEntries: [],
                onSuccess: 'Rows load from list response',
              }}
            />
          ) : null}

          <BindingHealthSummary summary={health} />
        </div>
      ) : null}
      </StepWizardShell>
    </DesignerDialogHostContext.Provider>
  );
};
