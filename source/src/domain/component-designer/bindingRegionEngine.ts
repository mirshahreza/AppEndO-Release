import { isContainerNode, nodeHasCapability } from './catalog';
import { createFetchConfigKey } from './bindingApiHelpers';
import type { ResolvedFetchConfig } from './bindingEngine';
import {
  resolvePropertyBindingFetchEndpoint,
  resolvePropertyBindingLovMapping,
  type LovColumnMapping,
} from './bindingLovRegistry';
import { getDataSources } from './bindingRegistry';
import {
  findAncestorOverlayNodeId,
  resolveRegionLoadConfig,
  resolveRegionSubmitEndpoints,
  resolveOperationUrl,
  dataSourceToResource,
  inferDataResourceKind,
} from './bindingResourceModel';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import {
  BASE_INFO_RECORD_FORM_COLUMNS,
  BASE_INFO_RECORD_FORM_PALETTE_ID,
  baseInfoRecordHiddenFieldName,
} from './baseInfoRecordFormColumns';
import type {
  DataSourceDefinition,
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  PayloadFieldTransform,
} from './types';

export type RegionFormFieldMapping = {
  nodeId: string;
  column: string;
  formFieldName: string;
  payloadTransform?: PayloadFieldTransform;
};

export type ResolvedRegionSubmitPlan = {
  regionNodeId: string;
  dataSourceId: string;
  dataSource: DataSourceDefinition;
  dataVar: string;
  endpoint: string;
  createEndpoint: string;
  updateEndpoint: string;
  /** `dataSource.operations.update.method` (e.g. `'PATCH'`) — falls back to `'PUT'` when unset. */
  updateMethod?: string;
  primaryKey?: string;
  fieldMappings: RegionFormFieldMapping[];
};

export const resolveRegionFormFieldName = (nodeId: string): string => nodeId.trim();

export const REGION_DATA_SOURCE_BINDING_KEY = 'regionDataSource';

export type ResolvedRegionFetch = {
  dataSourceId: string;
  dataSource: DataSourceDefinition;
  dataVar: string;
  regionNodeId: string;
  fetchConfig: ResolvedFetchConfig;
  responseMapping?: import('./types').DesignerResponseMapping;
  regionNodeIds: string[];
};

export type ResolvedRegionColumnBinding = {
  bindingKey: string;
  nodeId: string;
  targetProp: string;
  column: string;
  dataSourceId: string;
  dataVar: string;
  regionNodeId: string;
  definition: DesignerBindingDefinition;
};

export type RegionColumnLovFetch = {
  nodeId: string;
  lovRef: string;
  dataVar: string;
  refreshVar: string;
  fetchConfig: ResolvedFetchConfig;
  lovMapping: LovColumnMapping;
};

export type DocumentRegionPlan = {
  regionFetches: ResolvedRegionFetch[];
  regionColumnBindings: ResolvedRegionColumnBinding[];
  regionColumnLovFetches: RegionColumnLovFetch[];
};

export const REGION_COLUMN_LOV_PALETTE_ITEM_IDS = [
  'heroui.select',
  'heroui.autocomplete',
] as const;

export const REGION_COLUMN_LOV_PALETTE_ITEM_ID_SET = new Set<string>(REGION_COLUMN_LOV_PALETTE_ITEM_IDS);

export const nodeSupportsRegionColumnLov = (node: DesignerNode): boolean => {
  const paletteItemId = resolveNodePaletteItemId(node);
  return Boolean(paletteItemId && REGION_COLUMN_LOV_PALETTE_ITEM_ID_SET.has(paletteItemId));
};

export const resolveRegionColumnLovDataVarName = (nodeId: string): string => {
  const suffix = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `lovData_${suffix}`;
};

const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : undefined;
};

export const isDataRegionEligibleContainer = (node: DesignerNode): boolean => {
  if (!isContainerNode(node)) {
    return false;
  }

  // T1-11e: Data Region inspector/codegen only for bindable containers
  // (e.g. layout.flex-row), not structural wrappers like aspect-ratio/overlay.
  if (!nodeHasCapability(node, 'bindable')) {
    return false;
  }

  const paletteItemId = resolveNodePaletteItemId(node);
  if (paletteItemId === 'html.form') {
    return true;
  }

  return Boolean(paletteItemId?.startsWith('layout.'));
};

