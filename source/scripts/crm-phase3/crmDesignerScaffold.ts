/**
 * Build CRM Client Components (Component Designer documents) for Phase 3a.
 *
 * Scope: Settings shell + 4 manageable vocab pages + catalog stubs (3b–3d).
 * Closed enums (Party Kinds, Lifecycle, Pipeline, Activity Types, Ticket Status)
 * intentionally have no vocabulary pages.
 */

import { designerReducer } from '../../src/domain/component-designer/state';
import type {
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  DesignerState,
  DataSourceDefinition,
} from '../../src/domain/component-designer/types';
import {
  appendRecordsCrudOverlays,
  createRecordsPageState,
} from './designerRecordsPageBuilder';
import { DESIGNER_MODAL_FORM_BODY_CONTENT_CLASS } from '../../src/domain/component-designer/designerModalChrome';
import {
  serializeDesignerDataGridColumns,
  serializeDesignerGridSortOptions,
  type DesignerDataGridColumn,
} from '../../src/domain/component-designer/designerDataGridColumns';
import {
  buildServerQueryColumnFiltersFromGridColumns,
  DEFAULT_GRID_SERVER_QUERY_CONFIG,
  DEFAULT_GRID_TOOLBAR_REFRESH,
  DEFAULT_GRID_TOOLBAR_SEARCH,
  serializeDesignerGridToolbarConfig,
  type DesignerGridToolbarConfig,
} from '../../src/domain/component-designer/designerGridToolbarConfig';
import {
  buildGridListBindingWithToolbarQueryParams,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from '../../src/domain/component-designer/bindingGridEngine';
import {
  createDynamicAction,
  createDynamicActionsEventBindingDefinition,
} from '../../src/domain/component-designer/bindingDynamicActionsEngine';
import { eventBindingKeyForEvent, propertyBindingKeyForProp } from '../../src/domain/component-designer/bindingEngine';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../../src/domain/component-designer/propRegistry';
import {
  REGION_DATA_SOURCE_BINDING_KEY,
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  createRegionSubmitEventBindingDefinition,
} from '../../src/domain/component-designer/bindingRegionEngine';
import type { DesignerGridRowActionBehavior } from '../../src/domain/component-designer/designerGridActionColumns';

export type CrmDesignerDraftBundle = {
  name: string;
  folder: string;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
};

const FOLDER = 'crm';

export const lastChildId = (state: DesignerState, parentId: string): string => {
  const children = state.document.nodes[parentId]?.children ?? [];
  const id = children[children.length - 1];
  if (!id) throw new Error(`Expected child under ${parentId}`);
  return id;
};

export const insert = (state: DesignerState, itemId: string, parentId: string): { state: DesignerState; nodeId: string } => {
  const next = designerReducer(state, { type: 'insert-palette-item', itemId, parentId });
  return { state: next, nodeId: lastChildId(next, parentId) };
};

export const setProp = (state: DesignerState, nodeId: string, key: string, value: unknown): DesignerState => (
  designerReducer(state, { type: 'set-node-prop', nodeId, key, value })
);

export const disablePublishedFormAssist = (state: DesignerState): DesignerState => (
  setProp(state, state.document.rootNodeId, 'publishedFormAssist', false)
);

/**
 * Conditional visibility lives on `node.layout.visibleCondition`, not `node.props` — a plain
 * `setProp(..., 'visibleCondition', ...)` silently no-ops in Export (found live-testing CRM 3c:
 * the Opportunities Board/Table toggle rendered both views at once because the condition was
 * never actually stored anywhere the codegen/runtime reads).
 */
export const setVisibleCondition = (
  state: DesignerState,
  nodeId: string,
  visibleCondition: string,
): DesignerState => (
  designerReducer(state, { type: 'set-node-visible-condition', nodeId, visibleCondition })
);

export const styledLayout = (
  state: DesignerState,
  parentId: string,
  itemId: 'layout.flex-column' | 'layout.flex-row' | 'layout.grid-2' | 'layout.grid-3',
  className: string,
): { state: DesignerState; nodeId: string } => {
  const inserted = insert(state, itemId, parentId);
  return { state: setProp(inserted.state, inserted.nodeId, 'className', className), nodeId: inserted.nodeId };
};

/** Settings left-rail sections — vocab only (no empty General). */
export type CrmSettingsSectionId =
  | 'lead-sources'
  | 'ticket-priority'
  | 'ticket-channel'
  | 'customer-tags';

type CrmSettingsNavTone = 'emerald' | 'amber' | 'cyan' | 'violet';

const CRM_SETTINGS_NAV_ICON_CLASS: Record<CrmSettingsNavTone, string> = {
  emerald: '[&_svg]:text-emerald-600',
  amber: '[&_svg]:text-amber-600',
  cyan: '[&_svg]:text-cyan-600',
  violet: '[&_svg]:text-violet-600',
};

const CRM_SETTINGS_NAV_ACTIVE_CLASS: Record<CrmSettingsNavTone, string> = {
  emerald: 'bg-emerald-50/80 text-emerald-950 border-emerald-200 shadow-sm',
  amber: 'bg-amber-50/80 text-amber-950 border-amber-200 shadow-sm',
  cyan: 'bg-cyan-50/80 text-cyan-950 border-cyan-200 shadow-sm',
  violet: 'bg-violet-50/80 text-violet-950 border-violet-200 shadow-sm',
};

const CRM_SETTINGS_SECTION_NAV: Array<{
  id: CrmSettingsSectionId;
  label: string;
  href: string;
  icon: string;
  tone: CrmSettingsNavTone;
  separatorBefore?: boolean;
}> = [
  {
    id: 'lead-sources',
    label: 'Lead Sources',
    href: '/studio/crm/settings/lead-sources',
    icon: 'RadioTower',
    tone: 'emerald',
  },
  {
    id: 'ticket-priority',
    label: 'Ticket Priority',
    href: '/studio/crm/settings/ticket-priority',
    icon: 'SignalHigh',
    tone: 'amber',
    separatorBefore: true,
  },
  {
    id: 'ticket-channel',
    label: 'Ticket Channel',
    href: '/studio/crm/settings/ticket-channel',
    icon: 'MessagesSquare',
    tone: 'cyan',
  },
  {
    id: 'customer-tags',
    label: 'Customer Tags',
    href: '/studio/crm/settings/customer-tags',
    icon: 'Tags',
    tone: 'violet',
    separatorBefore: true,
  },
];

const CRM_SETTINGS_NAV_LINK_BASE =
  'workspace-section-nav-item relative inline-flex w-full items-center justify-start gap-3 rounded-lg border px-3 py-1.5 text-start text-sm font-medium no-underline outline-none transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0';

/**
 * App Settings–style shell: left section nav + main pane.
 * Call on an empty page root; returns the main pane to host section content.
 */
const mountCrmSettingsShell = (
  state: DesignerState,
  activeSectionId: CrmSettingsSectionId,
): { state: DesignerState; mainId: string } => {
  let next = setProp(
    state,
    state.document.rootNodeId,
    'className',
    'flex h-full min-h-0 w-full flex-col bg-slate-50 font-sans',
  );

  const workspace = styledLayout(
    next,
    next.document.rootNodeId,
    'layout.flex-row',
    'flex min-h-0 flex-1 items-stretch overflow-hidden',
  );
  next = workspace.state;

  const nav = styledLayout(
    next,
    workspace.nodeId,
    'layout.flex-column',
    'flex h-full min-h-0 w-[238px] shrink-0 self-stretch flex-col overflow-y-auto border-e border-slate-200 bg-slate-50 p-4',
  );
  next = nav.state;

  const navStack = styledLayout(next, nav.nodeId, 'layout.flex-column', 'flex flex-col space-y-0.5');
  next = navStack.state;

  for (const section of CRM_SETTINGS_SECTION_NAV) {
    if (section.separatorBefore) {
      const sep = styledLayout(
        next,
        navStack.nodeId,
        'layout.flex-column',
        'my-0.5 border-t border-slate-200/90',
      );
      next = sep.state;
    }

    const isActive = section.id === activeSectionId;
    const iconTone = CRM_SETTINGS_NAV_ICON_CLASS[section.tone];
    const linkNode = insert(next, 'heroui.button-outline', navStack.nodeId);
    next = setProp(linkNode.state, linkNode.nodeId, 'text', section.label);
    next = setProp(next, linkNode.nodeId, 'icon', section.icon);
    next = setProp(next, linkNode.nodeId, 'size', 'sm');
    next = setProp(next, linkNode.nodeId, 'type', 'button');
    next = setProp(next, linkNode.nodeId, 'aria-label', section.label);
    next = setProp(
      next,
      linkNode.nodeId,
      'className',
      isActive
        ? `${CRM_SETTINGS_NAV_LINK_BASE} workspace-section-nav-item-active ${CRM_SETTINGS_NAV_ACTIVE_CLASS[section.tone]} ${iconTone}`
        : `${CRM_SETTINGS_NAV_LINK_BASE} border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${iconTone}`,
    );
    const go = createDynamicAction('navigate');
    go.navigateTarget = section.href;
    next = designerReducer(next, {
      type: 'set-node-binding',
      nodeId: linkNode.nodeId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [go]),
    });
  }

  const main = styledLayout(
    next,
    workspace.nodeId,
    'layout.flex-column',
    'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white',
  );
  return { state: main.state, mainId: main.nodeId };
};

