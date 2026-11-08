import * as React from 'react';
import { ClipboardCheck, Columns3, Filter, LayoutDashboard, Link2 } from 'lucide-react';
import type { DataSourceDefinition, DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  buildDefaultVizFieldMapping,
  parseDesignerVizFieldMapping,
  resolveVizWidgetKindFromPaletteId,
  type DesignerVizFieldMapping,
} from '../../../domain/component-designer/visualizationDataTransform';
import {
  buildVizBindingWizardActions,
  getNodeVizDataResourceRef,
  resolveVizWidgetKindForNode,
} from '../../../domain/component-designer/bindingVizEngine';
import {
  buildDefaultChartToolbarConfig,
  parseDesignerChartToolbarConfig,
  type DesignerChartToolbarConfig,
} from '../../../domain/component-designer/designerChartToolbarConfig';
import { getDataSources } from '../../../domain/component-designer/bindingRegistry';
import { buildDataSourceFieldsSyncKey } from '../../../domain/component-designer/bindingResourceModel';
import { collectNodeBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import { getNodePaletteItemId } from '../../../domain/component-designer/runtimeShared';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { StepWizardShell, type StepWizardStepDef } from '../../../shared/ui/StepWizardShell';
import { DesignerDialogHostContext } from '../../../shared/ui/designerDialogHostContext';
import { BindingChartFilterConfigStep } from './BindingChartFilterConfigStep';
import { BindingHealthSummary } from './BindingHealthSummary';
import { BindingResourceQuickConnect } from './BindingResourceQuickConnect';
import { BindingVizFieldMappingStep } from './BindingVizFieldMappingStep';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

const WIZARD_STEPS: readonly StepWizardStepDef[] = [
  { title: 'Connect', icon: LayoutDashboard, description: 'Connect this widget to a list API endpoint.' },
  { title: 'Map fields', icon: Columns3, description: 'Map API fields to the widget data shape.' },
  { title: 'Filters', icon: Filter, description: 'Configure runtime filters and refresh behavior.' },
  { title: 'Done', icon: ClipboardCheck, description: 'Confirm and apply the data binding.' },
];

type BindingVizWizardDialogProps = {
  open: boolean;
  onClose: () => void;
  document: DesignerDocument;
  vizNode: DesignerNode;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

export const BindingVizWizardDialog: React.FC<BindingVizWizardDialogProps> = ({
  open,
  onClose,
  document,
  vizNode,
  bindingDefinitions,
  dispatch,
}) => {
  const widgetKind = resolveVizWidgetKindForNode(vizNode);
  const dataSourceOptions = React.useMemo(
    () => Object.values(getDataSources(bindingDefinitions)),
    [bindingDefinitions],
  );

  const [step, setStep] = React.useState(0);
  const [dataSourceId, setDataSourceId] = React.useState(() => getNodeVizDataResourceRef(vizNode) ?? dataSourceOptions[0]?.id ?? '');
  const [quickEndpoint, setQuickEndpoint] = React.useState('');
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [fieldMapping, setFieldMapping] = React.useState<DesignerVizFieldMapping>(() =>
    parseDesignerVizFieldMapping(vizNode.props.vizFieldMapping)
    ?? buildDefaultVizFieldMapping(widgetKind ?? 'tree', []),
  );
  const [toolbarConfig, setToolbarConfig] = React.useState<DesignerChartToolbarConfig>(() =>
    parseDesignerChartToolbarConfig(vizNode.props.vizToolbarConfig).enabled === true
      ? parseDesignerChartToolbarConfig(vizNode.props.vizToolbarConfig)
      : buildDefaultChartToolbarConfig(vizNode.id),
  );

  const selectedDataSource = dataSourceId ? bindingDefinitions.dataSources[dataSourceId] : undefined;

  React.useEffect(() => {
    if (!open || !widgetKind) {
      return;
    }
    setDataSourceId(getNodeVizDataResourceRef(vizNode) ?? dataSourceOptions[0]?.id ?? '');
    setStep(0);
    setValidationError(null);
    setFieldMapping(
      parseDesignerVizFieldMapping(vizNode.props.vizFieldMapping)
      ?? buildDefaultVizFieldMapping(widgetKind, selectedDataSource?.fields ?? []),
    );
    setToolbarConfig(
      parseDesignerChartToolbarConfig(vizNode.props.vizToolbarConfig).enabled === true
        ? parseDesignerChartToolbarConfig(vizNode.props.vizToolbarConfig)
        : buildDefaultChartToolbarConfig(vizNode.id),
    );
  }, [dataSourceOptions, open, selectedDataSource?.fields, vizNode, widgetKind]);

  React.useEffect(() => {
    if (!open || !selectedDataSource || !widgetKind) {
      return;
    }
    if (dataSourceId !== getNodeVizDataResourceRef(vizNode)) {
      setFieldMapping(buildDefaultVizFieldMapping(widgetKind, selectedDataSource.fields));
    }
  }, [dataSourceId, open, selectedDataSource, vizNode, widgetKind]);

  const health = React.useMemo(
    () => collectNodeBindingHealth(document, bindingDefinitions, vizNode.id),
    [bindingDefinitions, document, vizNode.id],
  );

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0 && !dataSourceId.trim()) {
      setValidationError('Connect an API path or select a list resource.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const upsertDataSource = (dataSource: DataSourceDefinition) => {
    dispatch({ type: 'set-data-source', dataSourceId: dataSource.id, dataSource });
    setDataSourceId(dataSource.id);
    if (widgetKind) {
      setFieldMapping(buildDefaultVizFieldMapping(widgetKind, dataSource.fields));
    }
  };

  const handleApply = () => {
    const resolvedSource = bindingDefinitions.dataSources[dataSourceId];
    if (!resolvedSource) {
      setValidationError('Connect an API path or select a resource first.');
      setStep(0);
      return;
    }

    for (const action of buildVizBindingWizardActions(vizNode, resolvedSource, { fieldMapping, toolbarConfig })) {
      dispatch(action);
    }
    onClose();
  };

  if (!open || !widgetKind) {
    return null;
  }

  const widgetLabel = getNodePaletteItemId(vizNode) ?? widgetKind;

  return (
    <DesignerDialogHostContext.Provider value>
      <StepWizardShell
        size="4xl"
        title="Connect Widget to API"
        titleIcon={LayoutDashboard}
        subtitle={`Bind ${widgetLabel} to live API data`}
        steps={WIZARD_STEPS}
        step={step}
        onStepChange={(next) => { setValidationError(null); setStep(next); }}
        onClose={onClose}
        onBackdropClick={onClose}
        onNext={() => validateStep(step)}
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
          <AppSurfaceBox className="p-3">
            <BindingResourceQuickConnect
              bindingDefinitions={bindingDefinitions}
              dataSourceId={dataSourceId}
              quickEndpoint={quickEndpoint}
              onDataSourceIdChange={setDataSourceId}
              onQuickEndpointChange={setQuickEndpoint}
              onCreateResource={upsertDataSource}
              defaultMethod="GET"
              methodFilter={['GET']}
              fieldSource="response"
            />
          </AppSurfaceBox>
        ) : null}

        {step === 1 && selectedDataSource ? (
          <AppSurfaceBox className="p-3">
            <BindingVizFieldMappingStep
              widgetKind={widgetKind}
              availableFields={selectedDataSource.fields}
              mapping={fieldMapping}
              onChange={setFieldMapping}
              document={document}
              bindingDefinitions={bindingDefinitions}
            />
          </AppSurfaceBox>
        ) : null}

        {step === 2 ? (
          <AppSurfaceBox className="p-3">
            <BindingChartFilterConfigStep
              nodeId={vizNode.id}
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
                <li>Widget: {widgetLabel}</li>
                <li>Resource: {selectedDataSource?.name ?? dataSourceId}</li>
                <li>Mapping kind: {fieldMapping.kind}</li>
                <li>Runtime filters: {toolbarConfig.runtimeEnabled ? 'enabled' : 'design-time only'}</li>
              </ul>
            </div>
          </AppSurfaceBox>
        ) : null}
      </StepWizardShell>
    </DesignerDialogHostContext.Provider>
  );
};
