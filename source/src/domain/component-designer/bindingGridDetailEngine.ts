import type { ApiFormField } from './apiFieldSchema';
import { humanizeFieldName, suggestControlForField } from './apiFieldToControl';
import {
  mergeAutoFormIntoDocument,
  type AutoFormFieldConfig,
} from './autoFormTemplateBuilder';
import { createFetchConfigKey } from './bindingApiHelpers';
import { sanitizeGridDetailFlowConfig } from './bindingGridDetailConfig';
import { visibilityStorePathForNode } from './bindingDynamicActionsEngine';
import {
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  isDataRegionEligibleContainer,
  REGION_DATA_SOURCE_BINDING_KEY,
  resolveRegionDataVarName,
} from './bindingRegionEngine';
import {
  buildDefaultDetailUrlParams,
  buildFormBindingWizardActions,
  resolveNodePaletteItemId,
  type FormBindingWizardDispatchAction,
} from './bindingResourceModel';
import { getDataSources } from './bindingRegistry';
import { patchNestedStoreValue } from './designerPreviewResolvers';
import { propertyBindingKeyForProp } from './bindingEngine';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import {
  createActionGridColumn,
  GRID_DETAIL_ACTION_ID,
  parseDesignerDataGridColumns,
  serializeDesignerDataGridColumns,
  type DesignerDataGridColumn,
} from './designerDataGridColumns';
import {
  GRID_LIST_RESOURCE_BINDING_KEY,
  getNodeGridListResourceRef,
  isDataGridNode,
  resolveGridListDataVarName,
} from './bindingGridEngine';
import type {
  DataSourceDefinition,
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  DesignerStoreSegment,
  GridDetailFlowConfig,
} from './types';

export const GRID_DETAIL_FLOW_BINDING_KEY = 'gridDetailFlow';

export type ResolvedGridDetailFlow = {
  gridNodeId: string;
  config: GridDetailFlowConfig;
  detailDataVar: string;
  detailRefreshVar: string;
  handlerName: string;
};

export type GridDetailWizardDispatchAction =
  | FormBindingWizardDispatchAction
  | {
    type: 'hydrate-document';
    document: DesignerDocument;
    bindingDefinitions: DesignerBindingDefinitions;
    preferredSelectedNodeId: string | null;
    resetViewport?: boolean;
  }
  | {
    type: 'set-node-prop';
    nodeId: string;
    key: string;
    value: unknown;
  }
  | {
    type: 'set-node-layout';
    nodeId: string;
    layout: Partial<DesignerNode['layout']>;
  }
  | {
    type: 'set-store-segment';
    segmentId: string;
    segment: DesignerStoreSegment;
  };

const DEFAULT_SELECTION_STORE_PATH = 'selection.id';

export { sanitizeGridDetailFlowConfig } from './bindingGridDetailConfig';

export const createGridDetailFlowBindingDefinition = (
  config: GridDetailFlowConfig,
): DesignerBindingDefinition => ({
  sourceType: 'static',
  bindingRole: 'general',
  gridDetailFlow: config,
});

export const getNodeGridDetailFlowBinding = (node: DesignerNode): DesignerBindingDefinition | undefined =>
  node.binding[GRID_DETAIL_FLOW_BINDING_KEY];

export const parseGridDetailFlowConfig = (node: DesignerNode): GridDetailFlowConfig | null => {
  const definition = getNodeGridDetailFlowBinding(node);
  return sanitizeGridDetailFlowConfig(definition?.gridDetailFlow);
};

export const listDesignerModalNodes = (document: DesignerDocument): DesignerNode[] =>
  Object.values(document.nodes).filter((node) => {
    const paletteItemId = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
    return paletteItemId === 'heroui.modal' || paletteItemId === 'heroui.alert-dialog';
  });

