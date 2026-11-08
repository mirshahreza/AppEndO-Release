import type { ApiFormField } from './apiFieldSchema';
import { humanizeFieldName } from './apiFieldToControl';
import { documentHasDesignedContent } from './autoFormTemplateBuilder';
import {
  buildGridListBindingWithToolbarQueryParams,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from './bindingGridEngine';
import { canInsertTemplateSeed, cloneTemplateSeedsToNodes } from './builtInTemplateClone';
import {
  APP_TABLE_GRID_PALETTE_ITEM_ID,
  createActionGridColumn,
  serializeDesignerDataGridColumns,
  serializeDesignerGridSortOptions,
  type DesignerDataGridColumn,
  type DesignerDataGridColumnCellKind,
  type DesignerGridSortOption,
} from './designerDataGridColumns';
import {
  createActionGroupColumn,
  createIconActionColumn,
  type DesignerGridRowAction,
} from './designerGridActionColumns';
import {
  buildServerQueryColumnFiltersFromGridColumns,
  DEFAULT_GRID_SERVER_QUERY_CONFIG,
  DEFAULT_GRID_TOOLBAR_CREATE,
  DEFAULT_GRID_TOOLBAR_REFRESH,
  DEFAULT_GRID_TOOLBAR_SEARCH,
  serializeDesignerGridToolbarConfig,
  type DesignerGridToolbarConfig,
} from './designerGridToolbarConfig';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import { createInitialDesignerState } from './state';
import type {
  DataSourceDefinition,
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  TemplateNodeSeed,
} from './types';

export { documentHasDesignedContent };

export type AutoTableCellKind = DesignerDataGridColumnCellKind;

export type AutoTableColumnConfig = {
  field: ApiFormField;
  enabled: boolean;
  label: string;
  cellKind: AutoTableCellKind;
  sortable: boolean;
  filterable: boolean;
};

export type AutoTableRowActionId = 'details' | 'edit' | 'delete';

export type AutoTableToolbarOptions = {
  search: boolean;
  refresh: boolean;
  /** Toolbar "Add" button — Phase 20 wires open-modal; here it is a visible affordance only. */
  createButton: boolean;
};

export type AutoTableBuildConfig = {
  title?: string;
  includeTitle: boolean;
  dataSource: DataSourceDefinition;
  columns: AutoTableColumnConfig[];
  toolbar: AutoTableToolbarOptions;
  /** Optional row action columns; kept composable for Auto CRUD (Phase 20). */
  rowActions: AutoTableRowActionId[];
  pageSize?: number;
};

export type AutoTableBuildResult = {
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  preferredSelectedNodeId: string | null;
};

export type AutoTableInsertTarget = {
  mode: 'container-insert';
  parentNodeId: string;
};

const GRID_PROBE_SEED: TemplateNodeSeed = {
  type: 'container',
  paletteItemId: APP_TABLE_GRID_PALETTE_ITEM_ID,
  props: {},
};

const NOTE_FIELD_RE = /(^|_)note(s)?$/i;
const AVATAR_NAME_RE = /(avatar|photo|image|picture|thumbnail)/i;
const LINK_NAME_RE = /(url|href|link|website)/i;
const LOCK_NAME_RE = /(^|_)(locked|lock_status|is_locked)($|_)/i;

/** Infer App Table Grid cellKind from an OpenAPI response field (display, not input). */
export const suggestCellKindForField = (field: ApiFormField): AutoTableCellKind => {
  const name = field.name.trim();
  if (LOCK_NAME_RE.test(name)) {
    return 'lock-status';
  }
  if (field.type === 'boolean') {
    return 'boolean-icon';
  }
  if (field.format === 'date' || field.format === 'date-time') {
    return 'date';
  }
  if (field.enum && field.enum.length > 0) {
    return 'badge';
  }
  if (field.type === 'array') {
    return 'chips';
  }
  if (AVATAR_NAME_RE.test(name)) {
    return 'avatar';
  }
  if (LINK_NAME_RE.test(name)) {
    return 'link';
  }
  return 'text';
};

const suggestFilterType = (
  field: ApiFormField,
  cellKind: AutoTableCellKind,
): DesignerDataGridColumn['filterType'] => {
  if (field.type === 'boolean' || cellKind === 'boolean-icon' || cellKind === 'lock-status') {
    return 'boolean';
  }
  if (cellKind === 'date' || field.format === 'date' || field.format === 'date-time') {
    return 'dateRange';
  }
  if (field.enum && field.enum.length > 0) {
    return 'select';
  }
  return 'text';
};

const shouldDefaultSortable = (field: ApiFormField): boolean =>
  !NOTE_FIELD_RE.test(field.name) && field.type !== 'array';

const shouldDefaultFilterable = (field: ApiFormField, cellKind: AutoTableCellKind): boolean => {
  if (field.type === 'array' || cellKind === 'avatar') {
    return false;
  }
  return field.type === 'boolean'
    || Boolean(field.enum?.length)
    || cellKind === 'date'
    || cellKind === 'badge'
    || cellKind === 'boolean-icon'
    || field.type === 'string';
};

/** Build wizard column configs from typed response fields. */
export const buildAutoTableColumnConfigsFromFields = (
  fields: readonly ApiFormField[],
): AutoTableColumnConfig[] => fields.map((field) => {
  const cellKind = suggestCellKindForField(field);
  return {
    field,
    enabled: true,
    label: humanizeFieldName(field.name),
    cellKind,
    sortable: shouldDefaultSortable(field),
    filterable: shouldDefaultFilterable(field, cellKind),
  };
});

export const buildDesignerColumnsFromAutoTableConfig = (
  config: AutoTableBuildConfig,
): DesignerDataGridColumn[] => {
  const fieldColumns: DesignerDataGridColumn[] = config.columns
    .filter((entry) => entry.enabled)
    .map((entry) => {
      const filterType = entry.filterable
        ? suggestFilterType(entry.field, entry.cellKind)
        : undefined;
      return {
        key: entry.field.name,
        label: entry.label.trim() || humanizeFieldName(entry.field.name),
        kind: 'field' as const,
        ...(entry.sortable ? { sort: true } : {}),
        ...(entry.filterable ? { filter: true, filterType } : {}),
        ...(entry.cellKind !== 'text' ? { cellKind: entry.cellKind } : {}),
        layoutHideable: true,
        cardRole: entry.field.name === 'id' ? 'hidden' as const : 'field' as const,
      };
    });

  const actionColumns = buildRowActionColumns(config.rowActions);
  return [...fieldColumns, ...actionColumns];
};

const buildRowActionColumns = (actions: readonly AutoTableRowActionId[]): DesignerDataGridColumn[] => {
  if (actions.length === 0) {
    return [];
  }

  if (actions.length === 1 && actions[0] === 'details') {
    return [createActionGridColumn('Details', 'details')];
  }

  const groupActions: DesignerGridRowAction[] = [];
  for (const actionId of actions) {
    if (actionId === 'details') {
      groupActions.push({
        actionId: 'details',
        icon: 'Eye',
        intent: 'view',
        tooltip: 'Details',
        behavior: { kind: 'detail-flow' },
      });
      continue;
    }
    if (actionId === 'edit') {
      groupActions.push({
        actionId: 'edit',
        icon: 'Pencil',
        intent: 'edit',
        tooltip: 'Edit',
      });
      continue;
    }
    groupActions.push({
      actionId: 'delete',
      icon: 'Trash2',
      intent: 'delete',
      tooltip: 'Delete',
    });
  }

  if (groupActions.length === 1) {
    const only = groupActions[0]!;
    return [createIconActionColumn(only.actionId, {
      icon: only.icon,
      intent: only.intent,
      tooltip: only.tooltip,
      behavior: only.behavior,
    })];
  }

  return [createActionGroupColumn(groupActions)];
};

export const buildAutoTableToolbarConfig = (
  config: AutoTableBuildConfig,
  columns: readonly DesignerDataGridColumn[],
): DesignerGridToolbarConfig => {
  const resourceLabel = config.dataSource.name?.trim() || 'records';
  return {
    enabled: true,
    ...(config.toolbar.search
      ? {
        search: {
          ...DEFAULT_GRID_TOOLBAR_SEARCH,
          placeholder: `Search ${resourceLabel.toLowerCase()}…`,
        },
      }
      : {}),
    ...(config.toolbar.createButton
      ? {
        create: {
          ...DEFAULT_GRID_TOOLBAR_CREATE,
          label: `Add ${resourceLabel}`,
        },
      }
      : {}),
    ...(config.toolbar.refresh ? { refresh: DEFAULT_GRID_TOOLBAR_REFRESH } : {}),
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(columns),
    },
  };
};

