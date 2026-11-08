import * as React from 'react';
import { ChevronDown, Link2, Wand2 } from 'lucide-react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  buildDefaultDetailUrlParams,
  dataSourceToResource,
} from '../../../domain/component-designer/bindingResourceModel';
import { buildRegionSubmitRequestPreview } from '../../../domain/component-designer/bindingPayloadPreview';
import {
  createRegionDataSourceBindingDefinition,
  getNodeRegionDataSourceBinding,
  getNodeRegionDataSourceRef,
  isDataRegionEligibleContainer,
  REGION_DATA_SOURCE_BINDING_KEY,
} from '../../../domain/component-designer/bindingRegionEngine';
import { collectRegionBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiInput, UiSelect } from '../../../shared/ui';
import { BindingFormWizardDialog } from './BindingFormWizardDialog';
import { BindingHealthSummary } from './BindingHealthSummary';
import { BindingRequestPreview } from './BindingRequestPreview';
import { DesignerFieldRow } from './DesignerFieldRow';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

type InspectorDataRegionPanelProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

export const InspectorDataRegionPanel: React.FC<InspectorDataRegionPanelProps> = ({
  node,
  document,
  bindingDefinitions,
  dispatch,
}) => {
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  if (!isDataRegionEligibleContainer(node)) {
    return null;
  }

  const dataSources = Object.values(bindingDefinitions.dataSources);
  const regionBinding = getNodeRegionDataSourceBinding(node);
  const selectedDataSourceRef = getNodeRegionDataSourceRef(node) ?? '';
  const isConnected = selectedDataSourceRef.length > 0;

  const commitRegionBinding = (
    dataSourceRef: string,
    patch: {
      loadOperation?: 'list' | 'detail';
      urlParams?: Record<string, string>;
    } = {},
  ) => {
    const trimmed = dataSourceRef.trim();
    if (trimmed.length === 0) {
      dispatch({
        type: 'remove-node-binding',
        nodeId: node.id,
        bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      });
      return;
    }

    const dataSource = bindingDefinitions.dataSources[trimmed];
    const loadOperation = patch.loadOperation ?? regionBinding?.loadOperation;
    let urlParams = patch.urlParams ?? regionBinding?.urlParams;
    if (loadOperation === 'detail' && dataSource && (!urlParams || Object.keys(urlParams).length === 0)) {
      urlParams = buildDefaultDetailUrlParams(dataSource);
    }

    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition(trimmed, {
        loadOperation,
        urlParams,
      }),
    });
  };

  const selectedDataSource = selectedDataSourceRef
    ? bindingDefinitions.dataSources[selectedDataSourceRef]
    : undefined;

  const health = React.useMemo(
    () => collectRegionBindingHealth(document, bindingDefinitions, node),
    [bindingDefinitions, document, node],
  );

  const resourcePreview = selectedDataSource ? dataSourceToResource(selectedDataSource) : undefined;

  const requestPreview = selectedDataSourceRef
    ? buildRegionSubmitRequestPreview(document, bindingDefinitions, node.id, 'createEdit')
    : null;

  return (
    <>
      <div className="space-y-2">
        {!isConnected ? (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-3">
            <p className={`${INSPECTOR_TEXT_SM} font-semibold text-indigo-900`}>Connect this form to your API</p>
            <p className={`mt-1 ps-[4px] ${INSPECTOR_TEXT_XS} leading-relaxed text-indigo-800/90`}>
              One wizard maps all inputs, sets up load/save, and wires the submit button automatically.
            </p>
            <AppButton
              type="button"
              intent="primary"
              size="sm"
              className="mt-2.5 h-8 w-full"
              onClick={() => setWizardOpen(true)}
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              Connect to API
            </AppButton>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`${INSPECTOR_TEXT_SM} font-semibold text-emerald-900`}>
                  Connected to {selectedDataSource?.name ?? selectedDataSourceRef}
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

        <BindingHealthSummary summary={health} compact={!isConnected} />

        {isConnected && requestPreview ? (
          <BindingRequestPreview summary={requestPreview} />
        ) : null}

        <button
          type="button"
          className={`flex w-full items-center gap-1.5 rounded-md px-1 py-1 ${INSPECTOR_TEXT_XS} font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700`}
          onClick={() => setShowAdvanced((current) => !current)}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          {showAdvanced ? 'Hide manual settings' : 'Manual settings (advanced)'}
        </button>

        {showAdvanced ? (
          <div className={`space-y-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/50 p-2.5`}>
            <DesignerFieldRow label="Resource">
              <UiSelect
                size="sm"
                nested
                className="w-full"
                value={selectedDataSourceRef}
                onChange={(event) => commitRegionBinding(event.target.value)}
              >
                <option value="">None (manual binding)</option>
                {dataSources.map((dataSource) => (
                  <option key={dataSource.id} value={dataSource.id}>
                    {dataSource.name} ({dataSource.id})
                  </option>
                ))}
              </UiSelect>
            </DesignerFieldRow>

            {selectedDataSource ? (
              <>
                <DesignerFieldRow label="Load operation">
                  <UiSelect
                    size="sm"
                    nested
                    className="w-full"
                    value={regionBinding?.loadOperation ?? 'detail'}
                    onChange={(event) => commitRegionBinding(selectedDataSourceRef, {
                      loadOperation: event.target.value as 'list' | 'detail',
                    })}
                  >
                    <option value="detail">Load single record (detail)</option>
                    <option value="list">Load collection (list)</option>
                  </UiSelect>
                </DesignerFieldRow>

                {(regionBinding?.loadOperation ?? 'detail') === 'detail' ? (
                  <DesignerFieldRow label="Record id store path">
                    <UiInput
                      size="sm"
                      nested
                      className="w-full"
                      placeholder={`selection.${selectedDataSource.primaryKey ?? 'id'}`}
                      value={
                        Object.values(regionBinding?.urlParams ?? {})[0]
                        ?? `selection.${selectedDataSource.primaryKey ?? 'id'}`
                      }
                      onChange={(event) => {
                        const pk = selectedDataSource.primaryKey ?? 'id';
                        const pathParams = Object.keys(regionBinding?.urlParams ?? {});
                        const paramName = pathParams[0] ?? pk;
                        commitRegionBinding(selectedDataSourceRef, {
                          urlParams: { [paramName]: event.target.value },
                        });
                      }}
                    />
                  </DesignerFieldRow>
                ) : null}

                <div className={`rounded-md border border-cyan-100 bg-cyan-50/70 px-2 py-1.5 ${INSPECTOR_TEXT_XS} text-cyan-800`}>
                  <p className="font-medium">Load endpoint</p>
                  <p className={`mt-0.5 font-mono ${INSPECTOR_TEXT_2XS}`}>
                    {(resourcePreview?.operations.detail?.endpoint ?? selectedDataSource.endpoint) || '(no endpoint configured)'}
                  </p>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <BindingFormWizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        document={document}
        regionNode={node}
        bindingDefinitions={bindingDefinitions}
        dispatch={dispatch}
      />
    </>
  );
};