export const findFormRegionInside = (document: DesignerDocument, parentId: string): string | null => {
  const queue = [...(document.nodes[parentId]?.children ?? [])];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      continue;
    }

    const node = document.nodes[nodeId];
    if (!node) {
      continue;
    }

    if (resolveNodePaletteItemId(node) === 'html.form' && isDataRegionEligibleContainer(node)) {
      return node.id;
    }

    if (isDataRegionEligibleContainer(node)) {
      queue.push(...node.children);
    }
  }

  return null;
};

const CONTROL_PALETTE_PREFIX = 'heroui.';

const countFormFieldControls = (document: DesignerDocument, formNodeId: string): number => {
  const formNode = document.nodes[formNodeId];
  if (!formNode) {
    return 0;
  }

  let count = 0;
  const queue = [...formNode.children];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      continue;
    }

    const node = document.nodes[nodeId];
    if (!node) {
      continue;
    }

    const paletteItemId = resolveNodePaletteItemId(node);
    if (paletteItemId?.startsWith(CONTROL_PALETTE_PREFIX) && paletteItemId !== 'heroui.button-solid') {
      count += 1;
    }

    if (isDataRegionEligibleContainer(node)) {
      queue.push(...node.children);
    }
  }

  return count;
};

const toBodyField = (name: string): ApiFormField => ({
  name,
  type: 'string',
  location: 'body',
  required: false,
});

const buildDetailAutoFormFieldConfigs = (
  dataSource: DataSourceDefinition,
  displayColumns: string[],
): AutoFormFieldConfig[] => {
  const primaryKey = dataSource.primaryKey?.trim() || 'id';
  const columns = displayColumns.length > 0
    ? displayColumns
    : dataSource.fields.filter((field) => field !== primaryKey);

  return columns.map((column) => {
    const field = toBodyField(column);
    return {
      field,
      enabled: true,
      label: humanizeFieldName(column),
      controlPaletteItemId: suggestControlForField(field),
    };
  });
};

export const resolveDetailLoadEndpoint = (dataSource: DataSourceDefinition | undefined): string => {
  if (!dataSource) {
    return '';
  }

  const detailEndpoint = dataSource.operations?.detail?.endpoint?.trim();
  if (detailEndpoint) {
    return detailEndpoint;
  }

  const baseEndpoint = dataSource.endpoint.trim();
  return baseEndpoint.includes(':') ? baseEndpoint : '';
};

export const validateDetailDataSourceForGridFlow = (
  dataSource: DataSourceDefinition | undefined,
): string | null => {
  if (!dataSource) {
    return 'Connect a GET-one detail endpoint.';
  }

  const detailEndpoint = resolveDetailLoadEndpoint(dataSource);
  if (!detailEndpoint || !detailEndpoint.includes(':')) {
    return 'Detail API must be a GET-one route with :id (for example /api/contact/messages/:id), not the list endpoint.';
  }

  return null;
};

type ProvisionedDetailFormRegion = {
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  detailRegionNodeId: string;
  autoProvisioned: boolean;
};

const provisionDetailFormRegionIfNeeded = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  config: Pick<GridDetailWizardConfig, 'detailModalNodeId' | 'detailRegionNodeId' | 'detailDataSource' | 'detailDisplayColumns'>,
): ProvisionedDetailFormRegion => {
  let regionId = config.detailRegionNodeId.trim() || findFormRegionInside(document, config.detailModalNodeId) || '';
  const fieldConfigs = buildDetailAutoFormFieldConfigs(config.detailDataSource, config.detailDisplayColumns);
  const autoFormConfig = {
    includeTitle: false as const,
    dataSource: config.detailDataSource,
    scenario: 'detail' as const,
    fields: fieldConfigs,
    submitLabel: '',
    successBehavior: 'none' as const,
    layout: 'single' as const,
  };

  if (!regionId) {
    const result = mergeAutoFormIntoDocument(
      document,
      bindingDefinitions,
      autoFormConfig,
      { mode: 'modal-insert', modalNodeId: config.detailModalNodeId },
    );
    regionId = result.preferredSelectedNodeId
      ?? findFormRegionInside(result.document, config.detailModalNodeId)
      ?? '';

    return {
      document: result.document,
      bindingDefinitions: result.bindingDefinitions,
      detailRegionNodeId: regionId,
      autoProvisioned: Boolean(regionId),
    };
  }

  if (countFormFieldControls(document, regionId) === 0) {
    const result = mergeAutoFormIntoDocument(
      document,
      bindingDefinitions,
      autoFormConfig,
      { mode: 'form-region', formNodeId: regionId },
    );

    return {
      document: result.document,
      bindingDefinitions: result.bindingDefinitions,
      detailRegionNodeId: regionId,
      autoProvisioned: true,
    };
  }

  return {
    document,
    bindingDefinitions,
    detailRegionNodeId: regionId,
    autoProvisioned: false,
  };
};

