/**
 * CRM زیرفاز 3c — Opportunities: Kanban (default) + grid toggle + deep editor.
 * File structure copied from `crmCustomersScaffold.ts` (the golden reference), per plan
 * §package-ui P11 — not a new invention.
 *
 * Known, documented simplifications (backlog, not silent gaps):
 * - Drag → drop fires `change-stage` directly, with NO confirm dialog for Won/Lost — the
 *   Designer dynamic-action system has no conditional branching on event-payload values (e.g.
 *   "only confirm when toColumnId is a terminal stage"), so a confirm-gate would have had to
 *   fire on EVERY drop, which is worse UX than the plan's Won/Lost-only intent. The already-built
 *   `Reopen` action covers the undo case; the 3c-pre `revertSignal` mechanism is available in
 *   the platform whenever a real confirm-gate is added.
 * - **Rich cards (customer avatar · amount badge · days-in-stage · close-date accent) are NOT
 *   wired in this pass.** `GET /api/crm/opportunities/board` (Phase 2) already returns fully
 *   shaped `UiKanbanCard` data (badges/avatar/meta/accent) and `UiKanbanBoard`/`DesignerRuntimeKanban`
 *   (3c-pre) already render those fields — but the Designer's `viz.kanban` node only accepts bound
 *   `data` through `createVizDataResourceBindingDefinition` + `DesignerVizFieldMapping` (kind
 *   `'kanban'`), whose mapping fields are limited to `cardIdField`/`cardTitleField`/
 *   `cardColumnField`/`cardDescriptionField`/`columnOrder` — no badge/avatar/meta/accent mapping
 *   exists in `visualizationDataTransform.ts`. This board therefore uses the proven generic path
 *   (flat `crm-opportunities` list + kanban field mapping) with title + customer-name-as-description
 *   only. Extending `DesignerVizKanbanFieldMapping` to map those richer fields (and switching this
 *   board to bind the already-built `/board` endpoint) is a scoped follow-up, not a silent gap —
 *   the underlying capability is real and already tested (3c-pre).
 * - Customer picker in the Create dialog is a plain "customer user id" text field (same
 *   pragmatic fallback already used for the Customers Merge modal) — not a searchable lookup.
 */

import { designerReducer } from '../../src/domain/component-designer/state';
import type {
  DataSourceDefinition,
  DesignerState,
} from '../../src/domain/component-designer/types';
import {
  createRecordsPageState,
  appendRecordsCrudOverlays,
} from './designerRecordsPageBuilder';
import {
  buildServerQueryColumnFiltersFromGridColumns,
  DEFAULT_GRID_SERVER_QUERY_CONFIG,
  DEFAULT_GRID_TOOLBAR_REFRESH,
  DEFAULT_GRID_TOOLBAR_SEARCH,
  type DesignerGridToolbarConfig,
} from '../../src/domain/component-designer/designerGridToolbarConfig';
import type { DesignerDataGridColumn } from '../../src/domain/component-designer/designerDataGridColumns';
import {
  createDynamicAction,
  createDynamicActionsEventBindingDefinition,
} from '../../src/domain/component-designer/bindingDynamicActionsEngine';
import { eventBindingKeyForEvent } from '../../src/domain/component-designer/bindingEngine';
import { createRegionSubmitEventBindingDefinition } from '../../src/domain/component-designer/bindingRegionEngine';
import { buildVizBindingWizardActions } from '../../src/domain/component-designer/bindingVizEngine';
import type { DesignerVizFieldMapping } from '../../src/domain/component-designer/visualizationDataTransform';
import type { CrmFilterOptions } from './crmIds';
import {
  insert,
  setProp,
  styledLayout,
  finalizeBuiltDocument,
  patchDocumentPageShell,
  type CrmDesignerDraftBundle,
  boundText,
  metaField,
  formSection,
  prepareGridSlots,
  textField,
  stripOutlineButtonLinkChrome,
  setDataSource,
  standardGrid,
  bindRegionDetail,
  setVisibleCondition,
} from './crmDesignerScaffold';

