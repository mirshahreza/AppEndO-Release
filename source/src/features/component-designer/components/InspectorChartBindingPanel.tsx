import * as React from 'react';
import { BarChart3, ChevronDown, Link2, Pencil } from 'lucide-react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  buildChartBindingWithToolbarQueryParams,
  CHART_DATA_RESOURCE_BINDING_KEY,
  CHART_TOOLBAR_CONFIG_PROP,
  chartMappingCategoryField,
  chartMappingToSeriesView,
  countNodeChartDataSources,
  getNodeChartDataResourceRef,
  isChartNode,
  isNodeChartDataBound,
  parseDesignerChartFieldMapping,
  resolveChartMappingTypeFromNode,
  resolveNodeChartDataSourceEntries,
  serializeDesignerChartFieldMapping,
} from '../../../domain/component-designer/bindingChartEngine';
import {
  parseDesignerChartToolbarConfig,
  serializeDesignerChartToolbarConfig,
} from '../../../domain/component-designer/designerChartToolbarConfig';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiSelect } from '../../../shared/ui';
import { BindingChartWizardDialog } from './BindingChartWizardDialog';
import { BindingHealthSummary } from './BindingHealthSummary';
import { DesignerFieldRow } from './DesignerFieldRow';
import { collectNodeBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import {
  listDocumentFilterBindingCandidates,
} from '../../../domain/component-designer/bindingFilterBindingsEngine';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

type InspectorChartBindingPanelProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

export const InspectorChartBindingPanel: React.FC<InspectorChartBindingPanelProps> = ({
  node,
  document,
  bindingDefinitions,
  dispatch,
}) => {
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  if (!isChartNode(node)) {
    return null;
  }

  const selectedRef = getNodeChartDataResourceRef(node) ?? '';
  const chartBinding = node.binding[CHART_DATA_RESOURCE_BINDING_KEY];
  const selectedDataSource = selectedRef ? bindingDefinitions.dataSources[selectedRef] : undefined;
  const isConnected = isNodeChartDataBound(node);
  const dataSourceCount = countNodeChartDataSources(node);
  const chartDataEntries = resolveNodeChartDataSourceEntries(node, {
    chartTypeHint: resolveChartMappingTypeFromNode(node),
  });
  const fieldMapping = parseDesignerChartFieldMapping(node.props.chartFieldMapping, {
    chartTypeHint: resolveChartMappingTypeFromNode(node),
  });
  const toolbarConfig = parseDesignerChartToolbarConfig(node.props.chartToolbarConfig);

  const health = React.useMemo(
    () => collectNodeBindingHealth(document, bindingDefinitions, node.id),
    [bindingDefinitions, document, node.id],
  );

  const filterBindingCandidates = React.useMemo(
    () => listDocumentFilterBindingCandidates(
      document,
      Object.keys(bindingDefinitions.storeSegments),
    ),
    [bindingDefinitions.storeSegments, document],
  );
  const selectedFilterBindings = chartBinding?.filterBindings ?? [];

  const commitFilterBindings = (nextBindings: string[]) => {
    if (!selectedRef) {
      return;
    }
    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey: CHART_DATA_RESOURCE_BINDING_KEY,
      definition: buildChartBindingWithToolbarQueryParams(
        selectedRef,
        node.id,
        toolbarConfig,
        {
          ...(chartBinding ?? {}),
          filterBindings: nextBindings.length > 0 ? nextBindings : undefined,
        },
      ),
    });
  };

  const commitToolbarRuntime = (runtimeEnabled: boolean) => {
    const nextConfig = { ...toolbarConfig, enabled: true, runtimeEnabled };
    dispatch({
      type: 'set-node-prop',
      nodeId: node.id,
      key: CHART_TOOLBAR_CONFIG_PROP,
      value: serializeDesignerChartToolbarConfig(nextConfig, node.id),
    });
    if (selectedRef) {
      dispatch({
        type: 'set-node-binding',
        nodeId: node.id,
        bindingKey: CHART_DATA_RESOURCE_BINDING_KEY,
        definition: buildChartBindingWithToolbarQueryParams(selectedRef, node.id, nextConfig, chartBinding),
      });
    }
  };

  return (
    <>
      <div className="space-y-2">
        {!isConnected ? (
          <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 px-3 py-3">
            <p className={`${INSPECTOR_TEXT_SM} font-semibold text-cyan-900`}>Connect chart to an API</p>
            <p className={`mt-1 ps-[4px] ${INSPECTOR_TEXT_XS} leading-relaxed text-cyan-800/90`}>
              Use the wizard to connect any list endpoint, map fields to series, and configure runtime filters.
            </p>
            <AppButton
              type="button"
              intent="primary"
              size="sm"
              className="mt-2.5 h-8 w-full"
              onClick={() => setWizardOpen(true)}
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              Connect to API
            </AppButton>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`${INSPECTOR_TEXT_SM} font-semibold text-emerald-900`}>
                  Connected to {selectedDataSource?.name ?? selectedRef}
                  {dataSourceCount > 1 ? ` (+${dataSourceCount - 1} more)` : ''}
                </p>
                <p className={`mt-0.5 truncate font-mono ${INSPECTOR_TEXT_2XS} text-emerald-800/80`}>
                  {selectedDataSource?.endpoint}
                </p>
              </div>
              <AppButton
                type="button"
                intent="secondary"
                size="sm"
                className={`h-7 shrink-0 px-2 ${INSPECTOR_TEXT_XS}`}
                onClick={() => setWizardOpen(true)}
              >
                <Link2 className="mr-1 h-3 w-3" strokeWidth={2} />
                Reconnect
              </AppButton>
            </div>
          </div>
        )}

        {isConnected && fieldMapping ? (
          <div className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2 ${INSPECTOR_TEXT_2XS} text-slate-600`}>
            <p className="mb-1 font-medium text-slate-700">How data maps to this chart</p>
            {dataSourceCount > 1 ? (
              <ul className="space-y-2">
                {chartDataEntries.map((entry, index) => {
                  const source = bindingDefinitions.dataSources[entry.dataSourceRef];
                  const entrySummary = chartMappingToSeriesView(entry.fieldMapping);
                  return (
                    <li key={`chart-entry-${index}`} className="rounded border border-slate-100 bg-slate-50/70 p-1.5">
                      <p className="font-medium text-slate-700">{source?.name ?? entry.dataSourceRef}</p>
                      <p>
                        <span className="font-medium text-slate-700">Category:</span>{' '}
                        <span className="font-mono">{chartMappingCategoryField(entry.fieldMapping)}</span>
                      </p>
                      {entrySummary.map((seriesEntry) => (
                        <p key={seriesEntry.seriesKey} className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${NESTED_LAYER_DIVIDER_CLASS}`}
                            style={{ backgroundColor: seriesEntry.color ?? undefined }}
                          />
                          <span className="font-medium text-slate-700">{seriesEntry.label ?? seriesEntry.apiField}:</span>
                          <span className="font-mono">{seriesEntry.apiField}</span>
                        </p>
                      ))}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="space-y-1">
                <li>
                  <span className="font-medium text-slate-700">Category:</span>{' '}
                  <span className="font-mono">{chartMappingCategoryField(fieldMapping)}</span>
                  <span className="text-slate-500"> → X axis labels</span>
                </li>
                {chartMappingToSeriesView(fieldMapping).map((entry) => (
                  <li key={entry.seriesKey} className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${NESTED_LAYER_DIVIDER_CLASS}`}
                      style={{ backgroundColor: entry.color ?? undefined }}
                    />
                    <span className="font-medium text-slate-700">{entry.label ?? entry.apiField}:</span>
                    <span className="font-mono">{entry.apiField}</span>
                    {entry.aggregation && entry.aggregation !== 'none' ? (
                      <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] uppercase text-slate-600">{entry.aggregation}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <AppButton
              type="button"
              intent="secondary"
              size="sm"
              className={`mt-2 h-7 w-full ${INSPECTOR_TEXT_XS}`}
              onClick={() => setWizardOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit mapping, colors & aggregation
            </AppButton>
          </div>
        ) : null}

        {isConnected ? (
          <DesignerFieldRow label="Runtime filters">
            <UiSelect
              size="sm"
              value={toolbarConfig.runtimeEnabled === true ? 'yes' : 'no'}
              onChange={(event) => commitToolbarRuntime(event.target.value === 'yes')}
              ariaLabel="End users can change filters at runtime"
            >
              <option value="yes">yes</option>
              <option value="no">no</option>
            </UiSelect>
          </DesignerFieldRow>
        ) : null}

        {isConnected && filterBindingCandidates.length > 0 ? (
          <DesignerFieldRow label="Dashboard filter bindings">
            <div className="space-y-1.5">
              {filterBindingCandidates.map((storePath) => (
                <DesignerFieldRow key={storePath} label={storePath}>
                  <UiSelect
                    size="sm"
                    value={selectedFilterBindings.includes(storePath) ? 'yes' : 'no'}
                    onChange={(event) => {
                      const checked = event.target.value === 'yes';
                      const next = checked
                        ? [...selectedFilterBindings, storePath]
                        : selectedFilterBindings.filter((entry) => entry !== storePath);
                      commitFilterBindings(next);
                    }}
                    ariaLabel={`Bind dashboard filter ${storePath}`}
                  >
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </UiSelect>
                </DesignerFieldRow>
              ))}
            </div>
          </DesignerFieldRow>
        ) : null}

        <BindingHealthSummary summary={health} compact />

        {isConnected ? (
          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50 px-2 py-1.5 ${INSPECTOR_TEXT_2XS} font-medium text-slate-600`}
            onClick={() => setShowAdvanced((current) => !current)}
          >
            Advanced binding JSON
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} strokeWidth={2} />
          </button>
        ) : null}

        {showAdvanced && fieldMapping ? (
          <pre className={`max-h-28 overflow-auto rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-950 p-2 ${INSPECTOR_TEXT_2XS} text-emerald-200`}>
            {serializeDesignerChartFieldMapping(fieldMapping)}
          </pre>
        ) : null}
      </div>

      <BindingChartWizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        document={document}
        chartNode={node}
        bindingDefinitions={bindingDefinitions}
        dispatch={dispatch}
      />
    </>
  );
};
