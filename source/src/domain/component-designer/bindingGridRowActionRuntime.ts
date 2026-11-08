import { toast } from '@heroui/react';
import { resolveNavigateTargetTemplate, resolveMutationRuntimeUrl, visibilityStorePathForNode } from './bindingDynamicActionsEngine';
import type { DynamicActionNavigateFn } from './bindingDynamicActionsRuntime';
import {
  buildGridDetailRowActionPreview,
  collectDocumentGridDetailFlows,
  type ResolvedGridDetailFlow,
} from './bindingGridDetailEngine';
import {
  collectGridRowActionsFromColumns,
  findGridRowActionDefinition,
  type DesignerGridRowActionBehavior,
} from './designerGridActionColumns';
import {
  parseDesignerAppTableGridColumns,
  parseDesignerDataGridColumns,
  type DesignerDataGridColumn,
} from './designerDataGridColumns';
import { APP_TABLE_GRID_PALETTE_ITEM_ID } from './designerDataGridColumns';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import { findRegionDataVarInSubtree } from './bindingRegionEngine';
import { patchNestedStoreValue } from './designerPreviewResolvers';
import {
  resolveDataSourceOperationEndpoint,
} from './bindingResourceModel';
import { designerFetch, parseApiErrorMessage } from './bindingMutationRuntime';
import { rowShowsHwyFamilyHouseholdCellClick } from '../hwy/hwyFamilyHousehold';
import { openHwyFamilyHouseholdFromDesignerGrid } from '../hwy/hwyFamilyHouseholdRuntime';
import {
  openHwyImageFixEditorFromDesignerGrid,
  rowShowsHwyImageFixEditorCellClick,
} from '../hwy/hwyImageFixEditorRuntime';
import type { DesignerBindingDefinitions, DesignerDocument, DesignerNode } from './types';

export type GridRowActionRuntimeContext = {
  patchStore: (path: string, value: unknown) => void;
  patchStoreState?: (updater: (store: Record<string, unknown>) => Record<string, unknown>) => void;
  seedRegionFromRow?: (modalNodeId: string, row: Record<string, unknown>) => void;
  refreshDetail?: () => Promise<void>;
  navigate?: DynamicActionNavigateFn;
  refreshDataSource?: (
    dataSourceRef: string,
    dataVar?: string,
    options?: { notifyOnError?: boolean; bypassServerCache?: boolean },
  ) => Promise<void>;
  bindingDefinitions?: DesignerBindingDefinitions;
  designerStore?: Record<string, unknown>;
  document?: DesignerDocument;
};

const parseGridColumns = (node: DesignerNode): ReturnType<typeof parseDesignerDataGridColumns> => {
  const paletteItemId = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return paletteItemId === APP_TABLE_GRID_PALETTE_ITEM_ID
    ? parseDesignerAppTableGridColumns(node.props.columns)
    : parseDesignerDataGridColumns(node.props.columns);
};

const normalizeRecordId = (value: unknown): string | number | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return String(value);
};

const mergeSelectionIntoStore = (
  designerStore: Record<string, unknown> | undefined,
  row: Record<string, unknown>,
  primaryKeyField: string,
  selectionStorePath: string,
): Record<string, unknown> => {
  const base = designerStore ?? {};
  const recordId = normalizeRecordId(row[primaryKeyField]);
  return patchNestedStoreValue(base, selectionStorePath, recordId);
};

const executeOpenModalBehavior = (
  row: Record<string, unknown>,
  behavior: DesignerGridRowActionBehavior,
  context: GridRowActionRuntimeContext,
): void => {
  const modalNodeId = behavior.modalNodeId?.trim();
  if (!modalNodeId || behavior.kind !== 'open-modal') {
    return;
  }

  const primaryKeyField = behavior.primaryKeyField?.trim() || 'id';
  const selectionStorePath = behavior.selectionStorePath?.trim() || 'selection.id';
  const recordId = normalizeRecordId(row[primaryKeyField]);
  const visibilityPath = visibilityStorePathForNode(modalNodeId);

  if (context.document) {
    const regionTarget = findRegionDataVarInSubtree(context.document, modalNodeId);
    if (regionTarget?.loadOperation === 'detail') {
      context.seedRegionFromRow?.(modalNodeId, row);
    }
  }

  if (context.patchStoreState) {
    context.patchStoreState((store) => {
      let next = patchNestedStoreValue(store, selectionStorePath, recordId ?? null);
      next = patchNestedStoreValue(next, visibilityPath, true);
      return next;
    });
    return;
  }

  context.patchStore(selectionStorePath, recordId ?? null);
  context.patchStore(visibilityPath, true);
};

