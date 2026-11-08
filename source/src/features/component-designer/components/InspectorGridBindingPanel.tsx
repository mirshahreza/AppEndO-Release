import * as React from 'react';
import { Eye, ChevronDown, Link2, Table2 } from 'lucide-react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  createGridListResourceBindingDefinition,
  getNodeGridListResourceRef,
  GRID_LIST_RESOURCE_BINDING_KEY,
  isDataGridNode,
  suggestGridColumnFieldMapping,
} from '../../../domain/component-designer/bindingGridEngine';
import { buildGridListRequestPreview } from '../../../domain/component-designer/bindingPayloadPreview';
import { parseDesignerDataGridColumns } from '../../../domain/component-designer/designerDataGridColumns';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiInput, UiSelect } from '../../../shared/ui';
import { BindingGridWizardDialog } from './BindingGridWizardDialog';
import { BindingGridDetailWizardDialog } from './BindingGridDetailWizardDialog';
import { BindingHealthSummary } from './BindingHealthSummary';
import { BindingRequestPreview } from './BindingRequestPreview';
import { DesignerFieldRow } from './DesignerFieldRow';
import { parseGridDetailFlowConfig } from '../../../domain/component-designer/bindingGridDetailEngine';
import { collectNodeBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

type InspectorGridBindingPanelProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

export const InspectorGridBindingPanel: React.FC<InspectorGridBindingPanelProps> = ({
  node,
  document,
  bindingDefinitions,
  dispatch,
}) => {
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [detailWizardOpen, setDetailWizardOpen] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  if (!isDataGridNode(node)) {
    return null;
  }

  const dataSources = Object.values(bindingDefinitions.dataSources);
  const selectedRef = getNodeGridListResourceRef(node) ?? '';
  const gridBinding = node.binding[GRID_LIST_RESOURCE_BINDING_KEY];
  const columns = parseDesignerDataGridColumns(node.props.columns);
  const selectedDataSource = selectedRef ? bindingDefinitions.dataSources[selectedRef] : undefined;
  const isConnected = selectedRef.length > 0;
  const detailFlow = parseGridDetailFlowConfig(node);

  const commitResource = (dataSourceId: string, patch: Partial<Parameters<typeof createGridListResourceBindingDefinition>[1]> = {}) => {
    const trimmed = dataSourceId.trim();
    if (!trimmed) {
      dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey: GRID_LIST_RESOURCE_BINDING_KEY });
      return;
    }

    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition(trimmed, {
        sortStorePath: gridBinding?.storeWritePath ?? patch.sortStorePath ?? 'gridQuery.sort',
        pageStorePath: gridBinding?.dataPath ?? patch.pageStorePath ?? 'gridQuery.page',
        urlParams: gridBinding?.urlParams ?? patch.urlParams,
        queryParams: gridBinding?.queryParams ?? patch.queryParams,
      }),
    });
  };

  const requestPreview = selectedRef ? buildGridListRequestPreview(selectedRef, bindingDefinitions) : null;
  const health = React.useMemo(
    () => collectNodeBindingHealth(document, bindingDefinitions, node.id),
    [bindingDefinitions, document, node.id],
  );

  const fieldMappings = selectedDataSource
    ? columns.map((column) => ({
      column: column.key,
      field: suggestGridColumnFieldMapping(column.key, selectedDataSource.fields),
    }))
    : [];

  return (
    <>
      <div className="space-y-2">
        {!isConnected ? (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-3">
            <p className={`${INSPECTOR_TEXT_SM} font-semibold text-indigo-900`}>Connect grid to a list API</p>
            <p className={`mt-1 ps-[4px] ${INSPECTOR_TEXT_XS} leading-relaxed text-indigo-800/90`}>
              Paste your list endpoint — rows, sort, and paging are wired automatically.
            </p>
            <AppButton
              type="button"
              intent="primary"
              size="sm"
              className="mt-2.5 h-8 w-full"
              onClick={() => setWizardOpen(true)}
            >
              <Table2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              Connect to API
            </AppButton>
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
                onClick={() => setWizardOpen(true)}
              >
                <Link2 className="mr-1 h-3 w-3" strokeWidth={2} />
                Reconnect
              </AppButton>
            </div>
          </div>
        )}

        {isConnected && fieldMappings.length > 0 ? (
          <div className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2 ${INSPECTOR_TEXT_2XS} text-slate-600`}>
            <p className="mb-1 font-medium text-slate-700">Column mapping</p>
            <ul className="space-y-0.5 font-mono">
              {fieldMappings.map((entry) => (
                <li key={entry.column}>
                  {entry.column} → {entry.field || entry.column}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {isConnected && requestPreview ? (
          <BindingRequestPreview
            summary={{
              method: requestPreview.method,
              endpoint: requestPreview.endpoint,
              bodyEntries: [],
              onSuccess: 'Rows bound from list response',
            }}
          />
        ) : null}

        <BindingHealthSummary summary={health} compact />

        {isConnected ? (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-3">
            <p className={`${INSPECTOR_TEXT_SM} font-semibold text-indigo-900`}>Row details (modal)</p>
            <p className={`mt-1 ps-[4px] ${INSPECTOR_TEXT_XS} leading-relaxed text-indigo-800/90`}>
              {detailFlow
                ? `Action "${detailFlow.rowActionLabel}" opens modal detail view.`
                : 'Add a Details button per row that loads a record into a modal.'}
            </p>
            <AppButton
              type="button"
              intent="secondary"
              size="sm"
              className="mt-2.5 h-8 w-full"
              onClick={() => setDetailWizardOpen(true)}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              {detailFlow ? 'Reconfigure row details' : 'Add row details flow'}
            </AppButton>
          </div>
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
            <DesignerFieldRow label="List resource">
              <UiSelect
                size="sm"
                nested
                className="w-full"
                value={selectedRef}
                onChange={(event) => commitResource(event.target.value)}
              >
                <option value="">None (manual rows binding)</option>
                {dataSources.map((dataSource) => (
                  <option key={dataSource.id} value={dataSource.id}>
                    {dataSource.name} ({dataSource.id})
                  </option>
                ))}
              </UiSelect>
            </DesignerFieldRow>

            {selectedDataSource ? (
              <>
                <DesignerFieldRow label="Sort store path">
                  <UiInput
                    size="sm"
                    nested
                    className="w-full"
                    placeholder="gridQuery.sort"
                    value={gridBinding?.storeWritePath ?? 'gridQuery.sort'}
                    onChange={(event) => commitResource(selectedRef, { sortStorePath: event.target.value })}
                  />
                </DesignerFieldRow>

                <DesignerFieldRow label="Page store path">
                  <UiInput
                    size="sm"
                    nested
                    className="w-full"
                    placeholder="gridQuery.page"
                    value={gridBinding?.dataPath ?? 'gridQuery.page'}
                    onChange={(event) => commitResource(selectedRef, { pageStorePath: event.target.value })}
                  />
                </DesignerFieldRow>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <BindingGridWizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        document={document}
        gridNode={node}
        bindingDefinitions={bindingDefinitions}
        dispatch={dispatch}
      />

      <BindingGridDetailWizardDialog
        open={detailWizardOpen}
        onClose={() => setDetailWizardOpen(false)}
        document={document}
        gridNode={node}
        bindingDefinitions={bindingDefinitions}
        dispatch={dispatch}
      />
    </>
  );
};