const FOLDER = 'crm';

const OPPORTUNITIES_LIST_DATA_SOURCE = {
  id: 'crmOpportunitiesList',
  name: 'CRM Opportunities',
  endpoint: '/api/crm/opportunities',
  primaryKey: 'id',
  fields: [
    'id', 'customerUserId', 'title', 'stageCode', 'stageCodeTitle', 'amount',
    'expectedCloseDate', 'closedAt', 'ownerId', 'ownerIdUsername',
    'customerUserIdUsername', 'customerUserIdFirstname', 'customerUserIdLastname', 'updatedAt',
  ],
};

const OPPORTUNITIES_DETAIL_DATA_SOURCE = {
  id: 'crmOpportunitiesDetail',
  name: 'CRM Opportunities (detail)',
  endpoint: '/api/crm/opportunities',
  primaryKey: 'id',
  fields: [
    'id', 'title', 'amount', 'expectedCloseDate', 'closedAt', 'note',
    'stageCode', 'stageCodeTitle', 'ownerId', 'ownerIdUsername',
    'customerUserId', 'customerUserIdUsername',
    'createdAt', 'createdByUsername', 'updatedAt', 'updatedByUsername',
  ],
};

const OPPORTUNITIES_CHANGE_STAGE_DATA_SOURCE = {
  id: 'crmOpportunitiesChangeStage',
  name: 'CRM Opportunities (change stage)',
  endpoint: '/api/crm/opportunities/:id/change-stage',
};

const OPPORTUNITIES_REOPEN_DATA_SOURCE = {
  id: 'crmOpportunitiesReopen',
  name: 'CRM Opportunities (reopen)',
  endpoint: '/api/crm/opportunities/:id/reopen',
};

const registerOpportunitiesDataSources = (state: DesignerState): DesignerState => {
  let next = setDataSource(state, OPPORTUNITIES_LIST_DATA_SOURCE.id, OPPORTUNITIES_LIST_DATA_SOURCE.name, {
    endpoint: OPPORTUNITIES_LIST_DATA_SOURCE.endpoint,
    primaryKey: OPPORTUNITIES_LIST_DATA_SOURCE.primaryKey,
    fields: OPPORTUNITIES_LIST_DATA_SOURCE.fields,
    operations: {
      list: { method: 'GET', endpoint: '/api/crm/opportunities' },
      create: { method: 'POST', endpoint: '/api/crm/opportunities' },
    },
  });
  next = setDataSource(next, OPPORTUNITIES_DETAIL_DATA_SOURCE.id, OPPORTUNITIES_DETAIL_DATA_SOURCE.name, {
    endpoint: '/api/crm/opportunities/:id',
    primaryKey: OPPORTUNITIES_DETAIL_DATA_SOURCE.primaryKey,
    fields: OPPORTUNITIES_DETAIL_DATA_SOURCE.fields,
    operations: {
      detail: { method: 'GET', endpoint: '/api/crm/opportunities/:id' },
      update: { method: 'PATCH', endpoint: '/api/crm/opportunities/:id' },
    },
  });
  next = setDataSource(next, OPPORTUNITIES_CHANGE_STAGE_DATA_SOURCE.id, OPPORTUNITIES_CHANGE_STAGE_DATA_SOURCE.name, {
    endpoint: OPPORTUNITIES_CHANGE_STAGE_DATA_SOURCE.endpoint,
    fields: ['toStageCode'],
    operations: { create: { method: 'POST', endpoint: '/api/crm/opportunities/:id/change-stage' } },
  });
  next = setDataSource(next, OPPORTUNITIES_REOPEN_DATA_SOURCE.id, OPPORTUNITIES_REOPEN_DATA_SOURCE.name, {
    endpoint: OPPORTUNITIES_REOPEN_DATA_SOURCE.endpoint,
    fields: [],
    operations: { create: { method: 'POST', endpoint: '/api/crm/opportunities/:id/reopen' } },
  });
  return next;
};

