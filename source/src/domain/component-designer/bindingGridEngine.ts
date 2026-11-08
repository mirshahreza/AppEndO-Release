import { createFetchConfigKey } from './bindingApiHelpers';
import { resolveBindingQueryParamsWithFilterBindings } from './bindingFilterBindingsEngine';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import { getDataSources } from './bindingRegistry';
import {
  buildGridColumnsFromApiFields,
  isActionGridColumn,
  APP_TABLE_GRID_PALETTE_ITEM_ID,
  DATA_TABLE_PALETTE_ITEM_ID,
  parseDesignerDataGridColumns,
  serializeDesignerDataGridColumns,
  shouldAutoGenerateGridColumns,
  type DesignerDataGridColumn,
} from './designerDataGridColumns';
import {
  buildGridListQueryParamBindings,
  type DesignerGridToolbarConfig,
} from './designerGridToolbarConfig';
import {
  buildGridAggregationQueryParams,
  isGridAggregationEnabled,
  parseGridAggregationConfig,
} from './designerGridAggregation';
import {
  dataSourceToResource,
  resolveDataSourceOperationEndpoint,
  resolveRegionLoadConfig,
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

export const GRID_LIST_RESOURCE_BINDING_KEY = 'gridListResource';

export type ResolvedGridListFetch = {
  nodeId: string;
  dataSourceId: string;
  dataSource: DataSourceDefinition;
  dataVar: string;
  fetchConfig: ResolvedFetchConfig;
  responseMapping?: DesignerResponseMapping;
  /** Store paths written by grid sort/page events. */
  sortStorePath?: string;
  pageStorePath?: string;
  queryParams?: Record<string, string>;
  /** Design-time static query params (e.g. aggregation config for server mode). */
  staticQueryParams?: Record<string, string>;
};

export type DocumentGridPlan = {
  gridListFetches: ResolvedGridListFetch[];
};

const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : undefined;
};

export const isDataGridNode = (node: DesignerNode): boolean => {
  const paletteItemId = resolveNodePaletteItemId(node);
  return paletteItemId === 'heroui.data-grid'
    || paletteItemId === DATA_TABLE_PALETTE_ITEM_ID
    || paletteItemId === APP_TABLE_GRID_PALETTE_ITEM_ID
    || paletteItemId === 'heroui.crud-set';
};

export const isAppTableGridNode = (node: DesignerNode): boolean =>
  resolveNodePaletteItemId(node) === APP_TABLE_GRID_PALETTE_ITEM_ID;

export const getNodeGridListResourceRef = (node: DesignerNode): string | undefined => {
  const definition = node.binding[GRID_LIST_RESOURCE_BINDING_KEY];
  const ref = definition?.dataSourceRef ?? definition?.sourcePath;
  const trimmed = typeof ref === 'string' ? ref.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getNodeGridListResourceBinding = (node: DesignerNode): DesignerBindingDefinition | undefined =>
  node.binding[GRID_LIST_RESOURCE_BINDING_KEY];

export const createGridListResourceBindingDefinition = (
  dataSourceRef: string,
  options: {
    sortStorePath?: string;
    pageStorePath?: string;
    urlParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    filterBindings?: string[];
  } = {},
): DesignerBindingDefinition => ({
  sourceType: 'static',
  dataSourceRef: dataSourceRef.trim(),
  sourcePath: dataSourceRef.trim(),
  loadOperation: 'list',
  urlParams: options.urlParams,
  queryParams: options.queryParams,
  filterBindings: options.filterBindings,
  storeWritePath: options.sortStorePath,
  dataPath: options.pageStorePath,
});

export const resolveGridListDataVarName = (nodeId: string): string => {
  const suffix = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `gridData_${suffix}`;
};

export const collectDocumentGridPlan = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): DocumentGridPlan => {
  const dataSources = getDataSources(bindingDefinitions);
  const gridListFetches: ResolvedGridListFetch[] = [];

  for (const node of Object.values(document.nodes)) {
    if (!isDataGridNode(node)) {
      continue;
    }

    const dataSourceRef = getNodeGridListResourceRef(node);
    if (!dataSourceRef) {
      continue;
    }

    const dataSource = dataSources[dataSourceRef];
    if (!dataSource?.endpoint?.trim()) {
      continue;
    }

    const gridBinding = getNodeGridListResourceBinding(node);
    const listEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'list');
    const resource = dataSourceToResource(dataSource);
    const urlParams = { ...(gridBinding?.urlParams ?? {}) };
    const aggregationConfig = parseGridAggregationConfig(node.props.gridAggregationConfig);
    const staticQueryParams = isGridAggregationEnabled(aggregationConfig)
      ? buildGridAggregationQueryParams(aggregationConfig)
      : undefined;

    gridListFetches.push({
      nodeId: node.id,
      dataSourceId: dataSourceRef,
      dataSource,
      dataVar: resolveGridListDataVarName(node.id),
      fetchConfig: {
        configKey: createFetchConfigKey(listEndpoint, urlParams, {}),
        endpointTemplate: listEndpoint,
        urlParams,
        headers: {},
      },
      responseMapping: resource.response,
      sortStorePath: gridBinding?.storeWritePath?.trim() || 'gridQuery.sort',
      pageStorePath: gridBinding?.dataPath?.trim() || 'gridQuery.page',
      queryParams: resolveBindingQueryParamsWithFilterBindings(
        gridBinding,
        gridBinding?.queryParams,
      ),
      ...(staticQueryParams && Object.keys(staticQueryParams).length > 0
        ? { staticQueryParams }
        : {}),
    });
  }

  return { gridListFetches };
};