export const finalizeDocument = (state: DesignerState, name: string, folder: string): CrmDesignerDraftBundle => ({
  name,
  folder,
  document: { ...state.document, id: name, name },
  bindingDefinitions: state.bindingDefinitions,
});

export const finalizeBuiltDocument = (
  name: string,
  folder: string,
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): CrmDesignerDraftBundle => ({
  name,
  folder,
  document: { ...document, id: name, name },
  bindingDefinitions,
});

const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const value = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

export const findModalFormFieldsBodyId = (
  document: DesignerDocument,
  modalNodeId: string,
): string | null => {
  const modal = document.nodes[modalNodeId];
  if (!modal) {
    return null;
  }
  const formId = modal.children.find(
    (childId) => resolveNodePaletteItemId(document.nodes[childId]!) === 'html.form',
  );
  const form = formId ? document.nodes[formId] : undefined;
  return form?.children[0] ?? null;
};

export const patchDocumentPageShell = (document: DesignerDocument): DesignerDocument => {
  const root = document.nodes[document.rootNodeId];
  if (!root) {
    return document;
  }
  return {
    ...document,
    nodes: {
      ...document.nodes,
      [document.rootNodeId]: {
        ...root,
        props: {
          ...root.props,
          className: 'flex h-full min-h-0 w-full flex-col bg-white font-sans',
        },
      },
    },
  };
};

