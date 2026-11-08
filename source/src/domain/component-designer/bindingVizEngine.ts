import { createFetchConfigKey } from './bindingApiHelpers';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import { getDataSources } from './bindingRegistry';
import {
  buildChartListQueryParamBindings,
  parseDesignerChartToolbarConfig,
  serializeDesignerChartToolbarConfig,
  type DesignerChartToolbarConfig,
} from './designerChartToolbarConfig';
import { isVizChartPaletteItemId } from './designerVizPalette';
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
import {
  buildDefaultVizFieldMapping,
  parseDesignerVizFieldMapping,
  resolveVizWidgetKindFromPaletteId,
  serializeDesignerVizFieldMapping,
  transformApiRowsToVizData,
  type DesignerVizFieldMapping,
  type VizWidgetKind,
} from './visualizationDataTransform';

export const VIZ_DATA_RESOURCE_BINDING_KEY = 'vizDataResource';
export const VIZ_FIELD_MAPPING_PROP = 'vizFieldMapping';
export const VIZ_TOOLBAR_CONFIG_PROP = 'vizToolbarConfig';

export type ResolvedVizListFetch = {
  nodeId: string;
  widgetKind: VizWidgetKind;
  dataSourceId: string;
  dataSource: DataSourceDefinition;
  dataVar: string;
  fetchConfig: ResolvedFetchConfig;
  responseMapping?: DesignerResponseMapping;
  queryParams?: Record<string, string>;
  fieldMapping: DesignerVizFieldMapping;
  toolbarConfig: DesignerChartToolbarConfig;
};

export type DocumentVizPlan = {
  vizListFetches: ResolvedVizListFetch[];
};

export type VizBindingWizardDispatchAction =
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

const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : undefined;
};

export const isNonChartVizNode = (node: DesignerNode): boolean => {
  const paletteItemId = resolveNodePaletteItemId(node);
  return resolveVizWidgetKindFromPaletteId(paletteItemId) !== null && !isVizChartPaletteItemId(paletteItemId);
};

export const isVizDataBoundNode = (node: DesignerNode): boolean =>
  isNonChartVizNode(node) || isVizChartPaletteItemId(resolveNodePaletteItemId(node));

export const getNodeVizDataResourceRef = (node: DesignerNode): string | undefined => {
  const definition = node.binding[VIZ_DATA_RESOURCE_BINDING_KEY];
  const ref = definition?.dataSourceRef ?? definition?.sourcePath;
  const trimmed = typeof ref === 'string' ? ref.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getNodeVizDataResourceBinding = (node: DesignerNode): DesignerBindingDefinition | undefined =>
  node.binding[VIZ_DATA_RESOURCE_BINDING_KEY];

export const createVizDataResourceBindingDefinition = (
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

export const resolveVizListDataVarName = (nodeId: string): string => {
  const suffix = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `vizData_${suffix}`;
};

export const resolveVizWidgetKindForNode = (node: DesignerNode): VizWidgetKind | null =>
  resolveVizWidgetKindFromPaletteId(resolveNodePaletteItemId(node));

export const resolveVizQueryParamsForNode = (node: DesignerNode): Record<string, string> => {
  const toolbarConfig = parseDesignerChartToolbarConfig(node.props[VIZ_TOOLBAR_CONFIG_PROP]);
  return buildChartListQueryParamBindings(toolbarConfig, node.id);
};

export const collectDocumentVizPlan = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): DocumentVizPlan => {
  const dataSources = getDataSources(bindingDefinitions);
  const vizListFetches: ResolvedVizListFetch[] = [];

  for (const node of Object.values(document.nodes)) {
    if (!isNonChartVizNode(node)) {
      continue;
    }

    const dataSourceRef = getNodeVizDataResourceRef(node);
    if (!dataSourceRef) {
      continue;
    }

    const widgetKind = resolveVizWidgetKindForNode(node);
    if (!widgetKind) {
      continue;
    }

    const dataSource = dataSources[dataSourceRef];
    if (!dataSource?.endpoint?.trim()) {
      continue;
    }

    const vizBinding = getNodeVizDataResourceBinding(node);
    const listEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'list');
    const resource = dataSourceToResource(dataSource);
    const fieldMapping = parseDesignerVizFieldMapping(node.props[VIZ_FIELD_MAPPING_PROP])
      ?? buildDefaultVizFieldMapping(widgetKind, dataSource.fields);
    const toolbarConfig = parseDesignerChartToolbarConfig(node.props[VIZ_TOOLBAR_CONFIG_PROP]);

    vizListFetches.push({
      nodeId: node.id,
      widgetKind,
      dataSourceId: dataSourceRef,
      dataSource,
      dataVar: resolveVizListDataVarName(node.id),
      fetchConfig: {
        configKey: createFetchConfigKey(listEndpoint, vizBinding?.urlParams ?? {}, {}),
        endpointTemplate: listEndpoint,
        urlParams: { ...(vizBinding?.urlParams ?? {}) },
        headers: {},
      },
      responseMapping: resource.response,
      queryParams: resolveVizQueryParamsForNode(node),
      fieldMapping,
      toolbarConfig,
    });
  }

  return { vizListFetches };
};