const resolveRowKeyField = (columns: readonly DesignerDataGridColumn[], dataSource: DataSourceDefinition): string => {
  const pk = dataSource.primaryKey?.trim();
  if (pk) {
    return pk;
  }
  if (columns.some((column) => column.key === 'id')) {
    return 'id';
  }
  return columns.find((column) => column.kind !== 'action' && column.kind !== 'action-group')?.key ?? 'id';
};

const resolveDefaultSortBy = (columns: readonly DesignerDataGridColumn[]): string => {
  const sortable = columns.find((column) => column.sort && column.kind !== 'action' && column.kind !== 'action-group');
  return sortable?.key ?? columns.find((column) => column.kind !== 'action' && column.kind !== 'action-group')?.key ?? '';
};

const buildSortOptions = (columns: readonly DesignerDataGridColumn[]): DesignerGridSortOption[] =>
  columns
    .filter((column) => column.sort && column.kind !== 'action' && column.kind !== 'action-group')
    .map((column) => ({ value: column.key, label: column.label || column.key }));

const mergeDataSourceIntoBindings = (
  bindingDefinitions: DesignerBindingDefinitions,
  dataSource: DataSourceDefinition,
): DesignerBindingDefinitions => ({
  ...bindingDefinitions,
  dataSources: {
    ...bindingDefinitions.dataSources,
    [dataSource.id]: dataSource,
  },
});