export const buildVocabDataSource = (
  title: string,
  categoryId: string,
  editable: boolean,
): DataSourceDefinition => ({
  id: 'vocabItems',
  name: title,
  endpoint: '/api/base-info',
  primaryKey: 'id',
  fields: ['id', 'title', 'short_name', 'view_order', 'is_active', 'parent_id', 'ui_color'],
  kind: 'collection',
  operations: editable
    ? {
      list: { method: 'GET', endpoint: `/api/base-info/children?parentId=${categoryId}&includeInactive=true` },
      detail: { method: 'GET', endpoint: '/api/base-info/:id' },
      create: { method: 'POST', endpoint: '/api/base-info' },
      update: { method: 'PUT', endpoint: '/api/base-info/:id' },
      delete: { method: 'DELETE', endpoint: '/api/base-info/:id' },
      custom: {
        move: { method: 'POST', endpoint: '/api/base-info/:id/move', label: 'Reorder sibling' },
      },
    }
    : {
      list: { method: 'GET', endpoint: `/api/base-info/children?parentId=${categoryId}&includeInactive=true` },
      detail: { method: 'GET', endpoint: '/api/base-info/:id' },
    },
  responseMapping: {
    arrayPath: 'items',
    totalPath: 'count',
    dataPath: 'items',
  },
});

const clearDesignerNodeChildren = (state: DesignerState, parentId: string): DesignerState => {
  const childIds = [...(state.document.nodes[parentId]?.children ?? [])];
  let next = state;
  for (const childId of childIds) {
    next = designerReducer(next, { type: 'remove-node', nodeId: childId });
  }
  return next;
};

export const setModalSize = (
  document: DesignerDocument,
  modalNodeId: string | null,
  size: string,
): DesignerDocument => {
  if (!modalNodeId) {
    return document;
  }
  const modal = document.nodes[modalNodeId];
  if (!modal) {
    return document;
  }
  return {
    ...document,
    nodes: {
      ...document.nodes,
      [modalNodeId]: {
        ...modal,
        props: { ...modal.props, size },
      },
    },
  };
};

export const mountVocabBaseInfoRecordForm = (
  state: DesignerState,
  modalNodeId: string | null,
  categoryLabel: string,
  categoryId: string,
  dataSourceRef: string,
): DesignerState => {
  if (!modalNodeId) {
    return state;
  }
  const bodyId = findModalFormFieldsBodyId(state.document, modalNodeId);
  if (!bodyId) {
    return state;
  }

  let next = clearDesignerNodeChildren(state, bodyId);
  next = setProp(next, bodyId, 'className', DESIGNER_MODAL_FORM_BODY_CONTENT_CLASS);

  const inserted = insert(next, 'form.base-info-record', bodyId);
  next = setProp(inserted.state, inserted.nodeId, 'baseInfoRecordFixedParentId', categoryId);
  next = setProp(next, inserted.nodeId, 'baseInfoRecordParentLabel', categoryLabel);
  next = setProp(next, inserted.nodeId, 'baseInfoRecordDataSourceRef', dataSourceRef);
  next = setProp(next, inserted.nodeId, 'className', 'w-full min-w-0');
  return next;
};