export const ensureGridDetailActionColumn = (
  columns: DesignerDataGridColumn[],
  actionLabel: string,
  actionId = GRID_DETAIL_ACTION_ID,
): DesignerDataGridColumn[] => {
  const hasAction = columns.some((column) =>
    column.kind === 'action' && (column.actionId ?? GRID_DETAIL_ACTION_ID) === actionId,
  );

  if (hasAction) {
    return columns;
  }

  return [...columns, createActionGridColumn(actionLabel, actionId)];
};

export const resolveGridDetailRowActionHandlerName = (gridNodeId: string): string =>
  `handleGridRowAction_${gridNodeId.replace(/[^a-zA-Z0-9_]/g, '_')}`;

export const resolveGridDetailRegionDataVarName = (
  dataSourceId: string,
  regionNodeId: string,
  regionsPerDataSource = 1,
): string => resolveRegionDataVarName(dataSourceId, regionNodeId, regionsPerDataSource);

export const collectDocumentGridDetailFlows = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): ResolvedGridDetailFlow[] => {
  const dataSources = getDataSources(bindingDefinitions);
  const flows: ResolvedGridDetailFlow[] = [];

  for (const node of Object.values(document.nodes)) {
    if (!isDataGridNode(node)) {
      continue;
    }

    const config = parseGridDetailFlowConfig(node);
    if (!config) {
      continue;
    }

    const detailDataSource = dataSources[config.detailDataSourceRef];
    if (!detailDataSource?.endpoint?.trim()) {
      continue;
    }

    const dataVar = resolveGridDetailRegionDataVarName(config.detailDataSourceRef, config.detailRegionNodeId);
    flows.push({
      gridNodeId: node.id,
      config,
      detailDataVar: dataVar,
      detailRefreshVar: `refresh_${dataVar}`,
      handlerName: resolveGridDetailRowActionHandlerName(node.id),
    });
  }

  return flows;
};

export type GridDetailWizardConfig = {
  gridNodeId: string;
  detailDataSourceId: string;
  detailDataSource: DataSourceDefinition;
  detailModalNodeId: string;
  detailRegionNodeId: string;
  primaryKeyField: string;
  rowActionLabel: string;
  detailDisplayColumns: string[];
};

