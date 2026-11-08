import { createFetchConfigKey } from './bindingApiHelpers';
import { getDataSources } from './bindingRegistry';
import {
  dataSourceToResource,
  resolveDataSourceOperationEndpoint,
} from './bindingResourceModel';
import type { ResolvedFetchConfig } from './bindingEngine';
import type {
  DataSourceDefinition,
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  DesignerResponseMapping,
} from './types';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import {
  isItemScopedDataPath,
  isLogicRepeaterNode,
  LOGIC_REPEATER_PALETTE_ITEM_ID,
  resolveItemScopedPathExpression,
  resolveRepeaterArrayExpression,
  resolveRepeaterNodeConfig,
  type RepeaterNodeConfig,
  type RepeaterRenderScope,
} from './repeaterEngine';
import { dataPathToOptionalChainExpression } from './bindingEngine';

export const REPEATER_LIST_RESOURCE_BINDING_KEY = 'repeaterListResource';

export type ResolvedRepeaterListFetch = {
  nodeId: string;
  dataSourceId: string;
  dataSource: DataSourceDefinition;
  dataVar: string;
  fetchConfig: ResolvedFetchConfig;
  responseMapping?: DesignerResponseMapping;
  queryParams?: Record<string, string>;
};

export type DocumentRepeaterPlan = {
  repeaterListFetches: ResolvedRepeaterListFetch[];
};

const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : undefined;
};

export const isLogicRepeaterPaletteNode = (node: DesignerNode): boolean =>
  resolveNodePaletteItemId(node) === LOGIC_REPEATER_PALETTE_ITEM_ID || isLogicRepeaterNode(node);

export const getNodeRepeaterListResourceRef = (node: DesignerNode): string | undefined => {
  const definition = node.binding[REPEATER_LIST_RESOURCE_BINDING_KEY];
  const ref = definition?.dataSourceRef ?? definition?.sourcePath;
  const trimmed = typeof ref === 'string' ? ref.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getNodeRepeaterListResourceBinding = (node: DesignerNode): DesignerBindingDefinition | undefined =>
  node.binding[REPEATER_LIST_RESOURCE_BINDING_KEY];

export const createRepeaterListResourceBindingDefinition = (
  dataSourceRef: string,
  options: {
    urlParams?: Record<string, string>;
    queryParams?: Record<string, string>;
  } = {},
): DesignerBindingDefinition => ({
  sourceType: 'static',
  dataSourceRef: dataSourceRef.trim(),
  sourcePath: dataSourceRef.trim(),
  loadOperation: 'list',
  urlParams: options.urlParams,
  queryParams: options.queryParams,
});

export const resolveRepeaterListDataVarName = (nodeId: string): string => {
  const suffix = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `repeaterData_${suffix}`;
};

export const collectDocumentRepeaterPlan = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): DocumentRepeaterPlan => {
  const dataSources = getDataSources(bindingDefinitions);
  const repeaterListFetches: ResolvedRepeaterListFetch[] = [];

  for (const node of Object.values(document.nodes)) {
    if (!isLogicRepeaterPaletteNode(node)) {
      continue;
    }

    const dataSourceRef = getNodeRepeaterListResourceRef(node);
    if (!dataSourceRef) {
      continue;
    }

    const dataSource = dataSources[dataSourceRef];
    if (!dataSource?.endpoint?.trim()) {
      continue;
    }

    const repeaterBinding = getNodeRepeaterListResourceBinding(node);
    const listEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'list');
    const resource = dataSourceToResource(dataSource);
    const urlParams = { ...(repeaterBinding?.urlParams ?? {}) };
    const queryParams = { ...(repeaterBinding?.queryParams ?? {}) };

    repeaterListFetches.push({
      nodeId: node.id,
      dataSourceId: dataSourceRef,
      dataSource,
      dataVar: resolveRepeaterListDataVarName(node.id),
      fetchConfig: {
        configKey: createFetchConfigKey(listEndpoint, urlParams, queryParams),
        endpointTemplate: listEndpoint,
        urlParams,
        headers: {},
      },
      responseMapping: resource.response,
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });
  }

  return { repeaterListFetches };
};

export type RepeaterBindingWizardDispatchAction =
  | {
    type: 'set-node-binding';
    nodeId: string;
    bindingKey: string;
    definition: DesignerBindingDefinition;
  }
  | {
    type: 'set-node-prop';
    nodeId: string;
    key: string;
    value: unknown;
  };

export const buildRepeaterBindingWizardActions = (
  repeaterNode: DesignerNode,
  dataSource: DataSourceDefinition,
): RepeaterBindingWizardDispatchAction[] => [
  {
    type: 'set-node-binding',
    nodeId: repeaterNode.id,
    bindingKey: REPEATER_LIST_RESOURCE_BINDING_KEY,
    definition: createRepeaterListResourceBindingDefinition(dataSource.id),
  },
  {
    type: 'set-node-prop',
    nodeId: repeaterNode.id,
    key: 'dataPath',
    value: resolveRepeaterListDataVarName(repeaterNode.id),
  },
];

export const resolveRepeaterArrayExpressionForCodegen = (
  node: DesignerNode,
  config: RepeaterNodeConfig,
  repeaterFetches: readonly ResolvedRepeaterListFetch[],
  parentScope?: RepeaterRenderScope,
): string => {
  const fetch = repeaterFetches.find((item) => item.nodeId === node.id);
  if (fetch) {
    const arrayPath = fetch.responseMapping?.arrayPath?.trim();
    if (arrayPath) {
      return `(${dataPathToOptionalChainExpression(arrayPath, fetch.dataVar)}) ?? []`;
    }
    return `(${fetch.dataVar} ?? [])`;
  }

  // Bug found: a nested Repeater (one Repeater inside another) with `dataPath="item.<field>"`
  // (e.g. "for each order, repeat its line items") always resolved against the page's
  // `dataContext` — a field that doesn't exist there — instead of the PARENT repeater's own
  // current item, producing a dead `dataContext?.item?.<field> ?? []` expression that always
  // renders empty in exported/published code, while the live canvas/preview correctly resolves
  // it against the parent item. Mirror the same `item.`-scoping the per-node property-binding
  // codegen path already applies (see isItemScopedDataPath/resolveItemScopedPathExpression
  // usage in bindingCodegen.ts) for the repeater's own `dataPath` prop.
  if (parentScope && isItemScopedDataPath(config.dataPath)) {
    return `(${resolveItemScopedPathExpression(config.dataPath, parentScope)}) ?? []`;
  }

  return resolveRepeaterArrayExpression(config.dataPath);
};