const executeNavigateBehavior = (
  row: Record<string, unknown>,
  behavior: DesignerGridRowActionBehavior,
  context: GridRowActionRuntimeContext,
): void => {
  if (behavior.kind !== 'navigate' || !context.navigate) {
    return;
  }

  const navigateTarget = behavior.navigateTarget?.trim();
  if (!navigateTarget) {
    return;
  }

  const primaryKeyField = behavior.primaryKeyField?.trim() || 'id';
  const selectionStorePath = behavior.selectionStorePath?.trim() || `selection.${primaryKeyField}`;
  const mergedStore = mergeSelectionIntoStore(
    context.designerStore,
    row,
    primaryKeyField,
    selectionStorePath,
  );
  const to = resolveNavigateTargetTemplate(navigateTarget, mergedStore);
  if (!to) {
    return;
  }

  context.navigate(to, { replace: behavior.navigateReplace === true });
};

const executeCallMutationBehavior = async (
  row: Record<string, unknown>,
  behavior: DesignerGridRowActionBehavior,
  context: GridRowActionRuntimeContext,
): Promise<void> => {
  if (behavior.kind !== 'callMutation') {
    return;
  }

  const dataSourceRef = behavior.dataSourceRef?.trim();
  const dataSource = dataSourceRef
    ? context.bindingDefinitions?.dataSources?.[dataSourceRef]
    : undefined;
  if (!dataSource) {
    toast('Data source is not configured for this action.', { variant: 'danger' });
    return;
  }

  const mutationOperation = behavior.mutationOperation ?? 'update';
  const primaryKeyField = behavior.primaryKeyField?.trim() || 'id';
  const recordId = normalizeRecordId(row[primaryKeyField]);
  const endpoint = resolveDataSourceOperationEndpoint(dataSource, mutationOperation);
  const url = resolveMutationRuntimeUrl(endpoint, recordId);

  const body: Record<string, unknown> = { ...(behavior.mutationBody ?? {}) };
  const rowFields = behavior.mutationBodyRowFields ?? (
    mutationOperation === 'delete' ? [primaryKeyField] : [primaryKeyField]
  );
  for (const field of rowFields) {
    if (field in row) {
      body[field] = row[field];
    }
  }
  if (!(primaryKeyField in body) && recordId !== undefined) {
    body[primaryKeyField] = recordId;
  }

  try {
    const response = await designerFetch(url, {
      method: mutationOperation === 'delete' ? 'DELETE' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      ...(mutationOperation === 'delete' ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const message = await parseApiErrorMessage(response);
      toast(message, { variant: 'danger' });
      return;
    }
    if (behavior.refreshList && dataSourceRef && context.refreshDataSource) {
      await context.refreshDataSource(dataSourceRef, undefined, { bypassServerCache: true });
    }
  } catch (mutationFailure) {
    const message = mutationFailure instanceof Error ? mutationFailure.message : 'Request failed';
    toast(message, { variant: 'danger' });
  }
};

const executeDetailFlowAction = (
  flow: ResolvedGridDetailFlow,
  row: Record<string, unknown>,
  actionId: string,
  context: GridRowActionRuntimeContext,
): boolean => {
  if (actionId !== flow.config.rowActionId) {
    return false;
  }

  buildGridDetailRowActionPreview(flow, row, actionId, context);
  return true;
};

const executeConfiguredBehavior = (
  gridNode: DesignerNode,
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  row: Record<string, unknown>,
  behavior: DesignerGridRowActionBehavior | undefined,
  fallbackActionId: string | undefined,
  context: GridRowActionRuntimeContext,
): boolean => {
  const detailFlows = collectDocumentGridDetailFlows(document, bindingDefinitions);
  const detailFlow = detailFlows.find((entry) => entry.gridNodeId === gridNode.id);

  if (behavior?.kind === 'open-modal') {
    executeOpenModalBehavior(row, behavior, context);
    return true;
  }

  if (behavior?.kind === 'navigate') {
    executeNavigateBehavior(row, behavior, context);
    return true;
  }

  if (behavior?.kind === 'callMutation') {
    void executeCallMutationBehavior(row, behavior, context);
    return true;
  }

  if (behavior?.kind === 'detail-flow' && detailFlow) {
    return executeDetailFlowAction(detailFlow, row, detailFlow.config.rowActionId, context);
  }

  if (behavior?.kind === 'none') {
    return true;
  }

  const normalizedActionId = fallbackActionId?.trim();
  if (normalizedActionId && detailFlow) {
    return executeDetailFlowAction(detailFlow, row, normalizedActionId, context);
  }

  return false;
};

export const executeDesignerGridRowActionBehavior = (
  row: Record<string, unknown>,
  behavior: DesignerGridRowActionBehavior | undefined,
  context: GridRowActionRuntimeContext,
): boolean => {
  if (!behavior) {
    return false;
  }

  if (behavior.kind === 'open-modal') {
    executeOpenModalBehavior(row, behavior, context);
    return true;
  }

  if (behavior.kind === 'navigate') {
    executeNavigateBehavior(row, behavior, context);
    return true;
  }

  if (behavior.kind === 'callMutation') {
    void executeCallMutationBehavior(row, behavior, context);
    return true;
  }

  if (behavior.kind === 'none') {
    return true;
  }

  return false;
};

export const executeDesignerGridRowAction = (
  gridNode: DesignerNode,
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  row: Record<string, unknown>,
  actionId: string,
  context: GridRowActionRuntimeContext,
): boolean => {
  const normalizedActionId = actionId.trim();
  if (!normalizedActionId) {
    return false;
  }

  const columns = parseGridColumns(gridNode);
  const actionDefinition = findGridRowActionDefinition(columns, normalizedActionId);

  return executeConfiguredBehavior(
    gridNode,
    document,
    bindingDefinitions,
    row,
    actionDefinition?.behavior,
    normalizedActionId,
    context,
  );
};

export const executeDesignerGridCellClick = (
  gridNode: DesignerNode,
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  row: Record<string, unknown>,
  column: DesignerDataGridColumn,
  context: GridRowActionRuntimeContext,
): boolean => {
  if (column.cellClickBehavior?.kind === 'hwy-family-household') {
    if (!rowShowsHwyFamilyHouseholdCellClick(row, column)) {
      return false;
    }
    openHwyFamilyHouseholdFromDesignerGrid(row, column.key, column);
    return true;
  }

  if (column.cellClickBehavior?.kind === 'hwy-image-fix-editor' || rowShowsHwyImageFixEditorCellClick(row, column)) {
    openHwyImageFixEditorFromDesignerGrid(row);
    return true;
  }

  const actionId = column.cellClickActionId?.trim();
  if (actionId) {
    return executeDesignerGridRowAction(gridNode, document, bindingDefinitions, row, actionId, context);
  }

  return executeConfiguredBehavior(
    gridNode,
    document,
    bindingDefinitions,
    row,
    column.cellClickBehavior,
    undefined,
    context,
  );
};

export const createDesignerGridRowActionHandler = (
  gridNodeId: string,
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  context: GridRowActionRuntimeContext,
): ((row: Record<string, unknown>, actionId: string) => void) => {
  return (row, actionId) => {
    const gridNode = document.nodes[gridNodeId];
    if (!gridNode) {
      return;
    }
    executeDesignerGridRowAction(gridNode, document, bindingDefinitions, row, actionId, context);
  };
};

export const createDesignerGridCellClickHandler = (
  gridNodeId: string,
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  context: GridRowActionRuntimeContext,
): ((row: Record<string, unknown>, column: DesignerDataGridColumn) => void) => {
  return (row, column) => {
    const gridNode = document.nodes[gridNodeId];
    if (!gridNode) {
      return;
    }
    executeDesignerGridCellClick(gridNode, document, bindingDefinitions, row, column, context);
  };
};

export const listConfiguredGridRowActionIds = (
  gridNode: DesignerNode,
): string[] => collectGridRowActionsFromColumns(parseGridColumns(gridNode)).map((action) => action.actionId);