/**
 * Flips a plain boolean store flag (not a real node's own visibility — `showHide` actions only
 * work for that, since `resolveDynamicActions` derives the store path from `targetNodeId` and
 * drops the action entirely when it's unset; found live-testing, see `wireOpenModal` in
 * crmCustomersScaffold.ts for the full writeup). `targetNodeId` is required for `setValue` to
 * resolve at all too, but an explicit `storePath` always wins over the node-derived default, so
 * `anchorNodeId` here is just a harmless satisfy-the-check placeholder.
 */
const toggleFlag = (anchorNodeId: string, storePath: string) => {
  const action = createDynamicAction('setValue');
  action.targetNodeId = anchorNodeId;
  action.storePath = storePath;
  action.valueSource = 'expression';
  action.valueExpression = `!store.${storePath}`;
  return action;
};

export const buildCrmOpportunitiesListDraft = (input: {
  filterOptions: CrmFilterOptions;
}): CrmDesignerDraftBundle => {
  const newStage = input.filterOptions.pipelineStages.find((stage) => stage.label === 'New');
  if (!newStage) {
    throw new Error('Pipeline Stages "New" option missing — run npm run crm:phase1 first.');
  }
  const newStageId = newStage.value;

  let state = createRecordsPageState('Opportunities');
  state = registerOpportunitiesDataSources(state);
  state = setProp(state, state.document.rootNodeId, 'className', 'flex h-full min-h-0 w-full flex-col bg-white');

  // Toolbar row: view toggle (Board/Table) + Create.
  const toolbarRow = styledLayout(
    state,
    state.document.rootNodeId,
    'layout.flex-row',
    'flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-5',
  );
  state = toolbarRow.state;

  const toggleButton = insert(state, 'heroui.button-outline', toolbarRow.nodeId);
  state = setProp(toggleButton.state, toggleButton.nodeId, 'text', 'Toggle Board / Table');
  state = setProp(state, toggleButton.nodeId, 'icon', 'LayoutGrid');
  state = setProp(state, toggleButton.nodeId, 'size', 'sm');
  state = setProp(state, toggleButton.nodeId, 'type', 'button');
  state = stripOutlineButtonLinkChrome(state, toggleButton.nodeId);
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: toggleButton.nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createDynamicActionsEventBindingDefinition('onClick', [toggleFlag(toggleButton.nodeId, 'opportunitiesShowGrid')]),
  });

  const createButton = insert(state, 'heroui.button-solid', toolbarRow.nodeId);
  state = setProp(createButton.state, createButton.nodeId, 'text', 'Create opportunity');
  state = setProp(state, createButton.nodeId, 'icon', 'Plus');
  state = setProp(state, createButton.nodeId, 'size', 'sm');
  state = setProp(state, createButton.nodeId, 'type', 'button');
  state = setProp(state, createButton.nodeId, 'className', 'bg-sky-600 text-white hover:bg-sky-700');
  // onClick wired below once the Create overlay exists and its real modalNodeId is known.

  // Board container — visible unless opportunitiesShowGrid is true.
  const boardHost = styledLayout(state, state.document.rootNodeId, 'layout.flex-column', 'flex min-h-0 w-full flex-1 flex-col overflow-hidden p-3');
  state = boardHost.state;
  state = setVisibleCondition(state, boardHost.nodeId, 'store.opportunitiesShowGrid !== true');

  const kanban = insert(state, 'viz.kanban', boardHost.nodeId);
  state = kanban.state;
  state = setProp(state, kanban.nodeId, 'title', '');
  state = setProp(state, kanban.nodeId, 'className', 'w-full h-full');
  state = setProp(state, kanban.nodeId, 'showCardCount', true);
  state = setProp(state, kanban.nodeId, 'showDescriptions', true);
  state = setProp(state, kanban.nodeId, 'columnLayout', 'fill');
  state = setProp(state, kanban.nodeId, 'height', 'full');

  // Proven generic viz-data-binding path (see file header note on why the richer `/board`
  // endpoint isn't wired here yet): flat `crm-opportunities` list + a `kanban` field mapping
  // that groups rows by `stageCode` into columns, in Pipeline Stages view-order.
  const kanbanFieldMapping: DesignerVizFieldMapping = {
    kind: 'kanban',
    cardIdField: 'id',
    cardTitleField: 'title',
    cardColumnField: 'stageCode',
    cardDescriptionField: 'customerUserIdUsername',
    columnOrder: input.filterOptions.pipelineStages.map((stage) => ({ id: stage.value, title: stage.label })),
  };
  const kanbanListDataSource: DataSourceDefinition = {
    id: OPPORTUNITIES_LIST_DATA_SOURCE.id,
    name: OPPORTUNITIES_LIST_DATA_SOURCE.name,
    endpoint: OPPORTUNITIES_LIST_DATA_SOURCE.endpoint,
    primaryKey: OPPORTUNITIES_LIST_DATA_SOURCE.primaryKey,
    fields: OPPORTUNITIES_LIST_DATA_SOURCE.fields,
    kind: 'collection',
    operations: {
      list: { method: 'GET', endpoint: '/api/crm/opportunities' },
      create: { method: 'POST', endpoint: '/api/crm/opportunities' },
    },
    responseMapping: { arrayPath: 'data', totalPath: 'count', dataPath: 'data' },
  };
  for (const action of buildVizBindingWizardActions(state.document.nodes[kanban.nodeId]!, kanbanListDataSource, { fieldMapping: kanbanFieldMapping })) {
    state = designerReducer(state, action);
  }

  const changeStageMutation = createDynamicAction('callMutation');
  changeStageMutation.dataSourceRef = OPPORTUNITIES_CHANGE_STAGE_DATA_SOURCE.id;
  changeStageMutation.mutationOperation = 'create';
  changeStageMutation.mutationRecordIdStorePath = 'board.lastMove.cardId';
  changeStageMutation.mutationBody = { toStageCode: '{board.lastMove.toColumnId}' };
  const refreshBoard = createDynamicAction('refreshDataSource');
  refreshBoard.dataSourceRef = OPPORTUNITIES_LIST_DATA_SOURCE.id;
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: kanban.nodeId,
    bindingKey: eventBindingKeyForEvent('onCardMove'),
    definition: {
      sourceType: 'static',
      bindingRole: 'event',
      targetEvent: 'onCardMove',
      storeWritePath: 'board.lastMove',
      trueActions: [changeStageMutation, refreshBoard],
    } as never,
  });

  // Grid container — visible only when opportunitiesShowGrid is true.
  const gridHost = styledLayout(state, state.document.rootNodeId, 'layout.flex-column', 'flex min-h-0 w-full flex-1 flex-col');
  state = gridHost.state;
  state = setVisibleCondition(state, gridHost.nodeId, 'store.opportunitiesShowGrid === true');

  const columns: DesignerDataGridColumn[] = [
    {
      key: 'title', label: 'Title', sort: true, filter: true, filterType: 'text', cardRole: 'title',
      cellKind: 'link', cellFields: { labelField: 'title', hrefTemplate: '/studio/crm/opportunities/edit/{id}' },
    } as DesignerDataGridColumn,
    { key: 'customerUserIdUsername', label: 'Customer', cardRole: 'meta' },
    { key: 'stageCodeTitle', label: 'Stage', cellKind: 'status-badge', cardRole: 'meta' } as DesignerDataGridColumn,
    { key: 'amount', label: 'Amount', sort: true, cardRole: 'meta' },
    { key: 'expectedCloseDate', label: 'Expected close', sort: true, cellKind: 'date', cardRole: 'meta' } as DesignerDataGridColumn,
    { key: 'ownerIdUsername', label: 'Owner', cardRole: 'meta' },
    { key: 'updatedAt', label: 'Updated', sort: true, cellKind: 'date', cardRole: 'meta' } as DesignerDataGridColumn,
  ];
  const toolbarConfig: DesignerGridToolbarConfig = {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: 'Search opportunities…' },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(columns),
    },
  };
  const gridResult = standardGrid(state, gridHost.nodeId, OPPORTUNITIES_LIST_DATA_SOURCE.id, columns, {
    searchPlaceholder: 'Search opportunities…',
    resourceLabel: 'opportunities',
    defaultSortBy: 'updatedAt',
    primaryKey: 'id',
    toolbarConfig,
    presentation: 'auto',
    pagination: true,
    pageSize: 50,
  });
  state = gridResult.state;

  // Create modal — standard grid-CRUD overlay, wired to the toggle button above (not the grid's
  // own toolbar create slot, since Create must work from both Board and Table views).
  const built = appendRecordsCrudOverlays({
    state,
    gridNodeId: gridResult.gridId,
    dataSource: {
      id: OPPORTUNITIES_LIST_DATA_SOURCE.id,
      name: OPPORTUNITIES_LIST_DATA_SOURCE.name,
      endpoint: OPPORTUNITIES_LIST_DATA_SOURCE.endpoint,
      primaryKey: OPPORTUNITIES_LIST_DATA_SOURCE.primaryKey,
      fields: OPPORTUNITIES_LIST_DATA_SOURCE.fields,
      kind: 'collection',
      operations: {
        list: { method: 'GET', endpoint: '/api/crm/opportunities' },
        create: { method: 'POST', endpoint: '/api/crm/opportunities' },
      },
      responseMapping: { arrayPath: 'data', totalPath: 'count', dataPath: 'data' },
    },
    formFields: [
      { field: { name: 'customerUserId', type: 'string', location: 'body', required: true }, enabled: true, label: 'Customer user id', controlPaletteItemId: 'heroui.input-text' },
      { field: { name: 'title', type: 'string', location: 'body', required: true }, enabled: true, label: 'Title', controlPaletteItemId: 'heroui.input-text' },
      { field: { name: 'amount', type: 'number', location: 'body', required: false }, enabled: true, label: 'Amount', controlPaletteItemId: 'heroui.input-text', controlProps: { type: 'number' } },
      // Default stage = New (plan §صفحهٔ لیست Opportunities). Without this, create posts
      // stageCode: null and the card is invisible on every Kanban column (confirmed live before
      // this fix — a real bug, not a hypothetical).
      {
        field: { name: 'stageCode', type: 'string', location: 'body', required: false },
        enabled: true,
        label: '',
        controlPaletteItemId: 'heroui.input-text',
        controlProps: { value: newStageId, className: 'hidden' },
      },
    ],
    actions: { create: true, edit: false, delete: false },
    resourceLabel: 'opportunity',
    createResponseStorePath: 'newOpportunity',
    createNavigateTarget: '/studio/crm/opportunities/edit/{newOpportunity.data.id}',
  });
  state = built.state;

  // Wire the toolbar Create button (not the grid's own, unused, toolbar) to open this modal.
  if (built.createModalNodeId) {
    const openCreate = createDynamicAction('showHide');
    openCreate.targetNodeId = built.createModalNodeId;
    openCreate.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: createButton.nodeId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [openCreate]),
    });
  }

  const document = patchDocumentPageShell(state.document);
  return finalizeBuiltDocument('crm-opportunities', FOLDER, document, state.bindingDefinitions);
};