export const standardGrid = (
  state: DesignerState,
  parentId: string,
  dataSourceId: string,
  columns: DesignerDataGridColumn[],
  opts: {
    searchPlaceholder: string;
    resourceLabel: string;
    defaultSortBy?: string;
    primaryKey?: string;
    toolbarConfig?: DesignerGridToolbarConfig;
    presentation?: 'auto' | 'cards' | 'table';
    pagination?: boolean;
    pageSize?: number;
    /** Extra static/store-path list query params (e.g. `{ view: 'static:summary' }`). */
    listQueryParams?: Record<string, string>;
    /** URL path-template params (e.g. `{ id: 'routeParams.id' }` for `/api/x/:id/y`). */
    urlParams?: Record<string, string>;
  },
): { state: DesignerState; gridId: string } => {
  const { state: s1, nodeId: gridId } = insert(state, 'heroui.app-table-grid', parentId);
  let s = s1;
  const gridQueryStorePrefix = 'gridQuery';

  const toolbarConfig: DesignerGridToolbarConfig = opts.toolbarConfig ?? {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: opts.searchPlaceholder },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(columns),
    },
  };

  const listBinding = buildGridListBindingWithToolbarQueryParams(dataSourceId, toolbarConfig, {
    sourceType: 'store',
    storeWritePath: `${gridQueryStorePrefix}.sort`,
    dataPath: `${gridQueryStorePrefix}.page`,
    urlParams: opts.urlParams,
  });
  const serverQueryParams: Record<string, string> = {
    sortBy: `${gridQueryStorePrefix}.sortBy`,
    sortDir: `${gridQueryStorePrefix}.sortDir`,
    page: `${gridQueryStorePrefix}.page`,
    pageSize: `${gridQueryStorePrefix}.pageSize`,
  };
  s = designerReducer(s, {
    type: 'set-node-binding',
    nodeId: gridId,
    bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
    definition: {
      ...listBinding,
      queryParams: {
        ...(listBinding.queryParams ?? {}),
        ...serverQueryParams,
        ...(opts.listQueryParams ?? {}),
      },
    },
  });

  const sortableColumns = columns.filter((column) => column.sort);
  const defaultSortBy = opts.defaultSortBy ?? sortableColumns[0]?.key ?? '';
  const rowKeyField = opts.primaryKey?.trim() || 'id';
  const paginationEnabled = opts.pagination !== false;
  const pageSize = opts.pageSize ?? (paginationEnabled ? 50 : 100);

  s = setProp(s, gridId, 'className', 'flex h-full min-h-0 w-full flex-1 flex-col');
  s = setProp(s, gridId, 'columns', serializeDesignerDataGridColumns(columns));
  s = setProp(s, gridId, 'gridQueryMode', 'server');
  s = setProp(s, gridId, 'pageSize', pageSize);
  s = setProp(s, gridId, 'page', 1);
  s = setProp(s, gridId, 'total', 0);
  s = setProp(s, gridId, 'presentation', opts.presentation ?? 'auto');
  s = setProp(s, gridId, 'cardBelow', 'tablet');
  s = setProp(s, gridId, 'enableColumnLayout', false);
  // Footer sort field + direction (GridPagingFooter) — required whenever paging is on.
  s = setProp(s, gridId, 'showSortControls', paginationEnabled && sortableColumns.length > 0);
  s = setProp(s, gridId, 'showListModeControls', false);
  s = setProp(s, gridId, 'showPagingFooter', paginationEnabled);
  s = setProp(s, gridId, 'listMode', 'paging');
  s = setProp(s, gridId, 'rowKeyField', rowKeyField);
  if (defaultSortBy) {
    s = setProp(s, gridId, 'defaultSortBy', defaultSortBy);
  }
  if (sortableColumns.length > 0) {
    s = setProp(s, gridId, 'sortOptions', serializeDesignerGridSortOptions(
      sortableColumns.map((column) => ({ value: column.key, label: column.label || column.key })),
    ));
  }
  s = setProp(s, gridId, 'toolbarConfig', serializeDesignerGridToolbarConfig(toolbarConfig));
  s = setProp(s, gridId, 'loadingMessage', `Loading ${opts.resourceLabel}…`);
  s = setProp(s, gridId, 'emptyContent', `No ${opts.resourceLabel} found.`);
  s = setProp(s, gridId, 'errorContent', `Could not load ${opts.resourceLabel}.`);

  return { state: s, gridId };
};

