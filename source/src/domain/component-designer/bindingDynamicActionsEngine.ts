import { createFetchConfigKey } from './bindingApiHelpers';
import { getDataSources } from './bindingRegistry';
import { isCallMutationOperationFailure, resolveCallMutationOperation } from './bindingResourceModel';
import { resolveOutlinePrimaryLabel } from './outlineNodeDisplay';
import { resolveRegionDataVarName } from './bindingRegionEngine';
import { resolveStorePathExpression } from './bindingStoreEngine';
import { compileDesignerConditionExpression } from './visibilityConditionEngine';
import type {
  DesignerApiOperationMethod,
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerDynamicAction,
  DesignerDynamicActionType,
  DesignerNode,
  DesignerToastVariant,
} from './types';
import type { DesignerExportDataSource, DesignerExportFormat } from './designerDataExport';
import {
  buildWorkflowStartEndpoint,
  isValidWorkflowDefinitionId,
  normalizeWorkflowDefinitionId,
  sanitizeWorkflowPayloadMapping,
} from './triggerWorkflowAction';

export const DESIGNER_TOAST_VARIANTS: readonly DesignerToastVariant[] = [
  'default',
  'accent',
  'success',
  'warning',
  'danger',
] as const;

export type ResolvedDynamicAction =
  | {
    id: string;
    type: 'refreshDataSource';
    dataSourceRef: string;
    refreshVar: string;
  }
  | {
    id: string;
    type: 'setValue';
    targetNodeId: string;
    storePath: string;
    valueSource: 'static' | 'expression';
    staticValue?: string;
    valueExpression?: string;
  }
  | {
    id: string;
    type: 'showHide';
    targetNodeId: string;
    visibilityStorePath: string;
    showHideEffect: 'show' | 'hide' | 'toggle';
  }
  | {
    id: string;
    type: 'showToast';
    toastTitle: string;
    toastDescription?: string;
    toastVariant?: DesignerToastVariant;
    toastDuration?: number;
  }
  | {
    id: string;
    type: 'callMutation';
    dataSourceRef: string;
    mutationOperation: string;
    method: DesignerApiOperationMethod;
    endpoint: string;
    mutationRecordIdStorePath?: string;
    mutationBody?: Record<string, unknown>;
  }
  | {
    id: string;
    type: 'resetForm';
    targetNodeId: string;
  }
  | {
    id: string;
    type: 'navigate';
    navigateTarget: string;
    navigateReplace: boolean;
  }
  | {
    id: string;
    type: 'updateFilterFromClick';
    filterStorePath: string;
    filterValueSource: 'clickCategory' | 'clickSeriesKey' | 'expression';
    filterValueExpression?: string;
  }
  | {
    id: string;
    type: 'exportData';
    exportFormat: DesignerExportFormat;
    exportSource: DesignerExportDataSource;
    exportFilename?: string;
  }
  | {
    id: string;
    type: 'triggerWorkflow';
    workflowDefinitionId: string;
    endpoint: string;
    payloadMapping?: Record<string, string>;
  };

export type DynamicActionDataSourceFetch = {
  dataSourceId: string;
  dataVar: string;
  refreshVar: string;
  endpoint: string;
  configKey: string;
};

const DYNAMIC_ACTION_VISIBILITY_STORE_PREFIX = 'ui.visibility.';
const DYNAMIC_ACTION_SET_VALUE_STORE_PREFIX = 'dynamic.';

export const visibilityStorePathForNode = (nodeId: string): string =>
  `${DYNAMIC_ACTION_VISIBILITY_STORE_PREFIX}${nodeId.trim()}`;

export const visibilityConditionForNode = (nodeId: string): string =>
  `store.${visibilityStorePathForNode(nodeId)} !== false`;

export const defaultSetValueStorePathForNode = (nodeId: string): string =>
  `${DYNAMIC_ACTION_SET_VALUE_STORE_PREFIX}${nodeId.trim()}`;

