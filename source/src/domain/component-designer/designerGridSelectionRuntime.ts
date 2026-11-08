import {
  createDynamicAction,
  createDynamicActionsEventBindingDefinition,
  resolveDynamicActions,
  sanitizeTrueActions,
} from './bindingDynamicActionsEngine';
import { executeDynamicActions, type DynamicActionRuntimeContext } from './bindingDynamicActionsRuntime';
import type { DesignerDynamicAction, DesignerBindingDefinitions } from './types';

export const DEFAULT_GRID_SELECTION_STORE_PATH = 'gridSelection.selectedKeys';
export const DEFAULT_GRID_ACTIVE_SELECTION_ID_STORE_PATH = 'gridSelection.activeId';
export const DEFAULT_GRID_CELL_EDIT_STORE_PATH = 'gridCellEdit';

export type DesignerGridToolbarBulkAction = {
  id: string;
  label: string;
  icon?: string;
  /** Dynamic Action chain. When `runPerSelectedKey` is true (default), each selected primary key runs the chain once. */
  actions: DesignerDynamicAction[];
  /** Default true — set activeId then run actions for each key. */
  runPerSelectedKey?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseDesignerGridToolbarBulkAction = (
  value: unknown,
): DesignerGridToolbarBulkAction | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id = readTrimmedString(value.id);
  const label = readTrimmedString(value.label);
  if (!id || !label) {
    return null;
  }
  const actions = sanitizeTrueActions(value.actions);
  if (actions.length === 0) {
    return null;
  }
  return {
    id,
    label,
    ...(readTrimmedString(value.icon) ? { icon: readTrimmedString(value.icon) } : {}),
    actions,
    ...(value.runPerSelectedKey === false ? { runPerSelectedKey: false } : {}),
  };
};

export const parseDesignerGridToolbarBulkActions = (
  value: unknown,
): DesignerGridToolbarBulkAction[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => parseDesignerGridToolbarBulkAction(entry))
    .filter((entry): entry is DesignerGridToolbarBulkAction => entry !== null);
};

export const createDefaultGridBulkAction = (
  label = 'Delete selected',
): DesignerGridToolbarBulkAction => {
  const mutation = createDynamicAction('callMutation');
  mutation.mutationOperation = 'delete';
  mutation.mutationRecordIdStorePath = DEFAULT_GRID_ACTIVE_SELECTION_ID_STORE_PATH;
  return {
    id: `bulk-${mutation.id}`,
    label,
    icon: 'Trash2',
    actions: [mutation],
    runPerSelectedKey: true,
  };
};

export const normalizeSelectedKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (value instanceof Set) {
    return [...value].map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
};

export const readSelectedKeysFromStore = (
  store: Record<string, unknown> | undefined,
  storePath: string = DEFAULT_GRID_SELECTION_STORE_PATH,
): string[] => {
  if (!store) {
    return [];
  }
  const segments = storePath.split('.').map((part) => part.trim()).filter(Boolean);
  let cursor: unknown = store;
  for (const segment of segments) {
    if (cursor && typeof cursor === 'object' && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return [];
    }
  }
  return normalizeSelectedKeys(cursor);
};

/**
 * Run a bulk action for each selected key (default) or once with the full selection array in store.
 */
export const executeGridBulkAction = async (
  bulkAction: DesignerGridToolbarBulkAction,
  selectedKeys: readonly string[],
  options: {
    bindingDefinitions: DesignerBindingDefinitions;
    runtime: DynamicActionRuntimeContext;
    activeIdStorePath?: string;
    selectionStorePath?: string;
  },
): Promise<void> => {
  if (selectedKeys.length === 0) {
    return;
  }

  const definition = createDynamicActionsEventBindingDefinition('onAction', bulkAction.actions);
  const resolved = resolveDynamicActions(definition, options.bindingDefinitions);
  if (!resolved?.length) {
    return;
  }

  const activeIdPath = options.activeIdStorePath ?? DEFAULT_GRID_ACTIVE_SELECTION_ID_STORE_PATH;
  const selectionPath = options.selectionStorePath ?? DEFAULT_GRID_SELECTION_STORE_PATH;
  const runPerKey = bulkAction.runPerSelectedKey !== false;

  if (!runPerKey) {
    options.runtime.patchStore(selectionPath, [...selectedKeys]);
    await executeDynamicActions(resolved, options.runtime);
    return;
  }

  for (const key of selectedKeys) {
    options.runtime.patchStore(activeIdPath, key);
    await executeDynamicActions(resolved, options.runtime);
  }
};

export type GridCellChangePayload = {
  rowKey: string;
  field: string;
  value: unknown;
  row: Record<string, unknown>;
};

/**
 * Persist the edited cell payload into the store and run the column's onCellChange action chain.
 */
export const executeGridCellChangeActions = async (
  actions: DesignerDynamicAction[] | undefined,
  payload: GridCellChangePayload,
  options: {
    bindingDefinitions: DesignerBindingDefinitions;
    runtime: DynamicActionRuntimeContext;
    cellEditStorePath?: string;
  },
): Promise<void> => {
  if (!actions || actions.length === 0) {
    return;
  }

  const basePath = options.cellEditStorePath ?? DEFAULT_GRID_CELL_EDIT_STORE_PATH;
  options.runtime.patchStore(`${basePath}.rowKey`, payload.rowKey);
  options.runtime.patchStore(`${basePath}.field`, payload.field);
  options.runtime.patchStore(`${basePath}.value`, payload.value);
  options.runtime.patchStore(`${basePath}.row`, payload.row);
  options.runtime.patchStore(DEFAULT_GRID_ACTIVE_SELECTION_ID_STORE_PATH, payload.rowKey);

  const definition = createDynamicActionsEventBindingDefinition('onCellChange', actions);
  const resolved = resolveDynamicActions(definition, options.bindingDefinitions);
  await executeDynamicActions(resolved, options.runtime);
};