export const getNodeRegionDataSourceBinding = (node: DesignerNode): DesignerBindingDefinition | undefined =>
  node.binding[REGION_DATA_SOURCE_BINDING_KEY];

export const getNodeRegionDataSourceRef = (node: DesignerNode): string | undefined => {
  const definition = node.binding[REGION_DATA_SOURCE_BINDING_KEY];
  const ref = definition?.dataSourceRef ?? definition?.sourcePath;
  const trimmed = typeof ref === 'string' ? ref.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
};

export const createRegionDataSourceBindingDefinition = (
  dataSourceRef: string,
  options: {
    loadOperation?: DesignerBindingDefinition['loadOperation'];
    urlParams?: Record<string, string>;
  } = {},
): DesignerBindingDefinition => ({
  sourceType: 'static',
  dataSourceRef: dataSourceRef.trim(),
  sourcePath: dataSourceRef.trim(),
  loadOperation: options.loadOperation,
  urlParams: options.urlParams,
});

export const isRegionColumnBindingDefinition = (
  definition: DesignerBindingDefinition,
): boolean => definition.sourceType === 'regionColumn'
  && typeof definition.column === 'string'
  && definition.column.trim().length > 0;

export const createRegionSubmitEventBindingDefinition = (
  targetEvent: string,
  options: {
    trueActions?: import('./types').DesignerDynamicAction[];
    invalidateQueries?: string[];
    responseStorePath?: string;
  } = {},
): DesignerBindingDefinition => ({
  sourceType: 'apiRef',
  bindingRole: 'event',
  targetEvent,
  regionSubmit: true,
  trueActions: options.trueActions,
  invalidateQueries: options.invalidateQueries,
  responseStorePath: options.responseStorePath,
});

export const isRegionSubmitBindingDefinition = (
  definition: DesignerBindingDefinition,
): boolean => definition.regionSubmit === true;

export const createRegionColumnBindingDefinition = (
  targetProp: string,
  column: string,
  options: { lovRef?: string; payloadTransform?: PayloadFieldTransform } = {},
): DesignerBindingDefinition => ({
  sourceType: 'regionColumn',
  bindingRole: 'property',
  targetProp,
  column: column.trim(),
  valueMode: 'defaultValue',
  lovRef: options.lovRef?.trim() || undefined,
  payloadTransform: options.payloadTransform,
});

export const getNodeRegionColumnOptionLovDefinition = (
  node: DesignerNode,
): DesignerBindingDefinition | null => {
  for (const definition of Object.values(node.binding)) {
    if (definition && isRegionColumnBindingDefinition(definition) && definition.lovRef?.trim()) {
      return definition;
    }
  }

  return null;
};

export const getNodeRegionColumnBinding = (
  node: DesignerNode,
  targetProp: string,
): { bindingKey: string; definition: DesignerBindingDefinition; column: string } | null => {
  const bindingKey = `prop:${targetProp}`;
  const definition = node.binding[bindingKey];
  if (!definition || !isRegionColumnBindingDefinition(definition)) {
    return null;
  }

  return {
    bindingKey,
    definition,
    column: definition.column!.trim(),
  };
};

export const findAncestorDataRegion = (
  document: DesignerDocument,
  nodeId: string,
): { regionNode: DesignerNode; dataSourceRef: string } | null => {
  let parentId = document.nodes[nodeId]?.parentId ?? null;

  while (parentId) {
    const parent = document.nodes[parentId];
    if (!parent) {
      break;
    }

    const dataSourceRef = getNodeRegionDataSourceRef(parent);
    if (dataSourceRef && isDataRegionEligibleContainer(parent)) {
      return { regionNode: parent, dataSourceRef };
    }

    parentId = parent.parentId;
  }

  return null;
};

const findRegionFormInSubtree = (
  document: DesignerDocument,
  rootNodeId: string,
): { regionNode: DesignerNode; dataSourceRef: string } | null => {
  const queue = [...(document.nodes[rootNodeId]?.children ?? [])];

  while (queue.length > 0) {
    const childId = queue.shift()!;
    const child = document.nodes[childId];
    if (!child) {
      continue;
    }

    const dataSourceRef = getNodeRegionDataSourceRef(child);
    if (dataSourceRef && isDataRegionEligibleContainer(child)) {
      return { regionNode: child, dataSourceRef };
    }

    queue.push(...child.children);
  }

  return null;
};

