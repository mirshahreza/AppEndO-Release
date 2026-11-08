import * as React from 'react';
import { ChevronDown, Repeat } from 'lucide-react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  createRepeaterListResourceBindingDefinition,
  getNodeRepeaterListResourceRef,
  isLogicRepeaterPaletteNode,
  REPEATER_LIST_RESOURCE_BINDING_KEY,
} from '../../../domain/component-designer/bindingRepeaterEngine';
import { buildRepeaterListRequestPreview } from '../../../domain/component-designer/bindingPayloadPreview';
import { collectNodeBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import { AppButton } from '../../../shared/ui/AppButton';
import { UiSelect } from '../../../shared/ui';
import { BindingRepeaterWizardDialog } from './BindingRepeaterWizardDialog';
import { BindingHealthSummary } from './BindingHealthSummary';
import { BindingRequestPreview } from './BindingRequestPreview';
import { DesignerFieldRow } from './DesignerFieldRow';
import {
  INSPECTOR_TEXT_2XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

type InspectorRepeaterBindingPanelProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

export const InspectorRepeaterBindingPanel: React.FC<InspectorRepeaterBindingPanelProps> = ({
  node,
  document,
  bindingDefinitions,
  dispatch,
}) => {
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  if (!isLogicRepeaterPaletteNode(node)) {
    return null;
  }

  const dataSources = Object.values(bindingDefinitions.dataSources);
  const selectedRef = getNodeRepeaterListResourceRef(node) ?? '';
  const isConnected = selectedRef.length > 0;
  const selectedDataSource = selectedRef ? bindingDefinitions.dataSources[selectedRef] : undefined;

  const commitResource = (dataSourceId: string) => {
    const trimmed = dataSourceId.trim();
    if (!trimmed) {
      dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey: REPEATER_LIST_RESOURCE_BINDING_KEY });
      return;
    }

    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey: REPEATER_LIST_RESOURCE_BINDING_KEY,
      definition: createRepeaterListResourceBindingDefinition(trimmed),
    });
  };

  const requestPreview = selectedRef ? buildRepeaterListRequestPreview(selectedRef, bindingDefinitions) : null;
  const health = React.useMemo(
    () => collectNodeBindingHealth(document, bindingDefinitions, node.id),
    [bindingDefinitions, document, node.id],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={`ps-[4px] ${INSPECTOR_TEXT_2XS} font-semibold uppercase tracking-[0.08em] text-indigo-700`}>
          List data source
        </p>
        <AppButton
          size="xs"
          intent="primary"
          icon={<Repeat className="h-3 w-3" strokeWidth={2} />}
          onPress={() => setWizardOpen(true)}
        >
          Connect wizard
        </AppButton>
      </div>

      <DesignerFieldRow label="Resource">
        <UiSelect
          size="sm"
          value={selectedRef}
          onChange={(event) => commitResource(event.target.value)}
          aria-label="Repeater list resource"
        >
          <option value="">Not connected</option>
          {dataSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name || source.id}
            </option>
          ))}
        </UiSelect>
      </DesignerFieldRow>

      {isConnected && requestPreview ? (
        <BindingRequestPreview
          summary={{
            method: requestPreview.method,
            endpoint: requestPreview.endpoint,
            bodyEntries: [],
            onSuccess: 'One repeated block per list row',
          }}
        />
      ) : null}

      {isConnected ? <BindingHealthSummary summary={health} /> : null}

      {isConnected && selectedDataSource?.fields && selectedDataSource.fields.length > 0 ? (
        <details className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/60`}>
          <summary className={`flex cursor-pointer list-none items-center gap-1 px-2 py-1.5 ${INSPECTOR_TEXT_2XS} font-semibold uppercase tracking-[0.08em] text-slate-600`}>
            <ChevronDown className="h-3 w-3" />
            Row fields
          </summary>
          <ul className={`space-y-0.5 border-t border-slate-200 px-2 py-1.5 font-mono ${INSPECTOR_TEXT_2XS} text-slate-600`}>
            {selectedDataSource.fields.map((field) => (
              <li key={field}>item.{field}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <button
        type="button"
        className={`ps-[4px] ${INSPECTOR_TEXT_2XS} font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline`}
        onClick={() => setShowAdvanced((current) => !current)}
      >
        {showAdvanced ? 'Hide advanced' : 'Advanced'}
      </button>

      {showAdvanced ? (
        <p className={`rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white px-2 py-1.5 ${INSPECTOR_TEXT_2XS} text-slate-600`}>
          Data path and aliases are in the Content section above. After connecting a resource,
          the wizard sets
          {' '}
          <span className="font-mono">dataPath</span>
          {' '}
          automatically.
        </p>
      ) : null}

      <BindingRepeaterWizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        document={document}
        repeaterNode={node}
        bindingDefinitions={bindingDefinitions}
        dispatch={dispatch}
      />
    </div>
  );
};
