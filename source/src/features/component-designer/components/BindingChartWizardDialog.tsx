import * as React from 'react';
import { BarChart3, ClipboardCheck, Columns3, Filter, Link2, Plus, Trash2 } from 'lucide-react';
import type { DataSourceDefinition, DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  buildChartBindingWizardActions,
  buildDefaultChartFieldMapping,
  chartMappingCategoryField,
  chartMappingToSeriesView,
  getNodeChartDataResourceRef,
  parseDesignerChartFieldMapping,
  resolveChartMappingTypeFromNode,
  resolveNodeChartDataSourceEntries,
  type DesignerChartFieldMapping,
} from '../../../domain/component-designer/bindingChartEngine';
import {
  buildDefaultChartToolbarConfig,
  parseDesignerChartToolbarConfig,
  type DesignerChartToolbarConfig,
} from '../../../domain/component-designer/designerChartToolbarConfig';
import { getDataSources } from '../../../domain/component-designer/bindingRegistry';
import { buildDataSourceFieldsSyncKey } from '../../../domain/component-designer/bindingResourceModel';
import { collectNodeBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { StepWizardShell, type StepWizardStepDef } from '../../../shared/ui/StepWizardShell';
import { DesignerDialogHostContext } from '../../../shared/ui/designerDialogHostContext';
import { BindingChartFieldMappingStep } from './BindingChartFieldMappingStep';
import { BindingChartFilterConfigStep } from './BindingChartFilterConfigStep';
import { BindingHealthSummary } from './BindingHealthSummary';
import { BindingResourceQuickConnect } from './BindingResourceQuickConnect';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

const WIZARD_STEPS: readonly StepWizardStepDef[] = [
  {
    title: 'Connect',
    icon: BarChart3,
    description: 'Connect this chart to one or more list or stats API endpoints.',
  },
  {
    title: 'Map fields',
    icon: Columns3,
    description: 'Map API fields to this chart type for each data source.',
  },
  {
    title: 'Filters',
    icon: Filter,
    description: 'Configure runtime filters and refresh behavior.',
  },
  {
    title: 'Done',
    icon: ClipboardCheck,
    description: 'Confirm and apply the chart binding.',
  },
];

type WizardDataSourceState = {
  dataSourceId: string;
  fieldMapping: DesignerChartFieldMapping;
};

type BindingChartWizardDialogProps = {
  open: boolean;
  onClose: () => void;
  document: DesignerDocument;
  chartNode: DesignerNode;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

const mappingHasRequiredFields = (mapping: DesignerChartFieldMapping): boolean => {
  switch (mapping.chartType) {
    case 'bar':
    case 'line':
      return mapping.valueFields.length > 0 && mapping.categoryField.trim().length > 0;
    case 'pie':
    case 'donut':
    case 'gauge':
      return mapping.labelField.trim().length > 0 && mapping.valueField.trim().length > 0;
    case 'sparkline':
      return mapping.valueField.trim().length > 0;
  }
};

const summarizeMapping = (mapping: DesignerChartFieldMapping): { category: string; series: string } => {
  const series = chartMappingToSeriesView(mapping)
    .map((entry) => (
      `${entry.label ?? entry.apiField} ← ${entry.apiField}${entry.aggregation && entry.aggregation !== 'none' ? ` (${entry.aggregation})` : ''}`
    ))
    .join('; ');
  return {
    category: chartMappingCategoryField(mapping),
    series: series || '(none)',
  };
};

const buildInitialDataSources = (
  chartNode: DesignerNode,
  bindingDefinitions: DesignerBindingDefinitions,
  dataSourceOptions: DataSourceDefinition[],
  chartType: ReturnType<typeof resolveChartMappingTypeFromNode>,
): WizardDataSourceState[] => {
  const existingEntries = resolveNodeChartDataSourceEntries(chartNode, { chartTypeHint: chartType });
  if (existingEntries.length > 0) {
    return existingEntries.map((entry) => ({
      dataSourceId: entry.dataSourceRef,
      fieldMapping: entry.fieldMapping,
    }));
  }

  const fallbackId = getNodeChartDataResourceRef(chartNode) ?? dataSourceOptions[0]?.id ?? '';
  const fallbackSource = fallbackId ? bindingDefinitions.dataSources[fallbackId] : undefined;
  return [{
    dataSourceId: fallbackId,
    fieldMapping: parseDesignerChartFieldMapping(chartNode.props.chartFieldMapping, { chartTypeHint: chartType })
      ?? buildDefaultChartFieldMapping(fallbackSource?.fields ?? [], chartType),
  }];
};

export const BindingChartWizardDialog: React.FC<BindingChartWizardDialogProps> = ({
  open,
  onClose,
  document,
  chartNode,
  bindingDefinitions,
  dispatch,
}) => {
  const chartType = resolveChartMappingTypeFromNode(chartNode);
  const dataSourceOptions = React.useMemo(
    () => Object.values(getDataSources(bindingDefinitions)),
    [bindingDefinitions],
  );

  const [step, setStep] = React.useState(0);
  const [activeMappingIndex, setActiveMappingIndex] = React.useState(0);
  const [dataSources, setDataSources] = React.useState<WizardDataSourceState[]>(() =>
    buildInitialDataSources(chartNode, bindingDefinitions, dataSourceOptions, chartType),
  );
  const [quickEndpoint, setQuickEndpoint] = React.useState('');
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [toolbarConfig, setToolbarConfig] = React.useState<DesignerChartToolbarConfig>(() =>
    parseDesignerChartToolbarConfig(chartNode.props.chartToolbarConfig).enabled === true
      ? parseDesignerChartToolbarConfig(chartNode.props.chartToolbarConfig)
      : buildDefaultChartToolbarConfig(chartNode.id),
  );
  const [quickConnectSession, setQuickConnectSession] = React.useState(0);

  const initializedFieldSourceRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      initializedFieldSourceRef.current = null;
      return;
    }

    const initialSources = buildInitialDataSources(chartNode, bindingDefinitions, dataSourceOptions, chartType);
    const primarySource = initialSources[0]?.dataSourceId
      ? bindingDefinitions.dataSources[initialSources[0].dataSourceId]
      : undefined;

    setDataSources(initialSources);
    setActiveMappingIndex(0);
    setQuickEndpoint(primarySource?.endpoint ?? '');
    setStep(0);
    setValidationError(null);
    setToolbarConfig(
      parseDesignerChartToolbarConfig(chartNode.props.chartToolbarConfig).enabled === true
        ? parseDesignerChartToolbarConfig(chartNode.props.chartToolbarConfig)
        : buildDefaultChartToolbarConfig(chartNode.id),
    );
    initializedFieldSourceRef.current = primarySource && initialSources[0]?.dataSourceId
      ? buildDataSourceFieldsSyncKey(initialSources[0].dataSourceId, primarySource)
      : initialSources[0]?.dataSourceId ?? null;
    setQuickConnectSession((current) => current + 1);
  }, [chartNode, bindingDefinitions, dataSourceOptions, chartType, open]);

  const activeSource = dataSources[activeMappingIndex];
  const selectedDataSource = activeSource?.dataSourceId
    ? bindingDefinitions.dataSources[activeSource.dataSourceId]
    : undefined;
  const fieldSourceSyncKey = selectedDataSource && activeSource?.dataSourceId
    ? buildDataSourceFieldsSyncKey(activeSource.dataSourceId, selectedDataSource)
    : activeSource?.dataSourceId ?? '';

  React.useEffect(() => {
    if (!open || !selectedDataSource || !activeSource?.dataSourceId) {
      return;
    }
    if (initializedFieldSourceRef.current === fieldSourceSyncKey) {
      return;
    }
    initializedFieldSourceRef.current = fieldSourceSyncKey;

    const existingEntries = resolveNodeChartDataSourceEntries(chartNode, { chartTypeHint: chartType });
    const existingEntry = existingEntries[activeMappingIndex];
    if (!existingEntry || existingEntry.dataSourceRef !== activeSource.dataSourceId) {
      setDataSources((current) => current.map((entry, index) => (
        index === activeMappingIndex
          ? { ...entry, fieldMapping: buildDefaultChartFieldMapping(selectedDataSource.fields, chartType) }
          : entry
      )));
    }
  }, [activeMappingIndex, activeSource?.dataSourceId, chartNode, chartType, fieldSourceSyncKey, open, selectedDataSource]);

  const health = React.useMemo(
    () => collectNodeBindingHealth(document, bindingDefinitions, chartNode.id),
    [bindingDefinitions, chartNode.id, document],
  );

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      if (dataSources.some((entry) => !entry.dataSourceId.trim())) {
        setValidationError('Connect an API path or select a list resource for each data source.');
        return false;
      }
    }
    if (stepIndex === 1) {
      if (dataSources.some((entry) => !mappingHasRequiredFields(entry.fieldMapping))) {
        setValidationError('Complete the field mapping for each connected data source.');
        return false;
      }
    }
    setValidationError(null);
    return true;
  };

  const upsertDataSourceAtIndex = (index: number, dataSource: DataSourceDefinition) => {
    dispatch({
      type: 'set-data-source',
      dataSourceId: dataSource.id,
      dataSource,
    });
    setDataSources((current) => current.map((entry, entryIndex) => (
      entryIndex === index
        ? {
          dataSourceId: dataSource.id,
          fieldMapping: buildDefaultChartFieldMapping(dataSource.fields, chartType),
        }
        : entry
    )));
    initializedFieldSourceRef.current = buildDataSourceFieldsSyncKey(dataSource.id, dataSource);
  };

  const addAnotherDataSource = () => {
    const nextId = dataSourceOptions.find((option) =>
      !dataSources.some((entry) => entry.dataSourceId === option.id),
    )?.id ?? dataSourceOptions[0]?.id ?? '';
    const nextSource = nextId ? bindingDefinitions.dataSources[nextId] : undefined;
    setDataSources((current) => [
      ...current,
      {
        dataSourceId: nextId,
        fieldMapping: buildDefaultChartFieldMapping(nextSource?.fields ?? [], chartType),
      },
    ]);
    setActiveMappingIndex(dataSources.length);
  };

  const removeDataSourceAtIndex = (index: number) => {
    if (dataSources.length <= 1) {
      return;
    }
    setDataSources((current) => current.filter((_, entryIndex) => entryIndex !== index));
    setActiveMappingIndex((current) => Math.max(0, Math.min(current, dataSources.length - 2)));
  };

  const handleApply = () => {
    const resolvedSources = dataSources
      .map((entry) => {
        const resolvedSource = bindingDefinitions.dataSources[entry.dataSourceId];
        if (!resolvedSource) {
          return null;
        }
        return {
          dataSource: resolvedSource,
          fieldMapping: entry.fieldMapping,
        };
      })
      .filter((entry): entry is { dataSource: DataSourceDefinition; fieldMapping: DesignerChartFieldMapping } => entry !== null);

    if (resolvedSources.length === 0) {
      setValidationError('Connect an API path or select a resource first.');
      setStep(0);
      return;
    }

    for (const action of buildChartBindingWizardActions(chartNode, resolvedSources, { toolbarConfig })) {
      dispatch(action);
    }

    onClose();
  };

  if (!open) {
    return null;
  }

  const primarySummary = summarizeMapping(dataSources[0]?.fieldMapping ?? buildDefaultChartFieldMapping([], chartType));

  return (
    <DesignerDialogHostContext.Provider value>
      <StepWizardShell
        size="4xl"
        title="Connect Chart to API"
        titleIcon={BarChart3}
        subtitle="Paste one or more list endpoints — fields map to this chart type automatically"
        steps={WIZARD_STEPS}
        step={step}
        onStepChange={(next) => {
          setValidationError(null);
          setStep(next);
        }}
        onClose={onClose}
        onBackdropClick={onClose}
        onNext={() => validateStep(step)}
        finalStepAction={{
          label: 'Apply & connect',
          icon: <Link2 className="h-3.5 w-3.5" strokeWidth={2} />,
          onClick: handleApply,
          disabled: dataSources.every((entry) => !entry.dataSourceId.trim()),
        }}
      >
        {validationError ? (
          <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {validationError}
          </div>
        ) : null}

        {step === 0 ? (
          <div className="space-y-3">
            {dataSources.map((entry, index) => {
              const sourceLabel = index === 0 ? 'Primary data source' : `Additional data source ${index + 1}`;
              return (
                <AppSurfaceBox key={`chart-source-${index}`} className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">{sourceLabel}</p>
                    {index > 0 ? (
                      <AppButton
                        type="button"
                        intent="destructive"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => removeDataSourceAtIndex(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </AppButton>
                    ) : null}
                  </div>
                  <BindingResourceQuickConnect
                    key={`${quickConnectSession}-${index}`}
                    bindingDefinitions={bindingDefinitions}
                    dataSourceId={entry.dataSourceId}
                    quickEndpoint={index === activeMappingIndex ? quickEndpoint : bindingDefinitions.dataSources[entry.dataSourceId]?.endpoint ?? ''}
                    onDataSourceIdChange={(nextId) => {
                      setActiveMappingIndex(index);
                      setDataSources((current) => current.map((currentEntry, entryIndex) => (
                        entryIndex === index ? { ...currentEntry, dataSourceId: nextId } : currentEntry
                      )));
                    }}
                    onQuickEndpointChange={index === activeMappingIndex ? setQuickEndpoint : () => {}}
                    onCreateResource={(dataSource) => upsertDataSourceAtIndex(index, dataSource)}
                    defaultMethod="GET"
                    methodFilter={['GET']}
                    fieldSource="response"
                  />
                </AppSurfaceBox>
              );
            })}
            <AppButton
              type="button"
              intent="secondary"
              size="sm"
              className="h-8 w-full"
              onClick={addAnotherDataSource}
              disabled={dataSourceOptions.length === 0}
            >
              <Plus className="h-3.5 w-3.5" />
              Add another data source
            </AppButton>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            {dataSources.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {dataSources.map((entry, index) => {
                  const label = bindingDefinitions.dataSources[entry.dataSourceId]?.name ?? entry.dataSourceId ?? `Source ${index + 1}`;
                  return (
                    <AppButton
                      key={`mapping-tab-${index}`}
                      type="button"
                      intent={activeMappingIndex === index ? 'primary' : 'secondary'}
                      size="sm"
                      className="h-7 px-2.5 text-[11px]"
                      onClick={() => setActiveMappingIndex(index)}
                    >
                      {label}
                    </AppButton>
                  );
                })}
              </div>
            ) : null}
            {selectedDataSource ? (
              <AppSurfaceBox className="p-3">
                <BindingChartFieldMappingStep
                  availableFields={selectedDataSource.fields}
                  mapping={activeSource?.fieldMapping ?? buildDefaultChartFieldMapping(selectedDataSource.fields, chartType)}
                  chartType={chartType}
                  dataSourceOptions={Object.values(bindingDefinitions.dataSources).map((source) => ({
                    id: source.id,
                    name: source.name,
                  }))}
                  allowComparisonSeries={activeMappingIndex === 0 && (chartType === 'bar' || chartType === 'line')}
                  onChange={(nextMapping) => {
                    setDataSources((current) => current.map((entry, index) => (
                      index === activeMappingIndex
                        ? { ...entry, fieldMapping: nextMapping }
                        : entry
                    )));
                  }}
                />
              </AppSurfaceBox>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <AppSurfaceBox className="p-3">
            <BindingChartFilterConfigStep
              nodeId={chartNode.id}
              config={toolbarConfig}
              onChange={setToolbarConfig}
              availableFields={selectedDataSource?.fields ?? []}
            />
          </AppSurfaceBox>
        ) : null}

        {step === 3 ? (
          <AppSurfaceBox className="space-y-3 p-3">
            <BindingHealthSummary summary={health} />
            <div className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2 text-[11px] text-slate-600`}>
              <p className="font-medium text-slate-800">Summary</p>
              <ul className="mt-1 space-y-1">
                <li>Data sources: {dataSources.length}</li>
                <li>Chart type: {chartType}</li>
                <li>Category / label: {primarySummary.category}</li>
                <li>Series / value: {primarySummary.series}</li>
                <li>Runtime filters: {toolbarConfig.runtimeEnabled ? 'enabled' : 'design-time only'}</li>
              </ul>
              {dataSources.length > 1 ? (
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                  {dataSources.map((entry, index) => {
                    const source = bindingDefinitions.dataSources[entry.dataSourceId];
                    const mappingSummary = summarizeMapping(entry.fieldMapping);
                    return (
                      <li key={`summary-source-${index}`}>
                        <span className="font-medium text-slate-700">{source?.name ?? entry.dataSourceId}:</span>{' '}
                        {mappingSummary.series}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </AppSurfaceBox>
        ) : null}
      </StepWizardShell>
    </DesignerDialogHostContext.Provider>
  );
};