// ---------------------------------------------------------------------------
// Vocabulary pages — Designer Records + form.base-info-record
// ---------------------------------------------------------------------------

export const buildCrmVocabularyPage = (input: {
  pageName: string;
  title: string;
  categoryId: string;
  settingsSectionId: CrmSettingsSectionId;
  editable?: boolean;
}): CrmDesignerDraftBundle => {
  const editable = input.editable ?? true;
  const dataSource = buildVocabDataSource(input.title, input.categoryId, editable);

  let state = createRecordsPageState(input.title);
  state = designerReducer(state, { type: 'set-data-source', dataSourceId: dataSource.id, dataSource });

  const shell = mountCrmSettingsShell(state, input.settingsSectionId);
  state = shell.state;

  const columns: DesignerDataGridColumn[] = [
    {
      key: 'ui_color',
      label: '',
      cellKind: 'color-swatch',
      cardRole: 'meta',
      cardPriority: -1,
    },
    { key: 'title', label: 'Title', sort: true, filter: true, filterType: 'text', cardRole: 'title' },
    { key: 'short_name', label: 'Short name', sort: true, filter: true, filterType: 'text', cardRole: 'hidden' },
    { key: 'view_order', label: 'Order', sort: true, cardRole: 'hidden' },
    { key: 'is_active', label: 'Active', sort: true, filter: true, filterType: 'boolean', cellKind: 'boolean-icon', cardRole: 'hidden' },
  ];

  const toolbarConfig: DesignerGridToolbarConfig = {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: `Search ${input.title.toLowerCase()}…` },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    create: editable
      ? { enabled: true, label: `Create ${input.title.replace(/s$/, '').toLowerCase()}`, icon: 'Plus', behavior: { kind: 'none' } }
      : undefined,
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(columns),
    },
  };

  const gridResult = standardGrid(state, shell.mainId, dataSource.id, columns, {
    searchPlaceholder: `Search ${input.title.toLowerCase()}…`,
    resourceLabel: input.title.toLowerCase(),
    defaultSortBy: 'view_order',
    primaryKey: 'id',
    toolbarConfig,
    presentation: 'cards',
    pagination: false,
    pageSize: 1000,
  });
  state = gridResult.state;

  if (!editable) {
    const bundle = finalizeDocument(state, input.pageName, FOLDER);
    return { ...bundle, document: patchDocumentPageShell(bundle.document) };
  }

  const built = appendRecordsCrudOverlays({
    state,
    gridNodeId: gridResult.gridId,
    dataSource,
    formFields: [],
    editFormFields: [],
    actions: { create: true, edit: true, delete: true },
    resourceLabel: input.title.replace(/s$/, ''),
    toolbarConfig,
  });
  state = built.state;
  state = mountVocabBaseInfoRecordForm(
    state,
    built.createModalNodeId,
    input.title,
    input.categoryId,
    dataSource.id,
  );
  state = mountVocabBaseInfoRecordForm(
    state,
    built.editModalNodeId,
    input.title,
    input.categoryId,
    dataSource.id,
  );

  let document = setModalSize(state.document, built.createModalNodeId, '5xl');
  document = setModalSize(document, built.editModalNodeId, '5xl');
  document = patchDocumentPageShell(document);
  return finalizeBuiltDocument(input.pageName, FOLDER, document, state.bindingDefinitions);
};

/**
 * Default Settings landing (`crm-settings`) — Lead Sources catalog (no empty General).
 */
export const buildCrmSettingsDraft = (input: {
  categoryId: string;
}): CrmDesignerDraftBundle => (
  buildCrmVocabularyPage({
    pageName: 'crm-settings',
    title: 'Lead Sources',
    categoryId: input.categoryId,
    settingsSectionId: 'lead-sources',
  })
);

// ---------------------------------------------------------------------------
// Shared deep-editor helpers (main/rail pattern, mirrors scripts/cms-phase3/cmsDesignerScaffold.ts)
// ---------------------------------------------------------------------------

export type CrmSectionTone = 'slate' | 'sky' | 'indigo' | 'amber' | 'emerald' | 'violet' | 'rose';

const CRM_META_VALUE_TONE_CLASS: Record<CrmSectionTone, string> = {
  slate: 'text-slate-800',
  sky: 'rounded-md border border-sky-200 bg-sky-50/70 px-2 py-1.5 text-sky-900',
  indigo: 'rounded-md border border-indigo-200 bg-indigo-50/70 px-2 py-1.5 text-indigo-900',
  amber: 'rounded-md border border-amber-200 bg-amber-50/70 px-2 py-1.5 text-amber-900',
  emerald: 'rounded-md border border-emerald-300 bg-emerald-50/70 px-2 py-1.5 text-emerald-950',
  violet: 'rounded-md border border-violet-200 bg-violet-50/70 px-2 py-1.5 text-violet-900',
  rose: 'rounded-md border border-rose-200 bg-rose-50/70 px-2 py-1.5 text-rose-900',
};