export const buildVizBindingWizardActions = (
  vizNode: DesignerNode,
  dataSource: DataSourceDefinition,
  options: {
    fieldMapping?: DesignerVizFieldMapping;
    toolbarConfig?: DesignerChartToolbarConfig;
  } = {},
): VizBindingWizardDispatchAction[] => {
  const widgetKind = resolveVizWidgetKindForNode(vizNode);
  if (!widgetKind) {
    return [];
  }

  const fieldMapping = options.fieldMapping ?? buildDefaultVizFieldMapping(widgetKind, dataSource.fields);
  const toolbarConfig = options.toolbarConfig ?? parseDesignerChartToolbarConfig(vizNode.props[VIZ_TOOLBAR_CONFIG_PROP]);
  const queryParams = buildChartListQueryParamBindings(toolbarConfig, vizNode.id);

  return [
    {
      type: 'set-node-binding',
      nodeId: vizNode.id,
      bindingKey: VIZ_DATA_RESOURCE_BINDING_KEY,
      definition: createVizDataResourceBindingDefinition(dataSource.id, { queryParams }),
    },
    {
      type: 'set-node-prop',
      nodeId: vizNode.id,
      key: VIZ_FIELD_MAPPING_PROP,
      value: serializeDesignerVizFieldMapping(fieldMapping),
    },
    {
      type: 'set-node-prop',
      nodeId: vizNode.id,
      key: VIZ_TOOLBAR_CONFIG_PROP,
      value: serializeDesignerChartToolbarConfig(toolbarConfig, vizNode.id),
    },
  ];
};

export const buildVizBindingWithToolbarQueryParams = (
  dataSourceRef: string,
  nodeId: string,
  toolbarConfig: DesignerChartToolbarConfig | undefined,
  existing?: DesignerBindingDefinition,
): DesignerBindingDefinition => createVizDataResourceBindingDefinition(dataSourceRef, {
  urlParams: existing?.urlParams,
  queryParams: buildChartListQueryParamBindings(toolbarConfig, nodeId),
});

export const resolveVizDataFromRows = (
  rows: Array<Record<string, unknown>> | undefined,
  fieldMapping: DesignerVizFieldMapping | null,
): unknown => {
  if (!rows || rows.length === 0 || !fieldMapping) {
    return undefined;
  }
  return transformApiRowsToVizData(rows, fieldMapping);
};

export const resolveVizDataVarExpressionForCodegen = (
  dataVar: string,
  fieldMapping: DesignerVizFieldMapping,
): string => {
  const mappingJson = JSON.stringify(fieldMapping);
  const rowsExpression = `Array.isArray(${dataVar}) ? ${dataVar} as Array<Record<string, unknown>> : []`;
  switch (fieldMapping.kind) {
    case 'tree':
      return `transformApiRowsToTreeNodes(${rowsExpression}, ${mappingJson})`;
    case 'timeline':
    case 'gantt':
      return `transformApiRowsToTimelineEvents(${rowsExpression}, ${mappingJson})`;
    case 'kanban':
      return `transformApiRowsToKanbanBoard(${rowsExpression}, ${mappingJson})`;
    case 'sheet':
      return `transformApiRowsToSheetData(${rowsExpression}, ${mappingJson})`;
    default:
      return rowsExpression;
  }
};