const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : undefined;
};

/**
 * Resolves where an auto-generated table should be inserted.
 * Prefers the selected container (or its nearest hostable ancestor); falls back to root
 * when the canvas already has content. Returns null only for a truly blank canvas
 * (caller should `buildAutoTableDocument` instead).
 */
export const resolveAutoTableInsertTarget = (
  document: DesignerDocument,
  selectedNodeId: string | null,
): AutoTableInsertTarget | null => {
  const rootId = document.rootNodeId;
  const blank = !documentHasDesignedContent(document);

  const tryHost = (nodeId: string): AutoTableInsertTarget | null => {
    const node = document.nodes[nodeId];
    if (!node) {
      return null;
    }
    if (canInsertTemplateSeed(GRID_PROBE_SEED, node)) {
      return { mode: 'container-insert', parentNodeId: nodeId };
    }
    return null;
  };

  if (!selectedNodeId || selectedNodeId === rootId) {
    if (blank) {
      return null;
    }
    return tryHost(rootId) ?? { mode: 'container-insert', parentNodeId: rootId };
  }

  const selected = document.nodes[selectedNodeId];
  if (!selected) {
    return blank ? null : (tryHost(rootId) ?? { mode: 'container-insert', parentNodeId: rootId });
  }

  // Selecting an existing grid → insert as sibling under its parent.
  if (resolveNodePaletteItemId(selected) === APP_TABLE_GRID_PALETTE_ITEM_ID && selected.parentId) {
    return tryHost(selected.parentId)
      ?? { mode: 'container-insert', parentNodeId: selected.parentId };
  }

  const direct = tryHost(selected.id);
  if (direct) {
    return direct;
  }

  let parentId = selected.parentId;
  while (parentId) {
    const hosted = tryHost(parentId);
    if (hosted) {
      return hosted;
    }
    parentId = document.nodes[parentId]?.parentId ?? null;
  }

  if (blank) {
    return null;
  }

  return tryHost(rootId) ?? { mode: 'container-insert', parentNodeId: rootId };
};