const CRM_SECTION_TONE_CLASS: Record<CrmSectionTone, { bar: string; title: string }> = {
  slate: { bar: 'border-slate-400', title: 'text-slate-700' },
  sky: { bar: 'border-sky-400', title: 'text-sky-700' },
  indigo: { bar: 'border-indigo-400', title: 'text-indigo-700' },
  amber: { bar: 'border-amber-400', title: 'text-amber-700' },
  emerald: { bar: 'border-emerald-600', title: 'text-emerald-800' },
  violet: { bar: 'border-violet-400', title: 'text-violet-700' },
  rose: { bar: 'border-rose-400', title: 'text-rose-700' },
};

export const bindValue = (
  state: DesignerState,
  nodeId: string,
  field: string,
  options: {
    nullable?: boolean;
    /** Explicit transform (e.g. 'commaSeparatedArray' for a hidden fixed-value field the API expects as an array). */
    payloadTransform?: import('../../src/domain/component-designer/types').PayloadFieldTransform;
  } = {},
): DesignerState => (
  designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('value'),
    definition: createRegionColumnBindingDefinition('value', field, {
      payloadTransform: options.payloadTransform ?? (options.nullable ? 'nullableString' : undefined),
    }),
  })
);

export const boundText = (
  state: DesignerState,
  parentId: string,
  field: string,
  className: string,
): DesignerState => {
  const { state: inserted, nodeId } = insert(state, 'html.text', parentId);
  let next = setProp(inserted, nodeId, 'text', '—');
  next = setProp(next, nodeId, 'className', className);
  return designerReducer(next, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('text'),
    definition: createRegionColumnBindingDefinition('text', field),
  });
};

export const metaField = (
  state: DesignerState,
  parentId: string,
  label: string,
  field: string,
  options: { mono?: boolean; tone?: CrmSectionTone; inline?: boolean } = {},
): DesignerState => {
  const row = styledLayout(
    state,
    parentId,
    options.inline ? 'layout.flex-row' : 'layout.flex-column',
    options.inline
      ? 'flex min-w-0 items-center justify-between gap-3 overflow-hidden ps-[4px]'
      : 'flex min-w-0 flex-col gap-[2px] overflow-hidden ps-[4px]',
  );
  const labelNode = insert(row.state, 'html.text', row.nodeId);
  let next = setProp(labelNode.state, labelNode.nodeId, 'text', label);
  next = setProp(
    next,
    labelNode.nodeId,
    'className',
    'text-[11px] font-normal normal-case tracking-normal text-slate-500',
  );
  const toneClass = CRM_META_VALUE_TONE_CLASS[options.tone ?? 'slate'];
  return boundText(
    next,
    row.nodeId,
    field,
    `min-w-0 overflow-hidden break-words text-[11px] font-bold ${toneClass}${options.inline ? ' text-end' : ''}${options.mono ? ' font-mono' : ''}`,
  );
};

/** Flat FormSection-compatible group — bordered accent bar, no card wrapper (P9 rule). */
export const formSection = (
  state: DesignerState,
  parentId: string,
  title: string,
  tone: CrmSectionTone,
  divided = false,
): { state: DesignerState; sectionId: string; headerId: string; bodyId: string } => {
  const section = styledLayout(
    state,
    parentId,
    'layout.flex-column',
    `flex flex-col space-y-2${divided ? ' pt-3' : ''}`,
  );
  const header = styledLayout(
    section.state,
    section.nodeId,
    'layout.flex-row',
    'flex min-h-4 items-center gap-0.5 ps-[4px]',
  );
  const titleNode = insert(header.state, 'html.text', header.nodeId);
  let next = setProp(titleNode.state, titleNode.nodeId, 'text', title);
  next = setProp(
    next,
    titleNode.nodeId,
    'className',
    `border-s-2 ps-1.5 text-[11px] font-bold uppercase tracking-wider leading-none ${CRM_SECTION_TONE_CLASS[tone].title} ${CRM_SECTION_TONE_CLASS[tone].bar}`,
  );
  const body = styledLayout(next, section.nodeId, 'layout.flex-column', 'flex flex-col gap-2');
  return { state: body.state, sectionId: section.nodeId, headerId: header.nodeId, bodyId: body.nodeId };
};