/** Footer submit buttons are moved outside the region form but still live in the same modal shell. */
export const findOverlayShellRegionForm = (
  document: DesignerDocument,
  nodeId: string,
): { regionNode: DesignerNode; dataSourceRef: string } | null => {
  const overlayNodeId = findAncestorOverlayNodeId(document, nodeId);
  if (!overlayNodeId) {
    return null;
  }

  return findRegionFormInSubtree(document, overlayNodeId);
};

export const regionNodeHasSubmitBinding = (
  document: DesignerDocument,
  regionNodeId: string,
): boolean => {
  const visited = new Set<string>();

  const walk = (nodeId: string): boolean => {
    if (visited.has(nodeId)) {
      return false;
    }
    visited.add(nodeId);

    const node = document.nodes[nodeId];
    if (!node) {
      return false;
    }

    for (const definition of Object.values(node.binding)) {
      if (definition && isRegionSubmitBindingDefinition(definition)) {
        return true;
      }
    }

    return node.children.some((childId) => walk(childId));
  };

  if (walk(regionNodeId)) {
    return true;
  }

  // CRUD modals move Save into a DialogFooter sibling of the form region (see
  // standardizeRecordsFormModal) — submit is no longer a descendant of the region node.
  const overlayNodeId = findAncestorOverlayNodeId(document, regionNodeId);
  if (overlayNodeId && overlayNodeId !== regionNodeId) {
    return walk(overlayNodeId);
  }

  return false;
};

/** Detail regions opened for view-only (no Save/submit) render bound fields as read-only. */
export const isRegionDetailReadOnlyForm = (
  document: DesignerDocument,
  inputNodeId: string,
): boolean => {
  const ancestor = findAncestorDataRegion(document, inputNodeId);
  if (!ancestor) {
    return false;
  }

  const regionBinding = getNodeRegionDataSourceBinding(ancestor.regionNode);
  if (regionBinding?.loadOperation !== 'detail') {
    return false;
  }

  return !regionNodeHasSubmitBinding(document, ancestor.regionNode.id);
};

export const resolveRegionDataVarName = (dataSourceId: string, regionNodeId?: string, regionsPerDataSource = 1): string => {
  const suffix = dataSourceId.replace(/[^a-zA-Z0-9_]/g, '_');
  if (!regionNodeId || regionsPerDataSource <= 1) {
    return `regionData_${suffix}`;
  }

  const nodeSuffix = regionNodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `regionData_${suffix}_${nodeSuffix}`;
};

export const countRegionNodesForDataSource = (
  document: DesignerDocument,
  dataSourceRef: string,
): number => {
  let count = 0;

  for (const node of Object.values(document.nodes)) {
    if (!isDataRegionEligibleContainer(node)) {
      continue;
    }

    if (getNodeRegionDataSourceRef(node) === dataSourceRef) {
      count += 1;
    }
  }

  return count;
};

export const resolveAncestorRegionDataVar = (
  document: DesignerDocument,
  ancestor: { regionNode: DesignerNode; dataSourceRef: string },
): string => {
  const regionsPerDataSource = countRegionNodesForDataSource(document, ancestor.dataSourceRef);
  return resolveRegionDataVarName(ancestor.dataSourceRef, ancestor.regionNode.id, regionsPerDataSource);
};

export const regionColumnToExpression = (dataVar: string, column: string): string => {
  const trimmedColumn = column.trim();
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(trimmedColumn)) {
    return `${dataVar}?.${trimmedColumn}`;
  }

  return `${dataVar}?.[${JSON.stringify(trimmedColumn)}]`;
};

export const formatRegionColumnPlaceholder = (column: string): string => `[Region: ${column}]`;

const dataSourceHasRegionLoadOperation = (
  dataSource: DataSourceDefinition,
  regionBinding?: DesignerBindingDefinition,
): boolean => {
  if (regionBinding?.loadOperation) {
    return true;
  }

  // Create-only region forms bind the data source but never set `loadOperation`.
  // Do not infer a background GET (e.g. `/api/base-info` or `/api/users/:id`) on mount/refresh.
  if (regionBinding) {
    return false;
  }

  const resource = dataSourceToResource(dataSource);
  if (resource.operations.list || resource.operations.detail) {
    return true;
  }

  return inferDataResourceKind(dataSource) === 'record' && Boolean(dataSource.primaryKey?.trim());
};

