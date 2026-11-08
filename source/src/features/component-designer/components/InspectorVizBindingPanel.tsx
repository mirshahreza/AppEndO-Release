import * as React from 'react';
import { ChevronDown, LayoutDashboard, Link2 } from 'lucide-react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  buildVizBindingWithToolbarQueryParams,
  getNodeVizDataResourceRef,
  isNonChartVizNode,
  VIZ_DATA_RESOURCE_BINDING_KEY,
  VIZ_TOOLBAR_CONFIG_PROP,
} from '../../../domain/component-designer/bindingVizEngine';
import {
  parseDesignerChartToolbarConfig,
  serializeDesignerChartToolbarConfig,
} from '../../../domain/component-designer/designerChartToolbarConfig';
import {
  parseDesignerVizFieldMapping,
  resolveVizWidgetKindFromPaletteId,
  serializeDesignerVizFieldMapping,
} from '../../../domain/component-designer/visualizationDataTransform';
import { getNodePaletteItemId } from '../../../domain/component-designer/runtimeShared';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiSelect } from '../../../shared/ui';
import { BindingHealthSummary } from './BindingHealthSummary';
import { BindingVizWizardDialog } from './BindingVizWizardDialog';
import { DesignerFieldRow } from './DesignerFieldRow';
import { collectNodeBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

type InspectorVizBindingPanelProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

export const InspectorVizBindingPanel: React.FC<InspectorVizBindingPanelProps> = ({
  node,
  document,
  bindingDefinitions,
  dispatch,
}) => {
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  if (!isNonChartVizNode(node)) {
    return null;
  }

  const widgetKind = resolveVizWidgetKindFromPaletteId(getNodePaletteItemId(node));
  const selectedRef = getNodeVizDataResourceRef(node) ?? '';
  const vizBinding = node.binding[VIZ_DATA_RESOURCE_BINDING_KEY];
  const selectedDataSource = selectedRef ? bindingDefinitions.dataSources[selectedRef] : undefined;
  const isConnected = selectedRef.length > 0;
  const fieldMapping = parseDesignerVizFieldMapping(node.props.vizFieldMapping);
  const toolbarConfig = parseDesignerChartToolbarConfig(node.props.vizToolbarConfig);

  const health = React.useMemo(
    () => collectNodeBindingHealth(document, bindingDefinitions, node.id),
    [bindingDefinitions, document, node.id],
  );

  const commitToolbarRuntime = (runtimeEnabled: boolean) => {
    const nextConfig = { ...toolbarConfig, enabled: true, runtimeEnabled };
    dispatch({
      type: 'set-node-prop',
      nodeId: node.id,
      key: VIZ_TOOLBAR_CONFIG_PROP,
      value: serializeDesignerChartToolbarConfig(nextConfig, node.id),
    });
    if (selectedRef) {
      dispatch({
        type: 'set-node-binding',
        nodeId: node.id,
        bindingKey: VIZ_DATA_RESOURCE_BINDING_KEY,
        definition: buildVizBindingWithToolbarQueryParams(selectedRef, node.id, nextConfig, vizBinding),
      });
    }
  };

  return (
    <>
      <div className="space-y-2">
        {!isConnected ? (
          <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 px-3 py-3">
            <p className={`${INSPECTOR_TEXT_SM} font-semibold text-cyan-900`}>Connect widget to an API</p>
            <p className={`mt-1 ps-[4px] ${INSPECTOR_TEXT_XS} leading-relaxed text-cyan-800/90`}>
              Bind {widgetKind ?? 'viz'} data from any list endpoint with field mapping and runtime filters.
            </p>
            <AppButton type="button" intent="primary" size="sm" className="mt-2.5 h-8 w-full" onClick={() => setWizardOpen(true)}>
              <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              Connect to API
            </AppButton>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`${INSPECTOR_TEXT_SM} font-semibold text-emerald-900`}>Connected to {selectedDataSource?.name ?? selectedRef}</p>
                <p className={`mt-0.5 truncate font-mono ${INSPECTOR_TEXT_2XS} text-emerald-800/80`}>{selectedDataSource?.endpoint}</p>
              </div>
              <AppButton type="button" intent="secondary" size="sm" className={`h-7 shrink-0 px-2 ${INSPECTOR_TEXT_XS}`} onClick={() => setWizardOpen(true)}>
                <Link2 className="mr-1 h-3 w-3" strokeWidth={2} />
                Reconnect
              </AppButton>
            </div>
          </div>
        )}

        {isConnected && fieldMapping ? (
          <div className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2 ${INSPECTOR_TEXT_2XS} text-slate-600`}>
            <p className="mb-1 font-medium text-slate-700">Field mapping ({fieldMapping.kind})</p>
            <pre className={`overflow-auto font-mono ${INSPECTOR_TEXT_2XS}`}>{serializeDesignerVizFieldMapping(fieldMapping)}</pre>
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

        <BindingHealthSummary summary={health} compact />

        {isConnected ? (
          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50 px-2 py-1.5 ${INSPECTOR_TEXT_2XS} font-medium text-slate-600`}
            onClick={() => setShowAdvanced((current) => !current)}
          >
            Advanced mapping JSON
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} strokeWidth={2} />
          </button>
        ) : null}
      </div>

      <BindingVizWizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        document={document}
        vizNode={node}
        bindingDefinitions={bindingDefinitions}
        dispatch={dispatch}
      />
    </>
  );
};