export const prepareGridSlots = (
  state: DesignerState,
  gridNodeId: string,
): { state: DesignerState; slotIds: string[] } => {
  const slotIds = (state.document.nodes[gridNodeId]?.children ?? []).filter(
    (childId) => state.document.nodes[childId]?.props._designerLayoutSlot === true,
  );
  if (slotIds.length < 2) {
    throw new Error(`Expected two layout slots under ${gridNodeId}.`);
  }
  let next = state;
  for (const slotId of slotIds) {
    next = setProp(next, slotId, 'className', 'min-h-0 min-w-0 overflow-hidden');
  }
  return { state: next, slotIds };
};

export const textField = (
  state: DesignerState,
  parentId: string,
  field: string,
  label: string,
  opts: {
    multiline?: boolean;
    hidden?: boolean;
    readOnly?: boolean;
    rows?: number;
  } = {},
): DesignerState => {
  const paletteId = opts.multiline ? 'heroui.textarea' : 'heroui.input-text';
  const { state: s1, nodeId } = insert(state, paletteId, parentId);
  let s2 = setProp(s1, nodeId, 'label', opts.hidden ? '' : label);
  if (opts.hidden) s2 = setProp(s2, nodeId, 'className', 'hidden');
  if (opts.readOnly) s2 = setProp(s2, nodeId, 'readOnly', true);
  if (opts.rows) s2 = setProp(s2, nodeId, 'rows', opts.rows);
  s2 = bindValue(s2, nodeId, field);
  return s2;
};

export const selectField = (
  state: DesignerState,
  parentId: string,
  field: string,
  label: string,
  options: Array<{ value: string; label: string }>,
  config: { placeholder?: string; nullable?: boolean } = {},
): DesignerState => {
  const { state: inserted, nodeId } = insert(state, 'heroui.select', parentId);
  let next = setProp(inserted, nodeId, 'label', label);
  next = setProp(next, nodeId, 'placeholder', config.placeholder ?? 'Select…');
  next = setProp(next, nodeId, 'items', JSON.stringify(
    options.map((option) => ({ id: option.value, textValue: option.label })),
  ));
  next = setProp(next, nodeId, 'className', 'w-full');
  next = designerReducer(next, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('selectedKeys'),
    definition: createRegionColumnBindingDefinition('selectedKeys', field, {
      payloadTransform: config.nullable ? 'nullableString' : undefined,
    }),
  });
  return next;
};

/** Rail "clickable placeholder" — dashed empty state that doubles as a compact bound preview. */
export const clickableNoteField = (
  state: DesignerState,
  parentId: string,
  field: string,
  emptyText: string,
): { state: DesignerState; triggerNodeId: string } => {
  const trigger = insert(state, 'heroui.button-outline', parentId);
  let next = setProp(trigger.state, trigger.nodeId, 'text', emptyText);
  next = setProp(next, trigger.nodeId, 'type', 'button');
  next = setProp(next, trigger.nodeId, 'directionalText', true);
  next = setProp(
    next,
    trigger.nodeId,
    'className',
    'flex min-h-11 h-auto w-full cursor-pointer items-start justify-start whitespace-pre-wrap rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-start text-xs font-normal leading-relaxed text-slate-700 outline-none transition-colors hover:border-slate-300 hover:bg-slate-50',
  );
  next = stripOutlineButtonLinkChrome(next, trigger.nodeId);
  next = designerReducer(next, {
    type: 'set-node-binding',
    nodeId: trigger.nodeId,
    bindingKey: propertyBindingKeyForProp('text'),
    definition: createRegionColumnBindingDefinition('text', field),
  });
  return { state: next, triggerNodeId: trigger.nodeId };
};

/** Palette `heroui.button-outline` defaults to `href="#"` + link chrome — strip for onClick-only use. */
export const stripOutlineButtonLinkChrome = (state: DesignerState, nodeId: string): DesignerState => {
  let next = setProp(state, nodeId, 'href', '');
  next = setProp(next, nodeId, 'target', '');
  next = setProp(next, nodeId, 'rel', '');
  return next;
};

export const buildSubmitSuccessActions = (
  successToast: string,
  refreshDataSourceId?: string,
): import('../../src/domain/component-designer/types').DesignerDynamicAction[] => {
  const trueActions: import('../../src/domain/component-designer/types').DesignerDynamicAction[] = [];
  const toast = createDynamicAction('showToast');
  toast.toastTitle = successToast;
  toast.toastVariant = 'success';
  trueActions.push(toast);
  if (refreshDataSourceId) {
    const refresh = createDynamicAction('refreshDataSource');
    refresh.dataSourceRef = refreshDataSourceId;
    trueActions.push(refresh);
  }
  return trueActions;
};