export const findRegionDataVarInSubtree = (
  document: DesignerDocument,
  rootNodeId: string,
): { regionNodeId: string; dataVar: string; loadOperation?: DesignerBindingDefinition['loadOperation'] } | undefined => {
  const visited = new Set<string>();
  const queue = [rootNodeId.trim()].filter(Boolean);

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);

    const node = document.nodes[nodeId];
    if (!node) {
      continue;
    }

    const dataSourceRef = getNodeRegionDataSourceRef(node);
    if (dataSourceRef && isDataRegionEligibleContainer(node)) {
      const regionsPerDataSource = countRegionNodesForDataSource(document, dataSourceRef);
      const regionBinding = getNodeRegionDataSourceBinding(node);
      return {
        regionNodeId: node.id,
        dataVar: resolveRegionDataVarName(dataSourceRef, node.id, regionsPerDataSource),
        loadOperation: regionBinding?.loadOperation,
      };
    }

    for (const childId of node.children ?? []) {
      queue.push(childId);
    }
  }

  return undefined;
};

export const collectDocumentRegionPlan = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): DocumentRegionPlan => {
  const dataSources = getDataSources(bindingDefinitions);
  const regionFetchByNodeId = new Map<string, ResolvedRegionFetch>();
  const regionColumnBindings: ResolvedRegionColumnBinding[] = [];
  const regionColumnLovFetches: RegionColumnLovFetch[] = [];
  const regionColumnLovNodeIds = new Set<string>();

  const regionNodesByDataSource = new Map<string, string[]>();
  for (const node of Object.values(document.nodes)) {
    if (!isDataRegionEligibleContainer(node)) {
      continue;
    }

    const dataSourceRef = getNodeRegionDataSourceRef(node);
    if (!dataSourceRef) {
      continue;
    }

    const list = regionNodesByDataSource.get(dataSourceRef) ?? [];
    list.push(node.id);
    regionNodesByDataSource.set(dataSourceRef, list);
  }

  // Every eligible region container gets a resolved `dataVar` regardless of whether it actually
  // fetches (`dataSourceHasRegionLoadOperation`) — a create-only form (no `loadOperation`, nothing
  // to pre-populate) is still a valid region whose descendant fields must be collectable as
  // submit field mappings. Only *fetch registration* (`regionFetchByNodeId`, consumed by the
  // hydration/preview-refresh machinery) stays gated on having a load operation; `dataVar`
  // resolution for column-binding purposes must not be, or `collectRegionFormFieldMappings` sees
  // zero mappings for every field inside a create-only form and every Create submit posts `{}`.
  const regionDataVarByNodeId = new Map<string, string>();

  for (const node of Object.values(document.nodes)) {
    if (!isDataRegionEligibleContainer(node)) {
      continue;
    }

    const dataSourceRef = getNodeRegionDataSourceRef(node);
    if (!dataSourceRef) {
      continue;
    }

    const dataSource = dataSources[dataSourceRef];
    if (!dataSource?.endpoint?.trim()) {
      continue;
    }

    const regionsPerDataSource = regionNodesByDataSource.get(dataSourceRef)?.length ?? 1;
    const dataVar = resolveRegionDataVarName(dataSourceRef, node.id, regionsPerDataSource);
    regionDataVarByNodeId.set(node.id, dataVar);

    if (!dataSourceHasRegionLoadOperation(dataSource, getNodeRegionDataSourceBinding(node))) {
      continue;
    }

    const regionBinding = getNodeRegionDataSourceBinding(node);
    const loadConfig = resolveRegionLoadConfig(dataSource, regionBinding);

    regionFetchByNodeId.set(node.id, {
      dataSourceId: dataSourceRef,
      dataSource,
      regionNodeId: node.id,
      dataVar,
      fetchConfig: {
        configKey: createFetchConfigKey(loadConfig.endpoint, loadConfig.urlParams, {}),
        endpointTemplate: loadConfig.endpoint,
        urlParams: loadConfig.urlParams,
        headers: {},
      },
      responseMapping: loadConfig.responseMapping,
      regionNodeIds: [node.id],
    });
  }

  for (const node of Object.values(document.nodes)) {
    const ancestor = findAncestorDataRegion(document, node.id);
    if (!ancestor) {
      continue;
    }

    const regionDataVar = regionDataVarByNodeId.get(ancestor.regionNode.id);
    if (regionDataVar === undefined) {
      continue;
    }

    for (const [bindingKey, definition] of Object.entries(node.binding)) {
      if (!isRegionColumnBindingDefinition(definition)) {
        continue;
      }

      const targetProp = definition.targetProp
        ?? (bindingKey.startsWith('prop:') ? bindingKey.slice(5) : undefined);
      if (!targetProp) {
        continue;
      }

      regionColumnBindings.push({
        bindingKey,
        nodeId: node.id,
        targetProp,
        column: definition.column!.trim(),
        dataSourceId: ancestor.dataSourceRef,
        dataVar: regionDataVar,
        regionNodeId: ancestor.regionNode.id,
        definition,
      });

      if (
        nodeSupportsRegionColumnLov(node)
        && definition.lovRef?.trim()
        && !regionColumnLovNodeIds.has(node.id)
      ) {
        const lovEndpoint = resolvePropertyBindingFetchEndpoint(definition, bindingDefinitions);
        const lovMapping = resolvePropertyBindingLovMapping(definition, bindingDefinitions);
        if (lovEndpoint && lovMapping) {
          const dataVar = resolveRegionColumnLovDataVarName(node.id);
          regionColumnLovNodeIds.add(node.id);
          regionColumnLovFetches.push({
            nodeId: node.id,
            lovRef: definition.lovRef.trim(),
            dataVar,
            refreshVar: `refresh_${dataVar}`,
            fetchConfig: {
              configKey: createFetchConfigKey(lovEndpoint, {}, {}),
              endpointTemplate: lovEndpoint,
              urlParams: {},
              headers: {},
            },
            lovMapping,
          });
        }
      }
    }
  }

  return {
    regionFetches: Array.from(regionFetchByNodeId.values()),
    regionColumnBindings,
    regionColumnLovFetches,
  };
};

