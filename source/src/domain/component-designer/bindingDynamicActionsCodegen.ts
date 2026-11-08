import {
  collectDynamicActionDataSourceFetches,
  buildExistingDataSourceRefreshVarMap,
  defaultSetValueStorePathForNode,
  sanitizeTrueActions,
  visibilityConditionForNode,
  visibilityStorePathForNode,
} from './bindingDynamicActionsEngine';
import { collectDocumentBindingPlan } from './bindingEngine';
import { resolveStorePathExpression } from './bindingStoreEngine';
import { readNodeVisibleCondition } from './visibilityConditionEngine';
import type { DesignerBindingDefinitions, DesignerDocument, DesignerNode } from './types';

export type PreviewDataSourceHydrationTarget = {
  dataSourceId: string;
  dataVar: string;
  endpoint: string;
  urlParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  responseMapping?: import('./types').DesignerResponseMapping;
  /** Region/detail hydration expects a single record; grids expect row arrays. */
  resultShape?: 'record' | 'rows';
  pollingIntervalMs?: number;
  /** Phase 55 — push binding (SSE / WebSocket); independent of polling. */
  liveMode?: import('./types').DesignerLiveMode;
};

export const collectDynamicActionShowHideTargetNodeIds = (document: DesignerDocument): Set<string> => {
  const targetNodeIds = new Set<string>();

  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding)) {
      for (const action of sanitizeTrueActions(definition?.trueActions)) {
        if (action.type === 'showHide' && action.targetNodeId) {
          targetNodeIds.add(action.targetNodeId);
        }
      }
    }
  }

  return targetNodeIds;
};

export const collectDynamicActionSetValueStorePaths = (document: DesignerDocument): Map<string, string> => {
  const storePathsByNodeId = new Map<string, string>();

  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding)) {
      for (const action of sanitizeTrueActions(definition?.trueActions)) {
        if (action.type !== 'setValue' || !action.targetNodeId) {
          continue;
        }

        storePathsByNodeId.set(
          action.targetNodeId,
          action.storePath?.trim() || defaultSetValueStorePathForNode(action.targetNodeId),
        );
      }
    }
  }

  return storePathsByNodeId;
};

export const resolveCombinedNodeVisibilityCondition = (
  node: DesignerNode,
  showHideTargetNodeIds: Set<string>,
  gridDetailModalNodeIds: Set<string> = new Set(),
): string => {
  const manualCondition = readNodeVisibleCondition(node);
  const usesDynamicVisibility = showHideTargetNodeIds.has(node.id);
  const dynamicCondition = usesDynamicVisibility ? visibilityConditionForNode(node.id) : '';
  const gridDetailCondition = gridDetailModalNodeIds.has(node.id)
    ? `store.${visibilityStorePathForNode(node.id)} === true`
    : '';

  const conditions = [manualCondition, dynamicCondition, gridDetailCondition].filter((entry) => entry.length > 0);
  if (conditions.length === 0) {
    return '';
  }

  if (conditions.length === 1) {
    return conditions[0]!;
  }

  return conditions.map((entry) => `(${entry})`).join(' && ');
};

/** Dynamic show/hide + grid-detail visibility without manual/access conditions. */
export const resolveBindingOnlyVisibilityCondition = (
  node: DesignerNode,
  showHideTargetNodeIds: Set<string>,
  gridDetailModalNodeIds: Set<string> = new Set(),
): string => {
  const usesDynamicVisibility = showHideTargetNodeIds.has(node.id);
  const dynamicCondition = usesDynamicVisibility ? visibilityConditionForNode(node.id) : '';
  const gridDetailCondition = gridDetailModalNodeIds.has(node.id)
    ? `store.${visibilityStorePathForNode(node.id)} === true`
    : '';

  const conditions = [dynamicCondition, gridDetailCondition].filter((entry) => entry.length > 0);
  if (conditions.length === 0) {
    return '';
  }

  if (conditions.length === 1) {
    return conditions[0]!;
  }

  return conditions.map((entry) => `(${entry})`).join(' && ');
};

export const documentUsesDynamicActionVisibility = (document: DesignerDocument): boolean =>
  collectDynamicActionShowHideTargetNodeIds(document).size > 0;

export const resolveDynamicSetValueBindingExpression = (
  nodeId: string,
  targetProp: string,
  baseExpression: string | null,
  setValueStorePathsByNodeId: Map<string, string>,
): string | null => {
  if (targetProp !== 'value') {
    return baseExpression;
  }

  const storePath = setValueStorePathsByNodeId.get(nodeId);
  if (!storePath) {
    return baseExpression;
  }

  const dynamicExpression = resolveStorePathExpression(storePath);
  if (!baseExpression) {
    return dynamicExpression;
  }

  return `(${dynamicExpression} ?? ${baseExpression})`;
};