// ---------------------------------------------------------------------------
// Deep editor — main (Deal + Note) + rail (Identity/Audit/Stage)
// ---------------------------------------------------------------------------

export const buildCrmOpportunitiesEditorDraft = (): CrmDesignerDraftBundle => {
  let state = createRecordsPageState('Opportunity Editor');
  state = registerOpportunitiesDataSources(state);
  state = setProp(state, state.document.rootNodeId, 'publishedFormAssist', false);

  const page = styledLayout(state, state.document.rootNodeId, 'layout.flex-column', 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white');
  state = page.state;

  const actionBar = styledLayout(state, page.nodeId, 'layout.flex-row', 'flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5');
  state = actionBar.state;
  state = bindRegionDetail(state, actionBar.nodeId, OPPORTUNITIES_DETAIL_DATA_SOURCE.id, { id: 'routeParams.id' });

  const backButton = insert(state, 'heroui.button-outline', actionBar.nodeId);
  state = setProp(backButton.state, backButton.nodeId, 'workspaceBack', true);
  state = setProp(state, backButton.nodeId, 'aria-label', 'Back to Opportunities');
  state = setProp(state, backButton.nodeId, 'className', '');
  const backNavigate = createDynamicAction('navigate');
  backNavigate.navigateTarget = '/studio/crm/opportunities';
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: backButton.nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createDynamicActionsEventBindingDefinition('onClick', [backNavigate]),
  });

  const identityCluster = styledLayout(state, actionBar.nodeId, 'layout.flex-row', 'flex min-w-0 flex-1 items-center gap-2 overflow-hidden');
  state = identityCluster.state;
  state = boundText(state, identityCluster.nodeId, 'title', 'm-0 min-w-0 truncate text-sm font-semibold leading-none text-slate-800');
  const idSep = insert(state, 'html.text', identityCluster.nodeId);
  state = setProp(idSep.state, idSep.nodeId, 'text', '·');
  state = setProp(state, idSep.nodeId, 'className', 'shrink-0 text-slate-300');
  state = boundText(state, identityCluster.nodeId, 'id', 'm-0 shrink-0 font-mono text-xs font-medium leading-none text-slate-500');

  const reopenButton = insert(state, 'heroui.button-outline', actionBar.nodeId);
  state = setProp(reopenButton.state, reopenButton.nodeId, 'text', 'Reopen');
  state = setProp(state, reopenButton.nodeId, 'icon', 'RotateCcw');
  state = setProp(state, reopenButton.nodeId, 'size', 'sm');
  state = setProp(state, reopenButton.nodeId, 'type', 'button');
  state = stripOutlineButtonLinkChrome(state, reopenButton.nodeId);
  const reopenMutation = createDynamicAction('callMutation');
  reopenMutation.dataSourceRef = OPPORTUNITIES_REOPEN_DATA_SOURCE.id;
  reopenMutation.mutationOperation = 'create';
  reopenMutation.mutationRecordIdStorePath = 'routeParams.id';
  const reopenToast = createDynamicAction('showToast');
  reopenToast.toastTitle = 'Opportunity reopened.';
  reopenToast.toastVariant = 'success';
  const reopenRefresh = createDynamicAction('refreshDataSource');
  reopenRefresh.dataSourceRef = OPPORTUNITIES_DETAIL_DATA_SOURCE.id;
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: reopenButton.nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createDynamicActionsEventBindingDefinition('onClick', [reopenMutation, reopenToast, reopenRefresh]),
  });

  const saveButton = insert(state, 'heroui.button-solid', actionBar.nodeId);
  state = setProp(saveButton.state, saveButton.nodeId, 'text', 'Save');
  state = setProp(state, saveButton.nodeId, 'type', 'submit');
  state = setProp(state, saveButton.nodeId, 'form', 'crm-opportunity-editor-form');
  state = setProp(state, saveButton.nodeId, 'className', 'bg-sky-600 text-white hover:bg-sky-700');

  const workspace = styledLayout(state, page.nodeId, 'layout.grid-2', 'grid min-h-0 flex-1 gap-0 overflow-hidden bg-white');
  state = setProp(workspace.state, workspace.nodeId, 'layoutGridColumnWidths', JSON.stringify([{ value: '1', unit: 'fr' }, { value: '320', unit: 'px' }]));
  const slots = prepareGridSlots(state, workspace.nodeId);
  state = slots.state;

  const sidebar = styledLayout(
    state,
    slots.slotIds[1]!,
    'layout.flex-column',
    'flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-y-auto border-s border-slate-200 bg-slate-50 px-3 pb-4 pt-[10px]',
  );
  state = sidebar.state;

  const identitySection = formSection(state, sidebar.nodeId, 'Identity', 'indigo');
  state = identitySection.state;
  const identityForm = insert(state, 'html.form', identitySection.bodyId);
  state = identityForm.state;
  state = bindRegionDetail(state, identityForm.nodeId, OPPORTUNITIES_DETAIL_DATA_SOURCE.id, { id: 'routeParams.id' });
  state = metaField(state, identityForm.nodeId, 'Customer', 'customerUserIdUsername', { inline: true, tone: 'indigo' });
  state = metaField(state, identityForm.nodeId, 'Stage', 'stageCodeTitle', { inline: true, tone: 'indigo' });
  state = metaField(state, identityForm.nodeId, 'Owner', 'ownerIdUsername', { inline: true });
  state = metaField(state, identityForm.nodeId, 'Closed at', 'closedAt', { inline: true });

  const auditSection = formSection(state, sidebar.nodeId, 'Audit trail', 'slate', true);
  state = auditSection.state;
  const auditForm = insert(state, 'html.form', auditSection.bodyId);
  state = auditForm.state;
  state = bindRegionDetail(state, auditForm.nodeId, OPPORTUNITIES_DETAIL_DATA_SOURCE.id, { id: 'routeParams.id' });
  state = metaField(state, auditForm.nodeId, 'Created at', 'createdAt', { inline: true });
  state = metaField(state, auditForm.nodeId, 'Created by', 'createdByUsername', { inline: true });
  state = metaField(state, auditForm.nodeId, 'Updated at', 'updatedAt', { inline: true });
  state = metaField(state, auditForm.nodeId, 'Updated by', 'updatedByUsername', { inline: true });

  const stageHistorySection = formSection(state, sidebar.nodeId, 'Stage history', 'amber', true);
  state = stageHistorySection.state;
  const note = insert(state, 'html.text', stageHistorySection.bodyId);
  state = setProp(note.state, note.nodeId, 'text', 'Change stage from the Opportunities board (drag the card between columns).');
  state = setProp(state, note.nodeId, 'className', 'text-[11px] leading-relaxed text-slate-500 ps-[4px]');

  const main = styledLayout(state, slots.slotIds[0]!, 'layout.flex-column', 'flex min-w-0 flex-1 flex-col overflow-y-auto bg-white p-4');
  state = main.state;

  const mainForm = insert(state, 'html.form', main.nodeId);
  state = mainForm.state;
  state = setProp(state, mainForm.nodeId, 'id', 'crm-opportunity-editor-form');
  state = setProp(state, mainForm.nodeId, 'className', 'flex flex-col gap-4');
  state = bindRegionDetail(state, mainForm.nodeId, OPPORTUNITIES_DETAIL_DATA_SOURCE.id, { id: 'routeParams.id' });
  const saveToast = createDynamicAction('showToast');
  saveToast.toastTitle = 'Opportunity saved.';
  saveToast.toastVariant = 'success';
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: mainForm.nodeId,
    bindingKey: eventBindingKeyForEvent('onSubmit'),
    definition: createRegionSubmitEventBindingDefinition('onSubmit', { trueActions: [saveToast] }),
  });

  const dealSection = formSection(state, mainForm.nodeId, 'Deal', 'indigo');
  state = dealSection.state;
  state = textField(state, dealSection.bodyId, 'title', 'Title');
  state = textField(state, dealSection.bodyId, 'amount', 'Amount');
  state = textField(state, dealSection.bodyId, 'expectedCloseDate', 'Expected close date');

  const noteSection = formSection(state, mainForm.nodeId, 'Note', 'slate', true);
  state = noteSection.state;
  state = textField(state, noteSection.bodyId, 'note', 'Note', { multiline: true, rows: 4 });

  const document = patchDocumentPageShell(state.document);
  return finalizeBuiltDocument('crm-opportunities-editor', FOLDER, document, state.bindingDefinitions);
};