export const resolveDataRegionForSubmit = (
  document: DesignerDocument,
  nodeId: string,
): { regionNode: DesignerNode; dataSourceRef: string } | null => {
  const node = document.nodes[nodeId];
  if (node) {
    const selfRef = getNodeRegionDataSourceRef(node);
    if (selfRef && isDataRegionEligibleContainer(node)) {
      return { regionNode: node, dataSourceRef: selfRef };
    }
  }

  return findAncestorDataRegion(document, nodeId)
    ?? findOverlayShellRegionForm(document, nodeId);
};

export const resolveDefaultRegionFieldTransform = (node: DesignerNode): PayloadFieldTransform | undefined => {
  const paletteItemId = resolveNodePaletteItemId(node);
  if (paletteItemId === 'heroui.number-input' || paletteItemId === 'form.calculator') {
    return 'number';
  }

  if (paletteItemId === 'heroui.switch') {
    return 'boolean';
  }

  if (paletteItemId === 'heroui.checkbox-group') {
    return 'commaSeparatedArray';
  }

  return undefined;
};

export const resolveRegionPrimaryKeyValue = (
  regionData: Record<string, unknown> | null | undefined,
  primaryKey?: string,
): string | null => {
  if (!primaryKey?.trim()) {
    return null;
  }

  const pkValue = regionData?.[primaryKey.trim()];
  if (pkValue === undefined || pkValue === null) {
    return null;
  }

  const text = String(pkValue);
  return text.length > 0 ? text : null;
};