export const suggestGridColumnFieldMapping = (
  columnKey: string,
  availableFields: string[],
): string => {
  const exact = availableFields.find((field) => field === columnKey);
  if (exact) {
    return exact;
  }

  const caseInsensitive = availableFields.find((field) => field.toLowerCase() === columnKey.toLowerCase());
  return caseInsensitive ?? '';
};

export type GridBindingWizardDispatchAction =
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

export const buildGridBindingWizardActions = (
  gridNode: DesignerNode,
  dataSource: DataSourceDefinition,
  options: {
    columns?: DesignerDataGridColumn[];
  } = {},
): GridBindingWizardDispatchAction[] => {
  const actions: GridBindingWizardDispatchAction[] = [
    {
      type: 'set-node-binding',
      nodeId: gridNode.id,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition(dataSource.id),
    },
  ];

  if (options.columns && options.columns.length > 0) {
    actions.push({
      type: 'set-node-prop',
      nodeId: gridNode.id,
      key: 'columns',
      value: serializeDesignerDataGridColumns(options.columns),
    });
    return actions;
  }

  const hasExistingListBinding = Boolean(getNodeGridListResourceRef(gridNode));
  if (shouldAutoGenerateGridColumns(gridNode.props.columns, dataSource.fields, hasExistingListBinding)) {
    const existingColumns = parseDesignerDataGridColumns(gridNode.props.columns);
    const actionColumns = existingColumns.filter((column) => isActionGridColumn(column));
    const nextColumns = buildGridColumnsFromApiFields(dataSource.fields, { preserveActionColumns: actionColumns });

    if (nextColumns.length > 0) {
      actions.push({
        type: 'set-node-prop',
        nodeId: gridNode.id,
        key: 'columns',
        value: serializeDesignerDataGridColumns(nextColumns),
      });
    }
  }

  return actions;
};

export const buildGridListBindingWithToolbarQueryParams = (
  dataSourceRef: string,
  toolbarConfig: DesignerGridToolbarConfig | undefined,
  existing?: DesignerBindingDefinition,
): DesignerBindingDefinition => createGridListResourceBindingDefinition(dataSourceRef, {
  sortStorePath: existing?.storeWritePath ?? 'gridQuery.sort',
  pageStorePath: existing?.dataPath ?? 'gridQuery.page',
  urlParams: existing?.urlParams,
  queryParams: resolveBindingQueryParamsWithFilterBindings(
    existing,
    buildGridListQueryParamBindings(toolbarConfig),
  ),
  filterBindings: existing?.filterBindings,
});