export const collectPreviewDataSourceHydrationTargets = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): PreviewDataSourceHydrationTarget[] => {
  const targets = new Map<string, PreviewDataSourceHydrationTarget>();
  const plan = collectDocumentBindingPlan(document, bindingDefinitions);

  for (const regionFetch of plan.regionPlan.regionFetches) {
    const endpoint = regionFetch.fetchConfig.endpointTemplate?.trim();
    if (!endpoint) {
      continue;
    }

    targets.set(`${regionFetch.dataSourceId}:${regionFetch.regionNodeId}`, {
      dataSourceId: regionFetch.dataSourceId,
      dataVar: regionFetch.dataVar,
      endpoint,
      urlParams: regionFetch.fetchConfig.urlParams,
      responseMapping: regionFetch.responseMapping,
      resultShape: 'record',
      pollingIntervalMs: bindingDefinitions.dataSources[regionFetch.dataSourceId]?.pollingIntervalMs,
      liveMode: bindingDefinitions.dataSources[regionFetch.dataSourceId]?.liveMode,
    });
  }

  for (const gridFetch of plan.gridPlan.gridListFetches) {
    const endpoint = gridFetch.fetchConfig.endpointTemplate?.trim();
    if (!endpoint) {
      continue;
    }

    targets.set(`grid:${gridFetch.nodeId}`, {
      dataSourceId: gridFetch.dataSourceId,
      dataVar: gridFetch.dataVar,
      endpoint,
      urlParams: gridFetch.fetchConfig.urlParams,
      queryParams: gridFetch.queryParams,
      responseMapping: gridFetch.responseMapping,
      resultShape: 'rows',
      pollingIntervalMs: bindingDefinitions.dataSources[gridFetch.dataSourceId]?.pollingIntervalMs,
      liveMode: bindingDefinitions.dataSources[gridFetch.dataSourceId]?.liveMode,
    });
  }

  for (const repeaterFetch of plan.repeaterPlan.repeaterListFetches) {
    const endpoint = repeaterFetch.fetchConfig.endpointTemplate?.trim();
    if (!endpoint) {
      continue;
    }

    targets.set(`repeater:${repeaterFetch.nodeId}`, {
      dataSourceId: repeaterFetch.dataSourceId,
      dataVar: repeaterFetch.dataVar,
      endpoint,
      urlParams: repeaterFetch.fetchConfig.urlParams,
      responseMapping: repeaterFetch.responseMapping,
      resultShape: 'rows',
      pollingIntervalMs: bindingDefinitions.dataSources[repeaterFetch.dataSourceId]?.pollingIntervalMs,
      liveMode: bindingDefinitions.dataSources[repeaterFetch.dataSourceId]?.liveMode,
    });
  }

  for (const chartFetch of plan.chartPlan.chartListFetches) {
    const endpoint = chartFetch.fetchConfig.endpointTemplate?.trim();
    if (!endpoint) {
      continue;
    }

    targets.set(`chart:${chartFetch.nodeId}:${chartFetch.sourceIndex}`, {
      dataSourceId: chartFetch.dataSourceId,
      dataVar: chartFetch.dataVar,
      endpoint,
      urlParams: chartFetch.fetchConfig.urlParams,
      queryParams: chartFetch.queryParams,
      responseMapping: chartFetch.responseMapping,
      resultShape: 'rows',
      pollingIntervalMs: bindingDefinitions.dataSources[chartFetch.dataSourceId]?.pollingIntervalMs,
      liveMode: bindingDefinitions.dataSources[chartFetch.dataSourceId]?.liveMode,
    });
  }

  for (const vizFetch of plan.vizPlan.vizListFetches) {
    const endpoint = vizFetch.fetchConfig.endpointTemplate?.trim();
    if (!endpoint) {
      continue;
    }

    targets.set(`viz:${vizFetch.nodeId}`, {
      dataSourceId: vizFetch.dataSourceId,
      dataVar: vizFetch.dataVar,
      endpoint,
      urlParams: vizFetch.fetchConfig.urlParams,
      queryParams: vizFetch.queryParams,
      responseMapping: vizFetch.responseMapping,
      resultShape: 'rows',
      pollingIntervalMs: bindingDefinitions.dataSources[vizFetch.dataSourceId]?.pollingIntervalMs,
      liveMode: bindingDefinitions.dataSources[vizFetch.dataSourceId]?.liveMode,
    });
  }

  for (const contentFetch of plan.contentPlan.contentListFetches) {
    const endpoint = contentFetch.fetchConfig.endpointTemplate?.trim();
    if (!endpoint) {
      continue;
    }

    targets.set(`content:${contentFetch.nodeId}`, {
      dataSourceId: contentFetch.dataSourceId,
      dataVar: contentFetch.dataVar,
      endpoint,
      urlParams: contentFetch.fetchConfig.urlParams,
      responseMapping: contentFetch.responseMapping,
      resultShape: 'rows',
      pollingIntervalMs: bindingDefinitions.dataSources[contentFetch.dataSourceId]?.pollingIntervalMs,
      liveMode: bindingDefinitions.dataSources[contentFetch.dataSourceId]?.liveMode,
    });
  }

  for (const dynamicFetch of collectDynamicActionDataSourceFetches(
    document,
    bindingDefinitions,
    buildExistingDataSourceRefreshVarMap({
      regionFetches: plan.regionPlan.regionFetches,
      gridListFetches: plan.gridPlan.gridListFetches,
      chartListFetches: plan.chartPlan.chartListFetches,
      vizListFetches: plan.vizPlan.vizListFetches,
      repeaterListFetches: plan.repeaterPlan.repeaterListFetches,
    }),
  )) {
    if (targets.has(dynamicFetch.dataSourceId)) {
      continue;
    }

    targets.set(dynamicFetch.dataSourceId, {
      dataSourceId: dynamicFetch.dataSourceId,
      dataVar: dynamicFetch.dataVar,
      endpoint: dynamicFetch.endpoint,
      pollingIntervalMs: bindingDefinitions.dataSources[dynamicFetch.dataSourceId]?.pollingIntervalMs,
      liveMode: bindingDefinitions.dataSources[dynamicFetch.dataSourceId]?.liveMode,
    });
  }

  return Array.from(targets.values());
};