export const resolveRegionDmlUrl = (
  endpoint: string,
  regionData: Record<string, unknown> | null | undefined,
  primaryKey?: string,
  urlParams: Record<string, string> = {},
): string => {
  const trimmedEndpoint = endpoint.trim();
  const pathParams = trimmedEndpoint.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  if (pathParams && pathParams.length > 0 && primaryKey?.trim()) {
    const pkValue = resolveRegionPrimaryKeyValue(regionData, primaryKey);
    const context = regionData ?? {};
    const mergedParams = { ...urlParams };
    const pkName = primaryKey.trim();
    if (!Object.values(mergedParams).some((path) => path.endsWith(`.${pkName}`) || path === pkName)) {
      const colonParam = pathParams[0]?.slice(1);
      if (colonParam && pkValue) {
        mergedParams[colonParam] = pkName;
      }
    }
    const resolved = resolveOperationUrl(trimmedEndpoint, { ...context, [pkName]: pkValue }, mergedParams);
    if (resolved && !resolved.includes(':')) {
      return resolved;
    }
  }

  const pkValue = resolveRegionPrimaryKeyValue(regionData, primaryKey);
  if (!pkValue) {
    return trimmedEndpoint;
  }

  const baseEndpoint = trimmedEndpoint.replace(/\/+$/, '');
  return `${baseEndpoint}/${encodeURIComponent(pkValue)}`;
};

// Bug found while building a full document end-to-end: this always appended the id as a
// trailing path segment (`base + '/' + id`), with zero awareness of a `:xxx`-style path
// parameter positioned *anywhere else* in the endpoint (e.g. `/api/users/:id/change-password`,
// a Phase-24 named-operation endpoint) — the literal `:id` was left in the URL and the real id
// got appended after it instead of substituted in place. `resolveMutationUrlExpressionForCodegen`
// (bindingDynamicActionsEngine.ts) already gets this right for callMutation actions; the same
// prefix/suffix-split logic is duplicated here (rather than imported) because
// bindingDynamicActionsEngine.ts already imports from this file, and importing back would create
// a circular dependency.
const resolvePathParamUrlExpression = (endpoint: string, idExpression: string): string => {
  const trimmed = endpoint.trim();
  const pathParamMatch = trimmed.match(/:[a-zA-Z_][a-zA-Z0-9_]*/);
  if (pathParamMatch) {
    const prefix = trimmed.slice(0, pathParamMatch.index);
    const suffix = trimmed.slice((pathParamMatch.index ?? 0) + pathParamMatch[0].length);
    return `(${JSON.stringify(prefix)} + encodeURIComponent(String(${idExpression})) + ${JSON.stringify(suffix)})`;
  }
  const base = trimmed.replace(/\/+$/, '');
  return `(${JSON.stringify(base)} + '/' + encodeURIComponent(String(${idExpression})))`;
};

export const resolveRegionDmlUrlExpression = (
  dataVar: string,
  endpoint: string,
  primaryKey?: string,
): string => {
  const trimmedEndpoint = endpoint.trim();
  if (!primaryKey?.trim()) {
    return JSON.stringify(trimmedEndpoint);
  }

  const pkExpression = regionColumnToExpression(dataVar, primaryKey.trim());
  return `(${pkExpression} != null && String(${pkExpression}).length > 0 ? ${resolvePathParamUrlExpression(trimmedEndpoint, pkExpression)} : ${JSON.stringify(trimmedEndpoint)})`;
};

export const resolveRegionDmlUrlExpressionForPlan = (
  dataVar: string,
  plan: { endpoint: string; createEndpoint: string; updateEndpoint: string; primaryKey?: string },
): string => {
  const createUrl = JSON.stringify(plan.createEndpoint || plan.endpoint);
  if (!plan.primaryKey?.trim()) {
    return createUrl;
  }

  const pkExpression = regionColumnToExpression(dataVar, plan.primaryKey.trim());
  // Bug found while building a full document end-to-end: this passed `plan.endpoint` (the base
  // collection endpoint) instead of `plan.updateEndpoint` — so any form whose real update
  // endpoint differs from the base endpoint (e.g. `/api/users/:id/profile`, or a Phase-24
  // named-operation override like `/api/users/:id/change-password`) silently submitted to the
  // wrong URL in exported code. The live Preview path (bindingMutationRuntime.ts) already did
  // this correctly (`plan.updateEndpoint ?? plan.endpoint`) — Export just didn't match it.
  const updateUrlExpr = resolveRegionDmlUrlExpression(dataVar, plan.updateEndpoint || plan.endpoint, plan.primaryKey);
  return `(${pkExpression} != null && String(${pkExpression}).length > 0 ? ${updateUrlExpr} : ${createUrl})`;
};