const createDynamicActionId = (): string =>
  `da_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const createDynamicAction = (
  type: DesignerDynamicActionType,
): DesignerDynamicAction => ({
  id: createDynamicActionId(),
  type,
  valueSource: type === 'setValue' ? 'static' : undefined,
  showHideEffect: type === 'showHide' ? 'show' : undefined,
  toastTitle: type === 'showToast' ? 'Saved' : undefined,
  toastVariant: type === 'showToast' ? 'success' : undefined,
  toastDuration: type === 'showToast' ? 4000 : undefined,
  mutationOperation: type === 'callMutation' ? 'delete' : undefined,
  navigateTarget: type === 'navigate' ? '/' : undefined,
  navigateReplace: type === 'navigate' ? false : undefined,
  filterStorePath: type === 'updateFilterFromClick' ? 'dashboardFilters.category' : undefined,
  filterValueSource: type === 'updateFilterFromClick' ? 'clickCategory' : undefined,
  exportFormat: type === 'exportData' ? 'csv' : undefined,
  exportSource: type === 'exportData' ? 'gridListResource' : undefined,
  exportFilename: type === 'exportData' ? 'export' : undefined,
  workflowDefinitionId: type === 'triggerWorkflow' ? '' : undefined,
  payloadMapping: type === 'triggerWorkflow' ? {} : undefined,
});

const isToastVariant = (value: unknown): value is DesignerToastVariant =>
  typeof value === 'string' && (DESIGNER_TOAST_VARIANTS as readonly string[]).includes(value);

const sanitizeDynamicAction = (value: unknown): DesignerDynamicAction | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = record.type;
  if (
    type !== 'refreshDataSource'
    && type !== 'setValue'
    && type !== 'showHide'
    && type !== 'showToast'
    && type !== 'callMutation'
    && type !== 'resetForm'
    && type !== 'navigate'
    && type !== 'updateFilterFromClick'
    && type !== 'exportData'
    && type !== 'triggerWorkflow'
  ) {
    return null;
  }

  const id = typeof record.id === 'string' && record.id.trim().length > 0
    ? record.id.trim()
    : createDynamicActionId();

  const action: DesignerDynamicAction = { id, type };

  if (typeof record.dataSourceRef === 'string' && record.dataSourceRef.trim().length > 0) {
    action.dataSourceRef = record.dataSourceRef.trim();
  }

  if (typeof record.targetNodeId === 'string' && record.targetNodeId.trim().length > 0) {
    action.targetNodeId = record.targetNodeId.trim();
  }

  if (typeof record.storePath === 'string' && record.storePath.trim().length > 0) {
    action.storePath = record.storePath.trim();
  }

  if (record.valueSource === 'static' || record.valueSource === 'expression') {
    action.valueSource = record.valueSource;
  }

  if (typeof record.staticValue === 'string') {
    action.staticValue = record.staticValue;
  }

  if (typeof record.valueExpression === 'string') {
    action.valueExpression = record.valueExpression;
  }

  if (record.showHideEffect === 'show' || record.showHideEffect === 'hide' || record.showHideEffect === 'toggle') {
    action.showHideEffect = record.showHideEffect;
  }

  if (typeof record.toastTitle === 'string') {
    action.toastTitle = record.toastTitle;
  }

  if (typeof record.toastDescription === 'string') {
    action.toastDescription = record.toastDescription;
  }

  if (isToastVariant(record.toastVariant)) {
    action.toastVariant = record.toastVariant;
  }

  if (typeof record.toastDuration === 'number' && Number.isFinite(record.toastDuration) && record.toastDuration >= 0) {
    action.toastDuration = record.toastDuration;
  }

  if (typeof record.mutationOperation === 'string' && record.mutationOperation.trim().length > 0) {
    action.mutationOperation = record.mutationOperation.trim();
  }

  if (typeof record.mutationRecordIdStorePath === 'string' && record.mutationRecordIdStorePath.trim().length > 0) {
    action.mutationRecordIdStorePath = record.mutationRecordIdStorePath.trim();
  }

  if (record.mutationBody && typeof record.mutationBody === 'object' && !Array.isArray(record.mutationBody)) {
    action.mutationBody = { ...(record.mutationBody as Record<string, unknown>) };
  }

  if (typeof record.navigateTarget === 'string') {
    action.navigateTarget = record.navigateTarget;
  }

  if (typeof record.navigateReplace === 'boolean') {
    action.navigateReplace = record.navigateReplace;
  }

  if (typeof record.filterStorePath === 'string' && record.filterStorePath.trim().length > 0) {
    action.filterStorePath = record.filterStorePath.trim();
  }

  if (
    record.filterValueSource === 'clickCategory'
    || record.filterValueSource === 'clickSeriesKey'
    || record.filterValueSource === 'expression'
  ) {
    action.filterValueSource = record.filterValueSource;
  }

  if (typeof record.filterValueExpression === 'string') {
    action.filterValueExpression = record.filterValueExpression;
  }

  if (record.exportFormat === 'csv' || record.exportFormat === 'xlsx' || record.exportFormat === 'pdf') {
    action.exportFormat = record.exportFormat;
  }

  if (record.exportSource === 'gridListResource' || record.exportSource === 'chartDataResource') {
    action.exportSource = record.exportSource;
  }

  if (typeof record.exportFilename === 'string' && record.exportFilename.trim().length > 0) {
    action.exportFilename = record.exportFilename.trim();
  }

  const workflowDefinitionId = normalizeWorkflowDefinitionId(record.workflowDefinitionId);
  if (workflowDefinitionId) {
    action.workflowDefinitionId = workflowDefinitionId;
  }

  const payloadMapping = sanitizeWorkflowPayloadMapping(record.payloadMapping);
  if (payloadMapping) {
    action.payloadMapping = payloadMapping;
  }

  return action;
};

export const sanitizeTrueActions = (value: unknown): DesignerDynamicAction[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => sanitizeDynamicAction(entry))
    .filter((entry): entry is DesignerDynamicAction => entry !== null);
};

export const hasTrueActions = (definition: DesignerBindingDefinition | undefined): boolean =>
  sanitizeTrueActions(definition?.trueActions).length > 0;

export const createDynamicActionsEventBindingDefinition = (
  targetEvent: string,
  trueActions: DesignerDynamicAction[],
): DesignerBindingDefinition => ({
  sourceType: 'static',
  bindingRole: 'event',
  targetEvent,
  trueActions,
});

const resolveDataSourceRefreshVar = (dataSourceRef: string): string =>
  `refresh_${resolveRegionDataVarName(dataSourceRef)}`;

/**
 * Maps dataSourceId → refresh_<dataVar> for every already-declared Region/Grid/Chart/Viz/Repeater
 * fetch. Used so a `refreshDataSource` Dynamic Action reuses the live fetch instead of minting a
 * disconnected phantom `refresh_regionData_<id>` hook.
 *
 * Registration prefers list widgets (grid/chart/viz/repeater) over Region form fetches so that
 * List+Create pages (form Region + table Grid on the same dataSource) refresh the visible list
 * after save — not only the form's regionData_* fetch.
 */
export const buildExistingDataSourceRefreshVarMap = (plans: {
  regionFetches?: ReadonlyArray<{ dataSourceId: string; dataVar: string }>;
  gridListFetches?: ReadonlyArray<{ dataSourceId: string; dataVar: string }>;
  chartListFetches?: ReadonlyArray<{ dataSourceId: string; dataVar: string }>;
  vizListFetches?: ReadonlyArray<{ dataSourceId: string; dataVar: string }>;
  repeaterListFetches?: ReadonlyArray<{ dataSourceId: string; dataVar: string }>;
}): Map<string, string> => {
  const refreshVarByDataSourceId = new Map<string, string>();
  const register = (dataSourceId: string, dataVar: string) => {
    const trimmed = dataSourceId.trim();
    if (!trimmed || refreshVarByDataSourceId.has(trimmed)) {
      return;
    }
    refreshVarByDataSourceId.set(trimmed, `refresh_${dataVar}`);
  };

  // Prefer visible list widgets (grid/chart/viz/repeater) over Region form fetches when both
  // share a dataSourceId. List+Create pages bind the Create form as a Region AND the table as a
  // Grid to the same source — "refresh after save" must refresh the visible list, not only the
  // form's regionData_* fetch (which would leave the grid stale). Region remains the fallback
  // when no list widget is bound to that source.
  for (const entry of plans.gridListFetches ?? []) {
    register(entry.dataSourceId, entry.dataVar);
  }
  for (const entry of plans.chartListFetches ?? []) {
    register(entry.dataSourceId, entry.dataVar);
  }
  for (const entry of plans.vizListFetches ?? []) {
    register(entry.dataSourceId, entry.dataVar);
  }
  for (const entry of plans.repeaterListFetches ?? []) {
    register(entry.dataSourceId, entry.dataVar);
  }
  for (const entry of plans.regionFetches ?? []) {
    register(entry.dataSourceId, entry.dataVar);
  }

  return refreshVarByDataSourceId;
};

const resolveDynamicActionDataSourceFetch = (
  dataSourceRef: string,
  bindingDefinitions: DesignerBindingDefinitions,
  existingRefreshVarByDataSourceId?: ReadonlyMap<string, string>,
): DynamicActionDataSourceFetch | null => {
  const trimmedRef = dataSourceRef.trim();
  const dataSource = getDataSources(bindingDefinitions)[trimmedRef];
  const endpoint = dataSource?.endpoint?.trim();
  if (!dataSource || !endpoint) {
    return null;
  }

  const existingRefreshVar = existingRefreshVarByDataSourceId?.get(trimmedRef);
  if (existingRefreshVar) {
    // Reuse the live fetch's refresh var — dataVar is only used if a phantom hook is declared,
    // which callers skip when the data source is already covered.
    return {
      dataSourceId: trimmedRef,
      dataVar: existingRefreshVar.replace(/^refresh_/, ''),
      refreshVar: existingRefreshVar,
      endpoint,
      configKey: createFetchConfigKey(endpoint, {}, {}),
    };
  }

  const dataVar = resolveRegionDataVarName(dataSourceRef);
  return {
    dataSourceId: trimmedRef,
    dataVar,
    refreshVar: resolveDataSourceRefreshVar(dataSourceRef),
    endpoint,
    configKey: createFetchConfigKey(endpoint, {}, {}),
  };
};

export const collectDynamicActionDataSourceFetches = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  existingRefreshVarByDataSourceId?: ReadonlyMap<string, string>,
): DynamicActionDataSourceFetch[] => {
  const fetchMap = new Map<string, DynamicActionDataSourceFetch>();

  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding)) {
      if (!definition) {
        continue;
      }

      for (const action of sanitizeTrueActions(definition.trueActions)) {
        if (action.type !== 'refreshDataSource' || !action.dataSourceRef) {
          continue;
        }

        const trimmedRef = action.dataSourceRef.trim();
        // Skip data sources that already have a real Region/Grid/Chart/Viz/Repeater fetch —
        // those get refreshed via the existing refreshVar, not a phantom hook.
        if (existingRefreshVarByDataSourceId?.has(trimmedRef)) {
          continue;
        }

        const resolved = resolveDynamicActionDataSourceFetch(
          action.dataSourceRef,
          bindingDefinitions,
          existingRefreshVarByDataSourceId,
        );
        if (resolved) {
          fetchMap.set(resolved.dataSourceId, resolved);
        }
      }
    }
  }

  return Array.from(fetchMap.values());
};

export const documentUsesDynamicActions = (document: DesignerDocument): boolean => {
  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding)) {
      if (definition && hasTrueActions(definition)) {
        return true;
      }
    }
  }

  return false;
};

export const documentUsesDynamicActionStore = (document: DesignerDocument): boolean => {
  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding)) {
      for (const action of sanitizeTrueActions(definition?.trueActions)) {
        if (action.type === 'setValue' || action.type === 'showHide') {
          return true;
        }
      }
    }
  }

  return false;
};

export const compileDynamicActionValueExpression = (expression: string): string => {
  let compiled = expression.trim();
  if (compiled.length === 0) {
    return 'null';
  }

  compiled = compileDesignerConditionExpression(compiled);
  compiled = compiled.replace(/\bevent\.target\.value\b/g, '(event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.value ?? \'\'');
  compiled = compiled.replace(/\bvalue\b/g, '(event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.value ?? \'\'');
  return compiled;
};

export const resolveDynamicActions = (
  definition: DesignerBindingDefinition,
  bindingDefinitions: DesignerBindingDefinitions,
  existingRefreshVarByDataSourceId?: ReadonlyMap<string, string>,
): ResolvedDynamicAction[] => {
  const resolved: ResolvedDynamicAction[] = [];

  for (const action of sanitizeTrueActions(definition.trueActions)) {
    if (action.type === 'refreshDataSource' && action.dataSourceRef) {
      const fetch = resolveDynamicActionDataSourceFetch(
        action.dataSourceRef,
        bindingDefinitions,
        existingRefreshVarByDataSourceId,
      );
      if (!fetch) {
        continue;
      }

      resolved.push({
        id: action.id,
        type: 'refreshDataSource',
        dataSourceRef: action.dataSourceRef,
        refreshVar: fetch.refreshVar,
      });
      continue;
    }

    if (action.type === 'setValue' && action.targetNodeId) {
      resolved.push({
        id: action.id,
        type: 'setValue',
        targetNodeId: action.targetNodeId,
        storePath: action.storePath?.trim() || defaultSetValueStorePathForNode(action.targetNodeId),
        valueSource: action.valueSource === 'expression' ? 'expression' : 'static',
        staticValue: action.staticValue,
        valueExpression: action.valueExpression,
      });
      continue;
    }

    if (action.type === 'showHide' && action.targetNodeId) {
      resolved.push({
        id: action.id,
        type: 'showHide',
        targetNodeId: action.targetNodeId,
        visibilityStorePath: visibilityStorePathForNode(action.targetNodeId),
        showHideEffect: action.showHideEffect ?? 'show',
      });
      continue;
    }

    if (action.type === 'showToast') {
      const toastTitle = action.toastTitle?.trim() || 'Notification';
      resolved.push({
        id: action.id,
        type: 'showToast',
        toastTitle,
        toastDescription: action.toastDescription?.trim() || undefined,
        toastVariant: action.toastVariant,
        toastDuration: action.toastDuration,
      });
      continue;
    }

    if (action.type === 'callMutation' && action.dataSourceRef) {
      const dataSource = getDataSources(bindingDefinitions)[action.dataSourceRef.trim()];
      const mutation = resolveCallMutationOperation(dataSource, action.mutationOperation);
      if (isCallMutationOperationFailure(mutation)) {
        // Keep a failing placeholder so chained success toast/refresh never run as a false positive.
        resolved.push({
          id: action.id,
          type: 'callMutation',
          dataSourceRef: action.dataSourceRef.trim(),
          mutationOperation: mutation.operationKey,
          method: 'DELETE',
          endpoint: '',
          mutationRecordIdStorePath: action.mutationRecordIdStorePath?.trim() || undefined,
          mutationBody: action.mutationBody ? { ...action.mutationBody } : undefined,
        });
        continue;
      }

      resolved.push({
        id: action.id,
        type: 'callMutation',
        dataSourceRef: action.dataSourceRef.trim(),
        mutationOperation: mutation.operationKey,
        method: mutation.operation.method,
        endpoint: mutation.operation.endpoint.trim(),
        mutationRecordIdStorePath: action.mutationRecordIdStorePath?.trim() || undefined,
        mutationBody: action.mutationBody ? { ...action.mutationBody } : undefined,
      });
      continue;
    }

    if (action.type === 'resetForm' && action.targetNodeId) {
      resolved.push({
        id: action.id,
        type: 'resetForm',
        targetNodeId: action.targetNodeId,
      });
      continue;
    }

    if (action.type === 'navigate') {
      const navigateTarget = action.navigateTarget?.trim() ?? '';
      if (!navigateTarget) {
        continue;
      }
      resolved.push({
        id: action.id,
        type: 'navigate',
        navigateTarget,
        navigateReplace: action.navigateReplace === true,
      });
      continue;
    }

    if (action.type === 'updateFilterFromClick') {
      const filterStorePath = action.filterStorePath?.trim() ?? '';
      if (!filterStorePath) {
        continue;
      }
      resolved.push({
        id: action.id,
        type: 'updateFilterFromClick',
        filterStorePath,
        filterValueSource: action.filterValueSource === 'clickSeriesKey'
          ? 'clickSeriesKey'
          : action.filterValueSource === 'expression'
            ? 'expression'
            : 'clickCategory',
        filterValueExpression: action.filterValueExpression?.trim() || undefined,
      });
      continue;
    }

    if (action.type === 'exportData') {
      const exportFormat = action.exportFormat === 'xlsx' || action.exportFormat === 'pdf'
        ? action.exportFormat
        : 'csv';
      const exportSource = action.exportSource === 'chartDataResource'
        ? 'chartDataResource'
        : 'gridListResource';
      resolved.push({
        id: action.id,
        type: 'exportData',
        exportFormat,
        exportSource,
        exportFilename: action.exportFilename?.trim() || undefined,
      });
      continue;
    }

    if (action.type === 'triggerWorkflow') {
      const workflowDefinitionId = normalizeWorkflowDefinitionId(action.workflowDefinitionId);
      if (!workflowDefinitionId || !isValidWorkflowDefinitionId(workflowDefinitionId)) {
        continue;
      }
      resolved.push({
        id: action.id,
        type: 'triggerWorkflow',
        workflowDefinitionId,
        endpoint: buildWorkflowStartEndpoint(workflowDefinitionId),
        payloadMapping: sanitizeWorkflowPayloadMapping(action.payloadMapping),
      });
    }
  }

  return resolved;
};

/** Substitutes a raw record id into an operation endpoint's `:param` token (or appends it) at runtime. */
export const resolveMutationRuntimeUrl = (endpointTemplate: string, recordId: unknown): string => {
  const trimmed = endpointTemplate.trim();
  if (recordId === undefined || recordId === null || String(recordId).length === 0) {
    return trimmed;
  }

  const idText = encodeURIComponent(String(recordId));
  if (/:[a-zA-Z_][a-zA-Z0-9_]*/.test(trimmed)) {
    return trimmed.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/, idText);
  }

  return `${trimmed.replace(/\/+$/, '')}/${idText}`;
};

/** Codegen counterpart of {@link resolveMutationRuntimeUrl} — emits a JS expression string. */
export const resolveMutationUrlExpressionForCodegen = (
  endpointTemplate: string,
  recordIdExpression: string | null,
): string => {
  const trimmed = endpointTemplate.trim();
  if (!recordIdExpression) {
    return JSON.stringify(trimmed);
  }

  const pathParamMatch = trimmed.match(/:[a-zA-Z_][a-zA-Z0-9_]*/);
  if (pathParamMatch) {
    const prefix = trimmed.slice(0, pathParamMatch.index);
    const suffix = trimmed.slice((pathParamMatch.index ?? 0) + pathParamMatch[0].length);
    return `(${JSON.stringify(prefix)} + encodeURIComponent(String(${recordIdExpression})) + ${JSON.stringify(suffix)})`;
  }

  const base = trimmed.replace(/\/+$/, '');
  return `(${JSON.stringify(base)} + '/' + encodeURIComponent(String(${recordIdExpression})))`;
};

export const documentUsesCallMutationAction = (document: DesignerDocument): boolean => {
  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding)) {
      for (const action of sanitizeTrueActions(definition?.trueActions)) {
        if (action.type === 'callMutation') {
          return true;
        }
      }
    }
  }

  return false;
};

export const documentUsesShowToastAction = (document: DesignerDocument): boolean => {
  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding)) {
      for (const action of sanitizeTrueActions(definition?.trueActions)) {
        if (action.type === 'showToast') {
          return true;
        }
      }
    }
  }

  return false;
};

export const documentUsesNavigateAction = (document: DesignerDocument): boolean => {
  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding)) {
      for (const action of sanitizeTrueActions(definition?.trueActions)) {
        if (action.type === 'navigate') {
          return true;
        }
      }
    }
  }

  return false;
};

export const documentUsesExportDataAction = (document: DesignerDocument): boolean => {
  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding)) {
      for (const action of sanitizeTrueActions(definition?.trueActions)) {
        if (action.type === 'exportData') {
          return true;
        }
      }
    }
  }

  return false;
};

export const documentUsesTriggerWorkflowAction = (document: DesignerDocument): boolean => {
  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding)) {
      for (const action of sanitizeTrueActions(definition?.trueActions)) {
        if (action.type === 'triggerWorkflow') {
          return true;
        }
      }
    }
  }

  return false;
};

/** True when any navigate action template references `{store.x}` / `{selection.id}` placeholders. */
export const documentUsesNavigateStorePlaceholders = (document: DesignerDocument): boolean => {
  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding)) {
      for (const action of sanitizeTrueActions(definition?.trueActions)) {
        if (action.type === 'navigate' && /\{[a-zA-Z0-9_.]+\}/.test(action.navigateTarget ?? '')) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Normalizes a `{selection.id}` / `{store.selection.id}` / `{item.x}` placeholder path to a
 * designerStore dot-path (strips optional `store.` / `item.` prefixes).
 */
export const normalizeNavigatePlaceholderPath = (rawPath: string): string => {
  let path = rawPath.trim();
  if (path.startsWith('store.')) {
    path = path.slice('store.'.length);
  } else if (path.startsWith('item.')) {
    path = path.slice('item.'.length);
  }
  return path;
};

const readNestedStoreValueForNavigate = (store: Record<string, unknown>, path: string): unknown => {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  let cursor: unknown = store;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
};

/**
 * Runtime counterpart of {@link resolveNavigateTargetExpressionForCodegen} — substitutes
 * `{store.x}` / `{selection.id}` placeholders from designerStore into a path template.
 */
export const resolveNavigateTargetTemplate = (
  template: string,
  designerStore: Record<string, unknown>,
): string =>
  template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_match, rawPath: string) => {
    const path = normalizeNavigatePlaceholderPath(rawPath);
    if (!path) {
      return '';
    }
    const value = readNestedStoreValueForNavigate(designerStore, path);
    if (value === undefined || value === null) {
      return '';
    }
    return encodeURIComponent(String(value));
  });

/** Runtime resolver for `{store.path}` placeholders in mutation JSON bodies (no URL encoding). */
export const resolveStoreTemplateValue = (
  template: string,
  designerStore: Record<string, unknown>,
): string =>
  template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_match, rawPath: string) => {
    const path = normalizeNavigatePlaceholderPath(rawPath);
    if (!path) {
      return '';
    }
    const value = readNestedStoreValueForNavigate(designerStore, path);
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });

export const resolveStoreTemplateRecord = (
  body: Record<string, unknown>,
  designerStore: Record<string, unknown>,
): Record<string, unknown> => {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    resolved[key] = typeof value === 'string'
      ? resolveStoreTemplateValue(value, designerStore)
      : value;
  }
  return resolved;
};

/** Codegen counterpart of {@link resolveNavigateTargetTemplate} — emits a JS expression string. */
export const resolveNavigateTargetExpressionForCodegen = (
  template: string,
  responseExpression?: string,
): string => {
  const parts: string[] = [];
  const regex = /\{([a-zA-Z0-9_.]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let hasPlaceholder = false;

  while ((match = regex.exec(template)) !== null) {
    hasPlaceholder = true;
    if (match.index > lastIndex) {
      parts.push(JSON.stringify(template.slice(lastIndex, match.index)));
    }
    const rawPath = match[1] ?? '';
    const isResponsePath = Boolean(responseExpression) && rawPath.startsWith('response.');
    const storePath = isResponsePath
      ? rawPath.slice('response.'.length)
      : normalizeNavigatePlaceholderPath(rawPath);
    const valueExpression = storePath
      ? resolveStorePathExpression(storePath, isResponsePath ? responseExpression : undefined)
      : 'undefined';
    parts.push(`encodeURIComponent(String(${valueExpression} ?? ''))`);
    lastIndex = match.index + match[0].length;
  }

  if (!hasPlaceholder) {
    return JSON.stringify(template);
  }

  if (lastIndex < template.length) {
    parts.push(JSON.stringify(template.slice(lastIndex)));
  }

  if (parts.length === 0) {
    return '""';
  }
  if (parts.length === 1) {
    return parts[0]!;
  }
  return `(${parts.join(' + ')})`;
};

/** Codegen counterpart of {@link resolveStoreTemplateValue} — emits a JS expression string. */
export const resolveStoreTemplateExpressionForCodegen = (
  template: string,
  responseExpression?: string,
): string => {
  const parts: string[] = [];
  const regex = /\{([a-zA-Z0-9_.]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let hasPlaceholder = false;

  while ((match = regex.exec(template)) !== null) {
    hasPlaceholder = true;
    if (match.index > lastIndex) {
      parts.push(JSON.stringify(template.slice(lastIndex, match.index)));
    }
    const rawPath = match[1] ?? '';
    const isResponsePath = Boolean(responseExpression) && rawPath.startsWith('response.');
    const storePath = isResponsePath
      ? rawPath.slice('response.'.length)
      : normalizeNavigatePlaceholderPath(rawPath);
    const valueExpression = storePath
      ? resolveStorePathExpression(storePath, isResponsePath ? responseExpression : undefined)
      : 'undefined';
    parts.push(`String(${valueExpression} ?? '')`);
    lastIndex = match.index + match[0].length;
  }

  if (!hasPlaceholder) {
    return JSON.stringify(template);
  }

  if (lastIndex < template.length) {
    parts.push(JSON.stringify(template.slice(lastIndex)));
  }

  if (parts.length === 0) {
    return '""';
  }
  if (parts.length === 1) {
    return parts[0]!;
  }
  return `(${parts.join(' + ')})`;
};

export const resolveMutationBodyExpressionForCodegen = (
  body: Record<string, unknown>,
  responseExpression?: string,
): string => {
  const entries = Object.entries(body ?? {});
  if (entries.length === 0) {
    return '{}';
  }
  const parts = entries.map(([key, value]) => {
    if (typeof value === 'string' && /\{[a-zA-Z0-9_.]+\}/.test(value)) {
      return `${JSON.stringify(key)}: ${resolveStoreTemplateExpressionForCodegen(value, responseExpression)}`;
    }
    return `${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  });
  return `{ ${parts.join(', ')} }`;
};

export const listDocumentNodeOptions = (
  document: DesignerDocument,
): Array<{ id: string; label: string }> =>
  Object.values(document.nodes).map((node) => ({
    id: node.id,
    label: resolveNodeInspectorLabel(node),
  }));

const resolveNodeInspectorLabel = (node: DesignerNode): string =>
  resolveOutlinePrimaryLabel(node);