/** Builds the table's `TemplateNodeSeed` tree (a single `heroui.app-table-grid` root). */
export const buildAutoTableSeeds = (config: AutoTableBuildConfig): TemplateNodeSeed[] => {
  const columns = buildDesignerColumnsFromAutoTableConfig(config);
  const toolbarConfig = buildAutoTableToolbarConfig(config, columns);
  const defaultSortBy = resolveDefaultSortBy(columns);
  const sortOptions = buildSortOptions(columns);
  const rowKeyField = resolveRowKeyField(columns, config.dataSource);
  const pageSize = typeof config.pageSize === 'number' && config.pageSize > 0 ? config.pageSize : 50;

  const fieldNames = config.columns.filter((entry) => entry.enabled).map((entry) => entry.field.name);
  const dataSource: DataSourceDefinition = {
    ...config.dataSource,
    fields: fieldNames.length > 0 ? fieldNames : config.dataSource.fields,
  };

  const listBinding = buildGridListBindingWithToolbarQueryParams(
    dataSource.id,
    toolbarConfig,
  );

  const gridSeed: TemplateNodeSeed = {
    type: 'container',
    paletteItemId: APP_TABLE_GRID_PALETTE_ITEM_ID,
    props: {
      className: 'flex h-full min-h-0 w-full flex-1 flex-col',
      columns: serializeDesignerDataGridColumns(columns),
      gridQueryMode: 'server',
      pageSize,
      page: 1,
      total: 0,
      presentation: 'auto',
      cardBelow: 'tablet',
      enableColumnLayout: true,
      showSortControls: true,
      showListModeControls: true,
      listMode: 'paging',
      rowKeyField,
      ...(defaultSortBy ? { defaultSortBy } : {}),
      ...(sortOptions.length > 0
        ? { sortOptions: serializeDesignerGridSortOptions(sortOptions) }
        : {}),
      toolbarConfig: serializeDesignerGridToolbarConfig(toolbarConfig),
      loadingMessage: 'Loading records…',
      emptyContent: 'No records found.',
      errorContent: 'Could not load records.',
    },
    binding: {
      [GRID_LIST_RESOURCE_BINDING_KEY]: listBinding,
    },
  };

  if (!config.includeTitle || !config.title?.trim()) {
    return [gridSeed];
  }

  return [{
    type: 'container',
    paletteItemId: 'layout.flex-column',
    props: { className: 'flex w-full flex-col gap-3' },
    children: [
      {
        type: 'heading',
        paletteItemId: 'html.heading',
        props: {
          text: config.title.trim(),
          className: 'text-lg font-semibold tracking-tight text-foreground',
        },
      },
      gridSeed,
    ],
  }];
};

const findGeneratedGridNodeId = (
  document: DesignerDocument,
  candidateIds: readonly string[],
): string | null => {
  const queue = [...candidateIds];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) {
      continue;
    }
    const node = document.nodes[id];
    if (!node) {
      continue;
    }
    if (resolveNodePaletteItemId(node) === APP_TABLE_GRID_PALETTE_ITEM_ID) {
      return id;
    }
    queue.push(...node.children);
  }
  return candidateIds[0] ?? null;
};

/**
 * Merges an auto-generated table into an existing document at the resolved container.
 */
export const mergeAutoTableIntoDocument = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  config: AutoTableBuildConfig,
  target: AutoTableInsertTarget,
): AutoTableBuildResult => {
  const seeds = buildAutoTableSeeds(config);
  const parent = document.nodes[target.parentNodeId];
  if (!parent) {
    throw new Error(`Auto-table insert parent "${target.parentNodeId}" was not found.`);
  }

  const startOrder = parent.children.length;
  const { nodes, rootNodeIds } = cloneTemplateSeedsToNodes(seeds, target.parentNodeId, startOrder);
  const now = new Date().toISOString();

  const nextDocument: DesignerDocument = {
    ...document,
    nodes: {
      ...document.nodes,
      ...nodes,
      [target.parentNodeId]: {
        ...parent,
        children: [...parent.children, ...rootNodeIds],
      },
    },
    metadata: { ...document.metadata, updatedAt: now },
  };

  return {
    document: nextDocument,
    bindingDefinitions: mergeDataSourceIntoBindings(bindingDefinitions, {
      ...config.dataSource,
      fields: config.columns.filter((entry) => entry.enabled).map((entry) => entry.field.name),
    }),
    preferredSelectedNodeId: findGeneratedGridNodeId(nextDocument, rootNodeIds),
  };
};

/**
 * Builds a complete designer document + binding definitions for a fresh auto-generated table.
 */
export const buildAutoTableDocument = (config: AutoTableBuildConfig): AutoTableBuildResult => {
  const base = createInitialDesignerState();
  const rootId = base.document.rootNodeId;
  const seeds = buildAutoTableSeeds(config);
  const { nodes, rootNodeIds } = cloneTemplateSeedsToNodes(seeds, rootId, 0);
  const now = new Date().toISOString();

  const document: DesignerDocument = {
    ...base.document,
    nodes: {
      ...base.document.nodes,
      [rootId]: { ...base.document.nodes[rootId], children: rootNodeIds },
      ...nodes,
    },
    metadata: { ...base.document.metadata, updatedAt: now },
  };

  const dataSource: DataSourceDefinition = {
    ...config.dataSource,
    fields: config.columns.filter((entry) => entry.enabled).map((entry) => entry.field.name),
  };

  return {
    document,
    bindingDefinitions: mergeDataSourceIntoBindings(base.bindingDefinitions, dataSource),
    preferredSelectedNodeId: findGeneratedGridNodeId(document, rootNodeIds),
  };
};