export const collectRegionFormFieldMappings = (
  document: DesignerDocument,
  regionNodeId: string,
  bindingDefinitions: DesignerBindingDefinitions,
): RegionFormFieldMapping[] => {
  const plan = collectDocumentRegionPlan(document, bindingDefinitions);
  const mappings = plan.regionColumnBindings
    .filter((binding) => binding.regionNodeId === regionNodeId)
    .map((binding) => {
      const node = document.nodes[binding.nodeId];
      return {
        nodeId: binding.nodeId,
        column: binding.column,
        formFieldName: resolveRegionFormFieldName(binding.nodeId),
        payloadTransform: binding.definition.payloadTransform
          ?? (node ? resolveDefaultRegionFieldTransform(node) : undefined),
      };
    });

  for (const node of Object.values(document.nodes)) {
    const paletteItemId = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
    if (paletteItemId !== BASE_INFO_RECORD_FORM_PALETTE_ID) {
      continue;
    }

    const ancestor = findAncestorDataRegion(document, node.id);
    if (!ancestor || ancestor.regionNode.id !== regionNodeId) {
      continue;
    }

    for (const column of BASE_INFO_RECORD_FORM_COLUMNS) {
      mappings.push({
        nodeId: node.id,
        column: column.column,
        formFieldName: baseInfoRecordHiddenFieldName(node.id, column.column),
        payloadTransform: column.payloadTransform,
      });
    }
  }

  return mappings;
};

export const resolveRegionDmlMethodExpression = (
  dataVar: string,
  primaryKey?: string,
  updateMethod?: string,
): string => {
  if (!primaryKey?.trim()) {
    return "'POST'";
  }

  const pkExpression = regionColumnToExpression(dataVar, primaryKey.trim());
  // Bug found live-testing CRM 3d: this was hardcoded to 'PUT', so any region whose real update
  // endpoint is registered as PATCH (or a POST-only named action reused as the "update" op, e.g.
  // Tickets Assign/Reply) 404'd in the browser despite passing direct-API tests. Now uses the
  // data source's own declared `operations.update.method`, defaulting to 'PUT' when unset (matches
  // prior behavior for data sources that never specified one).
  const method = JSON.stringify(updateMethod?.trim() || 'PUT');
  return `${pkExpression} != null && String(${pkExpression}).length > 0 ? ${method} : 'POST'`;
};

export const resolveRegionSubmitPlanForEvent = (
  document: DesignerDocument,
  nodeId: string,
  bindingDefinitions: DesignerBindingDefinitions,
): ResolvedRegionSubmitPlan | null => {
  const regionContext = resolveDataRegionForSubmit(document, nodeId);
  if (!regionContext) {
    return null;
  }

  const dataSource = getDataSources(bindingDefinitions)[regionContext.dataSourceRef];
  const endpoint = dataSource?.endpoint?.trim();
  if (!dataSource || !endpoint) {
    return null;
  }

  const fieldMappings = collectRegionFormFieldMappings(
    document,
    regionContext.regionNode.id,
    bindingDefinitions,
  );

  const regionsPerDataSource = Object.values(document.nodes).filter((candidate) =>
    isDataRegionEligibleContainer(candidate)
    && getNodeRegionDataSourceRef(candidate) === regionContext.dataSourceRef,
  ).length;

  const submitEndpoints = resolveRegionSubmitEndpoints(dataSource);

  return {
    regionNodeId: regionContext.regionNode.id,
    dataSourceId: regionContext.dataSourceRef,
    dataSource,
    dataVar: resolveRegionDataVarName(regionContext.dataSourceRef, regionContext.regionNode.id, regionsPerDataSource),
    endpoint: submitEndpoints.base,
    createEndpoint: submitEndpoints.create,
    updateEndpoint: submitEndpoints.update,
    updateMethod: dataSource.operations?.update?.method,
    primaryKey: dataSource.primaryKey,
    fieldMappings,
  };
};

export const resolveRegionColumnFields = (
  document: DesignerDocument,
  nodeId: string,
  bindingDefinitions: DesignerBindingDefinitions,
): string[] => {
  const ancestor = findAncestorDataRegion(document, nodeId);
  if (!ancestor) {
    return [];
  }

  const dataSource = getDataSources(bindingDefinitions)[ancestor.dataSourceRef];
  return dataSource?.fields ?? [];
};