export const buildGridDetailWizardActions = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  config: GridDetailWizardConfig,
): GridDetailWizardDispatchAction[] => {
  const gridNode = document.nodes[config.gridNodeId];
  if (!gridNode || !isDataGridNode(gridNode)) {
    return [];
  }

  const provisioned = provisionDetailFormRegionIfNeeded(document, bindingDefinitions, config);
  const workingDocument = provisioned.document;
  const workingBindings = provisioned.bindingDefinitions;
  const detailRegionNodeId = provisioned.detailRegionNodeId;
  if (!detailRegionNodeId) {
    return [];
  }

  const actions: GridDetailWizardDispatchAction[] = [];
  const rowActionId = GRID_DETAIL_ACTION_ID;
  const selectionStorePath = DEFAULT_SELECTION_STORE_PATH;
  const selectionSegmentId = selectionStorePath.split('.')[0] ?? 'selection';

  if (provisioned.autoProvisioned) {
    actions.push({
      type: 'hydrate-document',
      document: workingDocument,
      bindingDefinitions: workingBindings,
      preferredSelectedNodeId: detailRegionNodeId,
      resetViewport: false,
    });
  }

  actions.push({
    type: 'set-data-source',
    dataSourceId: config.detailDataSourceId,
    dataSource: config.detailDataSource,
  });

  actions.push({
    type: 'set-store-segment',
    segmentId: selectionSegmentId,
    segment: {
      id: selectionSegmentId,
      initialValue: { id: null },
      persist: 'none',
    },
  });

  const detailFlowConfig: GridDetailFlowConfig = {
    primaryKeyField: config.primaryKeyField,
    selectionStorePath,
    detailDataSourceRef: config.detailDataSourceId,
    detailModalNodeId: config.detailModalNodeId,
    detailRegionNodeId,
    rowActionId,
    rowActionLabel: config.rowActionLabel,
  };

  actions.push({
    type: 'set-node-binding',
    nodeId: config.gridNodeId,
    bindingKey: GRID_DETAIL_FLOW_BINDING_KEY,
    definition: createGridDetailFlowBindingDefinition(detailFlowConfig),
  });

  const currentColumns = parseDesignerDataGridColumns(gridNode.props.columns);
  const nextColumns = ensureGridDetailActionColumn(currentColumns, config.rowActionLabel, rowActionId);
  if (serializeDesignerDataGridColumns(nextColumns) !== serializeDesignerDataGridColumns(currentColumns)) {
    actions.push({
      type: 'set-node-prop',
      nodeId: config.gridNodeId,
      key: 'columns',
      value: serializeDesignerDataGridColumns(nextColumns),
    });
  }

  const visibilityPath = visibilityStorePathForNode(config.detailModalNodeId);
  actions.push({
    type: 'set-node-layout',
    nodeId: config.detailModalNodeId,
    layout: {
      visibleCondition: `store.${visibilityPath} === true`,
    },
  });

  if (!provisioned.autoProvisioned) {
    actions.push({
      type: 'set-node-binding',
      nodeId: detailRegionNodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition(config.detailDataSourceId, {
        loadOperation: 'detail',
        urlParams: buildDefaultDetailUrlParams(config.detailDataSource),
      }),
    });
  }

  const detailRegionNode = workingDocument.nodes[detailRegionNodeId];
  if (detailRegionNode && !provisioned.autoProvisioned) {
    const bindableChildren = Object.values(workingDocument.nodes).filter((node) => node.parentId === detailRegionNodeId);
    const fieldMappings = config.detailDisplayColumns.map((column) => {
      const child = bindableChildren.find((node) => {
        const label = typeof node.props.label === 'string' ? node.props.label.trim().toLowerCase() : '';
        return label === column.toLowerCase() || node.id.includes(column);
      });
      return {
        nodeId: child?.id ?? '',
        fieldKey: column,
        column,
        enabled: Boolean(child),
      };
    }).filter((mapping) => mapping.enabled);

    if (fieldMappings.length > 0) {
      actions.push(...buildFormBindingWizardActions(workingDocument, workingBindings, {
        scenario: 'detail',
        regionNodeId: detailRegionNodeId,
        dataSourceId: config.detailDataSourceId,
        fieldMappings,
        successBehavior: 'none',
        submitEventTarget: 'onClick',
      }));
    } else {
      for (const column of config.detailDisplayColumns) {
        const textNode = bindableChildren.find((node) => node.type === 'text' || node.type === 'heading');
        if (!textNode) {
          continue;
        }
        actions.push({
          type: 'set-node-binding',
          nodeId: textNode.id,
          bindingKey: propertyBindingKeyForProp('text'),
          definition: createRegionColumnBindingDefinition('text', column),
        });
      }
    }
  }

  return actions;
};

export const collectGridDetailModalNodeIds = (document: DesignerDocument): Set<string> => {
  const modalNodeIds = new Set<string>();

  for (const node of Object.values(document.nodes)) {
    const config = parseGridDetailFlowConfig(node);
    if (config?.detailModalNodeId.trim()) {
      modalNodeIds.add(config.detailModalNodeId.trim());
    }
  }

  return modalNodeIds;
};

