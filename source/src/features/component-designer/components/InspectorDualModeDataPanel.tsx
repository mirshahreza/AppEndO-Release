import * as React from 'react';
import { Unplug } from 'lucide-react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  buildContentBindingConnectActions,
  buildContentDualModeDisableActions,
  buildContentDualModeEnableActions,
  CONTENT_DATA_RESOURCE_BINDING_KEY,
  getContentDataMode,
  getNodeContentDataResourceRef,
  isDualModeContentNode,
} from '../../../domain/component-designer/bindingContentEngine';
import { getDataSources } from '../../../domain/component-designer/bindingRegistry';
import { collectNodeBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiSelect } from '../../../shared/ui';
import { BindingHealthSummary } from './BindingHealthSummary';
import { DesignerFieldRow } from './DesignerFieldRow';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
} from './inspectorDesignTokens';

type InspectorDualModeDataPanelProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

/**
 * Dual-Mode Content Blocks (T1-9): Static content / Bind to data source toggle.
 * Reuses the same Data Source registry + list fetch pattern as Viz (`contentDataResource`).
 * Switching modes never clears static JSON / scalar props on the node.
 */
export const InspectorDualModeDataPanel: React.FC<InspectorDualModeDataPanelProps> = ({
  node,
  document,
  bindingDefinitions,
  dispatch,
}) => {
  if (!isDualModeContentNode(node)) {
    return null;
  }

  const mode = getContentDataMode(node);
  const isBoundMode = mode === 'bound';
  const selectedRef = getNodeContentDataResourceRef(node) ?? '';
  const selectedDataSource = selectedRef ? bindingDefinitions.dataSources[selectedRef] : undefined;
  const isConnected = selectedRef.length > 0;
  const dataSourceOptions = React.useMemo(
    () => Object.values(getDataSources(bindingDefinitions)),
    [bindingDefinitions],
  );

  const health = React.useMemo(
    () => collectNodeBindingHealth(document, bindingDefinitions, node.id),
    [bindingDefinitions, document, node.id],
  );

  const commitMode = (nextBound: boolean) => {
    const actions = nextBound
      ? buildContentDualModeEnableActions(node.id)
      : buildContentDualModeDisableActions(node.id);
    for (const action of actions) {
      dispatch(action);
    }
  };

  const connectDataSource = (dataSourceId: string) => {
    const dataSource = bindingDefinitions.dataSources[dataSourceId];
    if (!dataSource) {
      return;
    }
    for (const action of buildContentBindingConnectActions(node, dataSource)) {
      dispatch(action);
    }
  };

  const disconnect = () => {
    dispatch({
      type: 'remove-node-binding',
      nodeId: node.id,
      bindingKey: CONTENT_DATA_RESOURCE_BINDING_KEY,
    });
  };

  return (
    <div className="space-y-2">
      <DesignerFieldRow label="Bind data">
        <UiSelect
          size="sm"
          value={isBoundMode ? 'yes' : 'no'}
          onChange={(event) => commitMode(event.target.value === 'yes')}
          ariaLabel="Bind to data source"
        >
          <option value="yes">yes</option>
          <option value="no">no</option>
        </UiSelect>
      </DesignerFieldRow>
      <p className={`ps-[4px] ${INSPECTOR_TEXT_XS} leading-relaxed text-slate-500`}>
        {isBoundMode
          ? 'Static JSON stays saved — switch back anytime to edit it manually.'
          : 'Static content uses the fields below. Toggle on to bind a list API.'}
      </p>

      {isBoundMode ? (
        !isConnected ? (
          <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 px-3 py-3">
            <p className={`${INSPECTOR_TEXT_SM} font-semibold text-cyan-900`}>Connect content to an API</p>
            <p className={`mt-1 ps-[4px] ${INSPECTOR_TEXT_XS} leading-relaxed text-cyan-800/90`}>
              Uses the same list Data Source pattern as Viz widgets (`useDataFetch`).
            </p>
            {dataSourceOptions.length === 0 ? (
              <p className={`mt-2 ${INSPECTOR_TEXT_XS} text-amber-800`}>
                No Data Sources yet — add one in the Data panel first.
              </p>
            ) : (
              <DesignerFieldRow label="Data Source" className="mt-[2px]">
                <UiSelect
                  size="sm"
                  ariaLabel="Content data source"
                  value=""
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next) {
                      connectDataSource(next);
                    }
                  }}
                >
                  <option value="">Select a data source…</option>
                  {dataSourceOptions.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name || source.id}
                    </option>
                  ))}
                </UiSelect>
              </DesignerFieldRow>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`${INSPECTOR_TEXT_SM} font-semibold text-emerald-900`}>
                  Connected to {selectedDataSource?.name ?? selectedRef}
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
                onClick={disconnect}
              >
                <Unplug className="mr-1 h-3 w-3" strokeWidth={2} />
                Disconnect
              </AppButton>
            </div>
            {dataSourceOptions.length > 1 ? (
              <DesignerFieldRow label="Change source" className="mt-2">
                <UiSelect
                  size="sm"
                  ariaLabel="Change content data source"
                  value={selectedRef}
                  onChange={(event) => connectDataSource(event.target.value)}
                >
                  {dataSourceOptions.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name || source.id}
                    </option>
                  ))}
                </UiSelect>
              </DesignerFieldRow>
            ) : null}
          </div>
        )
      ) : null}

      {isBoundMode ? <BindingHealthSummary summary={health} compact /> : null}
    </div>
  );
};