export const submitButton = (
  state: DesignerState,
  parentId: string,
  text: string,
  className = 'bg-sky-600 text-white',
  options: { successToast?: string; refreshDataSourceId?: string } = {},
): DesignerState => {
  const trueActions = options.successToast
    ? buildSubmitSuccessActions(options.successToast, options.refreshDataSourceId)
    : [];
  const { state: s1, nodeId } = insert(state, 'heroui.button-solid', parentId);
  let s2 = setProp(s1, nodeId, 'text', text);
  s2 = setProp(s2, nodeId, 'className', className);
  s2 = designerReducer(s2, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createRegionSubmitEventBindingDefinition('onClick', {
      trueActions: trueActions.length > 0 ? trueActions : undefined,
    }),
  });
  return s2;
};

/** Registers a REST data source (list/detail/create/update/delete endpoints). */
export const setDataSource = (
  state: DesignerState,
  dataSourceId: string,
  name: string,
  config: {
    endpoint: string;
    primaryKey?: string;
    fields: string[];
    operations: {
      list?: { method: 'GET'; endpoint: string };
      detail?: { method: 'GET'; endpoint: string };
      create?: { method: 'POST'; endpoint: string };
      // 'POST' is legit here too: a POST-only named action (e.g. Tickets assign/reply) declared
      // as the region's `update` op so regionSubmit codegen resolves its `:id` path param off the
      // region's own fetched detail record. See crmTicketsScaffold.ts's TICKETS_ASSIGN_DATA_SOURCE.
      update?: { method: 'PUT' | 'PATCH' | 'POST'; endpoint: string };
      delete?: { method: 'DELETE'; endpoint: string };
      custom?: Record<string, { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; endpoint: string; label?: string }>;
    };
    arrayPath?: string;
  },
): DesignerState => designerReducer(state, {
  type: 'set-data-source',
  dataSourceId,
  dataSource: {
    id: dataSourceId,
    name,
    endpoint: config.endpoint,
    primaryKey: config.primaryKey,
    fields: config.fields,
    kind: 'collection',
    operations: config.operations,
    responseMapping: {
      arrayPath: config.arrayPath ?? 'data',
      totalPath: 'count',
      dataPath: config.arrayPath ?? 'data',
    },
  },
});

export const navigateBehavior = (target: string, replace = false): DesignerGridRowActionBehavior => ({
  kind: 'navigate',
  navigateTarget: target,
  navigateReplace: replace,
});

export const openModalBehavior = (modalNodeId: string, primaryKey = 'id'): DesignerGridRowActionBehavior => ({
  kind: 'open-modal',
  modalNodeId,
  primaryKeyField: primaryKey,
  selectionStorePath: `selection.${primaryKey}`,
});

/** Bind a container (identity bar, `html.form`, …) to a detail fetch keyed by a route param. */
export const bindRegionDetail = (
  state: DesignerState,
  nodeId: string,
  dataSourceId: string,
  urlParams: Record<string, string>,
): DesignerState => designerReducer(state, {
  type: 'set-node-binding',
  nodeId,
  bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
  definition: createRegionDataSourceBindingDefinition(dataSourceId, { loadOperation: 'detail', urlParams }),
});

/**
 * Chain extra trueActions (e.g. a second `callMutation`, then `navigate`) onto a just-built
 * standalone create modal's regionSubmit binding, and set `responseStorePath` so those actions
 * can read the create response's fields via `{path.to.field}` templates. Generalizes the single
 * `createNavigateTarget` patch `appendRecordsCrudOverlays` does internally (designerRecordsPageBuilder.ts)
 * to an arbitrary ordered action list — needed for CRM's two-step "create user, then create the
 * crm_customers extension row" flow (edge-domain-action sandbox cannot call POST /api/users itself,
 * see plan §شکل API "Customer create").
 */
export const chainCreateSuccessActions = (
  document: DesignerDocument,
  responseStorePath: string,
  extraTrueActions: import('../../src/domain/component-designer/types').DesignerDynamicAction[],
): DesignerDocument => ({
  ...document,
  nodes: Object.fromEntries(Object.entries(document.nodes).map(([nodeId, node]) => {
    if (!Object.values(node.binding).some((definition) => definition?.regionSubmit === true)) {
      return [nodeId, node];
    }
    return [
      nodeId,
      {
        ...node,
        binding: Object.fromEntries(Object.entries(node.binding).map(([key, definition]) => (
          definition?.regionSubmit === true
            ? [
              key,
              {
                ...definition,
                responseStorePath,
                trueActions: [...(definition.trueActions ?? []), ...extraTrueActions],
              },
            ]
            : [key, definition]
        ))),
      },
    ];
  })),
});