export const gridDetailVisibilityConditionForNode = (nodeId: string): string =>
  `store.${visibilityStorePathForNode(nodeId)} === true`;

export const readGridDetailModalOpenFromStore = (
  designerStore: Record<string, unknown> | undefined,
  nodeId: string,
): boolean => {
  if (!designerStore) {
    return false;
  }

  const segments = visibilityStorePathForNode(nodeId).split('.').filter(Boolean);
  let cursor: unknown = designerStore;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object' || !(segment in (cursor as Record<string, unknown>))) {
      return false;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return cursor === true;
};

/**
 * True once the node's visibility store path has ever been explicitly written to (open OR
 * closed) — distinct from `readGridDetailModalOpenFromStore`, which can't tell "never touched"
 * apart from "explicitly closed" (both read as `false`). Used to decide whether a static
 * Inspector "Open" checkbox should still apply (see the bug note at its Modal/Drawer call sites
 * in runtimeRenderer.tsx).
 */
export const hasGridDetailModalStoreEntry = (
  designerStore: Record<string, unknown> | undefined,
  nodeId: string,
): boolean => {
  if (!designerStore) {
    return false;
  }

  const segments = visibilityStorePathForNode(nodeId).split('.').filter(Boolean);
  let cursor: unknown = designerStore;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object' || !(segment in (cursor as Record<string, unknown>))) {
      return false;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return typeof cursor === 'boolean';
};

export const buildGridDetailRowActionPreview = (
  flow: ResolvedGridDetailFlow,
  row: Record<string, unknown>,
  actionId: string,
  context: {
    patchStore: (path: string, value: unknown) => void;
    patchStoreState?: (updater: (store: Record<string, unknown>) => Record<string, unknown>) => void;
    refreshDetail?: () => Promise<void>;
  },
): void => {
  if (actionId !== flow.config.rowActionId) {
    return;
  }

  const recordId = row[flow.config.primaryKeyField];
  const visibilityPath = visibilityStorePathForNode(flow.config.detailModalNodeId);

  if (context.patchStoreState) {
    context.patchStoreState((store) => {
      let next = patchNestedStoreValue(store, flow.config.selectionStorePath, recordId ?? null);
      next = patchNestedStoreValue(next, visibilityPath, true);
      return next;
    });
  } else {
    context.patchStore(flow.config.selectionStorePath, recordId ?? null);
    context.patchStore(visibilityPath, true);
  }

  if (context.refreshDetail) {
    queueMicrotask(() => {
      void context.refreshDetail?.();
    });
  }
};

export const resolveGridDetailFetchConfigKey = (
  flow: ResolvedGridDetailFlow,
  dataSource: DataSourceDefinition,
  urlParams: Record<string, string>,
): string => {
  const detailEndpoint = dataSource.operations?.detail?.endpoint.trim() || dataSource.endpoint.trim();
  return createFetchConfigKey(detailEndpoint, urlParams, {});
};

export const suggestGridDetailPrimaryKeyField = (
  listDataSource: DataSourceDefinition | undefined,
  detailDataSource: DataSourceDefinition | undefined,
): string => {
  const detailPk = detailDataSource?.primaryKey?.trim();
  if (detailPk) {
    return detailPk;
  }

  const listPk = listDataSource?.primaryKey?.trim();
  if (listPk) {
    return listPk;
  }

  if (detailDataSource?.fields.includes('id')) {
    return 'id';
  }

  if (listDataSource?.fields.includes('id')) {
    return 'id';
  }

  return 'id';
};

export const resolveGridListDataVarForNode = (
  gridNodeId: string,
): string => resolveGridListDataVarName(gridNodeId);

export const gridNodeHasListBinding = (node: DesignerNode): boolean =>
  Boolean(getNodeGridListResourceRef(node));
