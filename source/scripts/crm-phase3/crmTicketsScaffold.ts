/**
 * CRM زیرفاز 3d — Tickets: inbox list + chat editor.
 * File structure copied from `crmCustomersScaffold.ts` (the golden reference), per plan
 * §package-ui P11 — not a new invention.
 *
 * Known, documented simplifications (backlog, not silent gaps):
 * - The "Waiting" duration column (computed client-side from `openedAt`/`closedAt`) is deferred —
 *   the list shows `openedAt` directly; the plan's exact "N hours/days" format needs either a
 *   computed grid column (no proven precedent used elsewhere in this scaffold) or a small
 *   generic Designer capability, out of scope for this pass.
 * - "My tickets" quick filter and status/priority/channel toolbar filters are deferred — same
 *   trade-off already documented for Customers/Opportunities list toolbars.
 * - The message feed reuses `AppTableGrid` (`standardGrid`) styled as a plain vertical list
 *   (borders/paging hidden) rather than the unproven `logic.repeater` binding — still a "simple
 *   chronological stack", never a chat-bubble kit, matching the plan's hard requirement; just
 *   built on already-proven grid-binding plumbing instead of first-time repeater wiring.
 * - Assign uses a plain "assignee user id" text field (same pragmatic fallback already used for
 *   Customers Merge / Add Individual's customer-id field) — not a user picker or "assign to me".
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
import {
  insert,
  setProp,
  styledLayout,
  finalizeBuiltDocument,
  patchDocumentPageShell,
  type CrmDesignerDraftBundle,
  bindValue,
  boundText,
  metaField,
  formSection,
  prepareGridSlots,
  textField,
  stripOutlineButtonLinkChrome,
  setDataSource,
  standardGrid,
  bindRegionDetail,
} from './crmDesignerScaffold';
import type { CrmFilterOptions } from './crmIds';

const FOLDER = 'crm';

const TICKETS_LIST_DATA_SOURCE = {
  id: 'crmTicketsList',
  name: 'CRM Tickets',
  endpoint: '/api/crm/tickets',
  primaryKey: 'id',
  fields: [
    'id', 'customerUserId', 'customerUserIdUsername', 'subject', 'statusCode', 'statusCodeTitle',
    'priorityCode', 'priorityCodeTitle', 'channelCode', 'channelCodeTitle',
    'assignedTo', 'assignedToUsername', 'openedAt', 'closedAt',
  ],
};

const TICKETS_DETAIL_DATA_SOURCE = {
  id: 'crmTicketsDetail',
  name: 'CRM Tickets (detail)',
  endpoint: '/api/crm/tickets',
  primaryKey: 'id',
  fields: [
    'id', 'subject', 'statusCode', 'statusCodeTitle', 'priorityCode', 'priorityCodeTitle',
    'channelCode', 'channelCodeTitle', 'assignedTo', 'assignedToUsername',
    'customerUserId', 'customerUserIdUsername', 'openedAt', 'closedAt',
    'createdAt', 'createdByUsername', 'updatedAt', 'updatedByUsername',
  ],
};

const TICKETS_ASSIGN_DATA_SOURCE = { id: 'crmTicketsAssign', name: 'CRM Tickets (assign)', endpoint: '/api/crm/tickets/:id/assign' };
const TICKETS_RESOLVE_DATA_SOURCE = { id: 'crmTicketsResolve', name: 'CRM Tickets (resolve)', endpoint: '/api/crm/tickets/:id/resolve' };
const TICKETS_CLOSE_DATA_SOURCE = { id: 'crmTicketsClose', name: 'CRM Tickets (close)', endpoint: '/api/crm/tickets/:id/close' };
const TICKETS_REOPEN_DATA_SOURCE = { id: 'crmTicketsReopen', name: 'CRM Tickets (reopen)', endpoint: '/api/crm/tickets/:id/reopen' };
const TICKETS_MESSAGES_DATA_SOURCE = {
  id: 'crmTicketsMessages',
  name: 'CRM Ticket Messages',
  endpoint: '/api/crm/tickets/:id/messages',
  fields: ['id', 'ticketId', 'authorId', 'body', 'createdAt'],
};
const TICKETS_REPLY_DATA_SOURCE = { id: 'crmTicketsReply', name: 'CRM Ticket Messages (reply)', endpoint: '/api/crm/tickets/:id/messages' };

const registerTicketsDataSources = (state: DesignerState): DesignerState => {
  let next = setDataSource(state, TICKETS_LIST_DATA_SOURCE.id, TICKETS_LIST_DATA_SOURCE.name, {
    endpoint: TICKETS_LIST_DATA_SOURCE.endpoint,
    primaryKey: TICKETS_LIST_DATA_SOURCE.primaryKey,
    fields: TICKETS_LIST_DATA_SOURCE.fields,
    operations: { list: { method: 'GET', endpoint: '/api/crm/tickets' } },
  });
  next = setDataSource(next, TICKETS_DETAIL_DATA_SOURCE.id, TICKETS_DETAIL_DATA_SOURCE.name, {
    endpoint: '/api/crm/tickets/:id',
    primaryKey: TICKETS_DETAIL_DATA_SOURCE.primaryKey,
    fields: TICKETS_DETAIL_DATA_SOURCE.fields,
    operations: { detail: { method: 'GET', endpoint: '/api/crm/tickets/:id' } },
  });
  next = setDataSource(next, TICKETS_ASSIGN_DATA_SOURCE.id, TICKETS_ASSIGN_DATA_SOURCE.name, {
    endpoint: TICKETS_ASSIGN_DATA_SOURCE.endpoint,
    primaryKey: 'id',
    fields: ['assignedTo'],
    // Bug found live-testing CRM 3d (see p-packages-crm.md): the regionSubmit codegen only
    // resolves a submit URL's `:id`-style path param — and only picks the `update` method over
    // POST — from a value it reads off this region's OWN fetched detail record (via `primaryKey`).
    // Without a real `detail` fetch, `:id` was never substituted (literal, broken URL). Reusing
    // the ticket detail GET populates that record; declaring `update` (not `create`) with method
    // 'POST' (this is a POST-only server action, not a real PUT/PATCH resource update) makes the
    // codegen emit the right verb once the id resolves. Platform codegen fix that made this
    // configurable at all: bindingRegionEngine.ts's resolveRegionDmlMethodExpression /
    // bindingMutationRuntime.ts's resolveRegionDmlMethod (previously hardcoded 'PUT').
    operations: {
      detail: { method: 'GET', endpoint: '/api/crm/tickets/:id' },
      update: { method: 'POST', endpoint: '/api/crm/tickets/:id/assign' },
    },
  });
  next = setDataSource(next, TICKETS_RESOLVE_DATA_SOURCE.id, TICKETS_RESOLVE_DATA_SOURCE.name, {
    endpoint: TICKETS_RESOLVE_DATA_SOURCE.endpoint,
    fields: [],
    operations: { create: { method: 'POST', endpoint: '/api/crm/tickets/:id/resolve' } },
  });
  next = setDataSource(next, TICKETS_CLOSE_DATA_SOURCE.id, TICKETS_CLOSE_DATA_SOURCE.name, {
    endpoint: TICKETS_CLOSE_DATA_SOURCE.endpoint,
    fields: [],
    operations: { create: { method: 'POST', endpoint: '/api/crm/tickets/:id/close' } },
  });
  next = setDataSource(next, TICKETS_REOPEN_DATA_SOURCE.id, TICKETS_REOPEN_DATA_SOURCE.name, {
    endpoint: TICKETS_REOPEN_DATA_SOURCE.endpoint,
    fields: [],
    operations: { create: { method: 'POST', endpoint: '/api/crm/tickets/:id/reopen' } },
  });
  next = setDataSource(next, TICKETS_MESSAGES_DATA_SOURCE.id, TICKETS_MESSAGES_DATA_SOURCE.name, {
    endpoint: '/api/crm/tickets/:id/messages',
    primaryKey: 'id',
    fields: TICKETS_MESSAGES_DATA_SOURCE.fields,
    operations: { list: { method: 'GET', endpoint: '/api/crm/tickets/:id/messages' } },
  });
  next = setDataSource(next, TICKETS_REPLY_DATA_SOURCE.id, TICKETS_REPLY_DATA_SOURCE.name, {
    endpoint: TICKETS_REPLY_DATA_SOURCE.endpoint,
    primaryKey: 'id',
    fields: ['body'],
    // Same bug class + fix as TICKETS_ASSIGN_DATA_SOURCE above.
    operations: {
      detail: { method: 'GET', endpoint: '/api/crm/tickets/:id' },
      update: { method: 'POST', endpoint: '/api/crm/tickets/:id/messages' },
    },
  });
  return next;
};

export const buildCrmTicketsListDraft = (): CrmDesignerDraftBundle => {
  let state = createRecordsPageState('Tickets');
  state = registerTicketsDataSources(state);
  state = setProp(state, state.document.rootNodeId, 'className', 'flex h-full min-h-0 w-full flex-col bg-white');

  const columns: DesignerDataGridColumn[] = [
    {
      key: 'subject', label: 'Subject', sort: true, filter: true, filterType: 'text', cardRole: 'title',
      cellKind: 'link', cellFields: { labelField: 'subject', hrefTemplate: '/studio/crm/tickets/edit/{id}' },
    } as DesignerDataGridColumn,
    { key: 'customerUserIdUsername', label: 'Customer', cardRole: 'meta' },
    { key: 'statusCodeTitle', label: 'Status', cellKind: 'status-badge', cardRole: 'meta' } as DesignerDataGridColumn,
    { key: 'priorityCodeTitle', label: 'Priority', cardRole: 'meta' },
    { key: 'channelCodeTitle', label: 'Channel', cardRole: 'meta' },
    { key: 'assignedToUsername', label: 'Assigned', cardRole: 'meta' },
    { key: 'openedAt', label: 'Opened', sort: true, cellKind: 'date', cardRole: 'meta' } as DesignerDataGridColumn,
  ];
  const toolbarConfig: DesignerGridToolbarConfig = {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: 'Search tickets…' },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(columns),
    },
  };
  const gridResult = standardGrid(state, state.document.rootNodeId, TICKETS_LIST_DATA_SOURCE.id, columns, {
    searchPlaceholder: 'Search tickets…',
    resourceLabel: 'tickets',
    defaultSortBy: 'openedAt',
    primaryKey: 'id',
    toolbarConfig,
    presentation: 'auto',
    pagination: true,
    pageSize: 50,
  });
  state = gridResult.state;

  const built = appendRecordsCrudOverlays({
    state,
    gridNodeId: gridResult.gridId,
    dataSource: {
      id: TICKETS_LIST_DATA_SOURCE.id,
      name: TICKETS_LIST_DATA_SOURCE.name,
      endpoint: TICKETS_LIST_DATA_SOURCE.endpoint,
      primaryKey: TICKETS_LIST_DATA_SOURCE.primaryKey,
      fields: TICKETS_LIST_DATA_SOURCE.fields,
      kind: 'collection',
      operations: {
        list: { method: 'GET', endpoint: '/api/crm/tickets' },
        create: { method: 'POST', endpoint: '/api/crm/tickets' },
      },
      responseMapping: { arrayPath: 'data', totalPath: 'count', dataPath: 'data' },
    },
    formFields: [
      { field: { name: 'customerUserId', type: 'string', location: 'body', required: true }, enabled: true, label: 'Customer user id', controlPaletteItemId: 'heroui.input-text' },
      { field: { name: 'subject', type: 'string', location: 'body', required: true }, enabled: true, label: 'Subject', controlPaletteItemId: 'heroui.input-text' },
    ],
    actions: { create: true, edit: false, delete: false },
    resourceLabel: 'ticket',
    createResponseStorePath: 'newTicket',
    createNavigateTarget: '/studio/crm/tickets/edit/{newTicket.data.id}',
  });
  state = built.state;

  const document = patchDocumentPageShell(state.document);
  return finalizeBuiltDocument('crm-tickets', FOLDER, document, state.bindingDefinitions);
};

// ---------------------------------------------------------------------------
// Deep editor — main (message feed + reply) + rail (Identity/Dates/Audit)
// ---------------------------------------------------------------------------

const actionBarButton = (
  state: DesignerState,
  parentId: string,
  text: string,
  icon: string,
  mutationDataSourceId: string,
  successToast: string,
): { state: DesignerState; nodeId: string } => {
  const button = insert(state, 'heroui.button-outline', parentId);
  let next = setProp(button.state, button.nodeId, 'text', text);
  next = setProp(next, button.nodeId, 'icon', icon);
  next = setProp(next, button.nodeId, 'size', 'sm');
  next = setProp(next, button.nodeId, 'type', 'button');
  next = stripOutlineButtonLinkChrome(next, button.nodeId);
  const mutation = createDynamicAction('callMutation');
  mutation.dataSourceRef = mutationDataSourceId;
  mutation.mutationOperation = 'create';
  mutation.mutationRecordIdStorePath = 'routeParams.id';
  const toast = createDynamicAction('showToast');
  toast.toastTitle = successToast;
  toast.toastVariant = 'success';
  const refresh = createDynamicAction('refreshDataSource');
  refresh.dataSourceRef = TICKETS_DETAIL_DATA_SOURCE.id;
  next = designerReducer(next, {
    type: 'set-node-binding',
    nodeId: button.nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createDynamicActionsEventBindingDefinition('onClick', [mutation, toast, refresh]),
  });
  return { state: next, nodeId: button.nodeId };
};

export const buildCrmTicketsEditorDraft = (): CrmDesignerDraftBundle => {
  let state = createRecordsPageState('Ticket Editor');
  state = registerTicketsDataSources(state);
  state = setProp(state, state.document.rootNodeId, 'publishedFormAssist', false);

  const page = styledLayout(state, state.document.rootNodeId, 'layout.flex-column', 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white');
  state = page.state;

  const actionBar = styledLayout(state, page.nodeId, 'layout.flex-row', 'flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5');
  state = actionBar.state;
  state = bindRegionDetail(state, actionBar.nodeId, TICKETS_DETAIL_DATA_SOURCE.id, { id: 'routeParams.id' });

  const backButton = insert(state, 'heroui.button-outline', actionBar.nodeId);
  state = setProp(backButton.state, backButton.nodeId, 'workspaceBack', true);
  state = setProp(state, backButton.nodeId, 'aria-label', 'Back to Tickets');
  state = setProp(state, backButton.nodeId, 'className', '');
  const backNavigate = createDynamicAction('navigate');
  backNavigate.navigateTarget = '/studio/crm/tickets';
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: backButton.nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createDynamicActionsEventBindingDefinition('onClick', [backNavigate]),
  });

  const identityCluster = styledLayout(state, actionBar.nodeId, 'layout.flex-row', 'flex min-w-0 flex-1 items-center gap-2 overflow-hidden');
  state = identityCluster.state;
  state = boundText(state, identityCluster.nodeId, 'subject', 'm-0 min-w-0 truncate text-sm font-semibold leading-none text-slate-800');
  const idSep = insert(state, 'html.text', identityCluster.nodeId);
  state = setProp(idSep.state, idSep.nodeId, 'text', '·');
  state = setProp(state, idSep.nodeId, 'className', 'shrink-0 text-slate-300');
  state = boundText(state, identityCluster.nodeId, 'id', 'm-0 shrink-0 font-mono text-xs font-medium leading-none text-slate-500');

  const resolveResult = actionBarButton(state, actionBar.nodeId, 'Resolve', 'CheckCircle2', TICKETS_RESOLVE_DATA_SOURCE.id, 'Ticket resolved.');
  state = resolveResult.state;
  const closeResult = actionBarButton(state, actionBar.nodeId, 'Close', 'Archive', TICKETS_CLOSE_DATA_SOURCE.id, 'Ticket closed.');
  state = closeResult.state;
  const reopenResult = actionBarButton(state, actionBar.nodeId, 'Reopen', 'RotateCcw', TICKETS_REOPEN_DATA_SOURCE.id, 'Ticket reopened.');
  state = reopenResult.state;

  const workspace = styledLayout(state, page.nodeId, 'layout.grid-2', 'grid min-h-0 flex-1 gap-0 overflow-hidden bg-white');
  state = setProp(workspace.state, workspace.nodeId, 'layoutGridColumnWidths', JSON.stringify([{ value: '1', unit: 'fr' }, { value: '320', unit: 'px' }]));
  const slots = prepareGridSlots(state, workspace.nodeId);
  state = slots.state;

  // --- Rail ---
  const sidebar = styledLayout(
    state,
    slots.slotIds[1]!,
    'layout.flex-column',
    'flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-y-auto border-s border-slate-200 bg-slate-50 px-3 pb-4 pt-[10px]',
  );
  state = sidebar.state;

  const assignSection = formSection(state, sidebar.nodeId, 'Identity', 'rose');
  state = assignSection.state;
  const identityForm = insert(state, 'html.form', assignSection.bodyId);
  state = identityForm.state;
  state = bindRegionDetail(state, identityForm.nodeId, TICKETS_DETAIL_DATA_SOURCE.id, { id: 'routeParams.id' });
  state = metaField(state, identityForm.nodeId, 'Customer', 'customerUserIdUsername', { inline: true, tone: 'rose' });
  state = metaField(state, identityForm.nodeId, 'Status', 'statusCodeTitle', { inline: true, tone: 'rose' });
  state = metaField(state, identityForm.nodeId, 'Priority', 'priorityCodeTitle', { inline: true });
  state = metaField(state, identityForm.nodeId, 'Channel', 'channelCodeTitle', { inline: true });
  state = metaField(state, identityForm.nodeId, 'Assigned to', 'assignedToUsername', { inline: true });

  // Assign — pragmatic fallback text field (see file header), + button. `bindRegionDetail` here
  // does double duty: it both fetches TICKETS_ASSIGN_DATA_SOURCE's `detail` op (populating the
  // region's own record so the submit URL's `:id` resolves) and provides the `urlParams` that
  // fetch itself needs. See the data-source registration above for the full bug writeup.
  const assignForm = insert(state, 'html.form', assignSection.bodyId);
  state = assignForm.state;
  state = bindRegionDetail(state, assignForm.nodeId, TICKETS_ASSIGN_DATA_SOURCE.id, { id: 'routeParams.id' });
  const assignToast = createDynamicAction('showToast');
  assignToast.toastTitle = 'Ticket assigned.';
  assignToast.toastVariant = 'success';
  const assignRefresh = createDynamicAction('refreshDataSource');
  assignRefresh.dataSourceRef = TICKETS_DETAIL_DATA_SOURCE.id;
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: assignForm.nodeId,
    bindingKey: eventBindingKeyForEvent('onSubmit'),
    definition: createRegionSubmitEventBindingDefinition('onSubmit', { trueActions: [assignToast, assignRefresh] }),
  });
  state = textField(state, assignForm.nodeId, 'assignedTo', 'Assign to (user id)');
  const assignSubmit = insert(state, 'heroui.button-solid', assignForm.nodeId);
  state = setProp(assignSubmit.state, assignSubmit.nodeId, 'text', 'Assign');
  state = setProp(state, assignSubmit.nodeId, 'type', 'submit');
  state = setProp(state, assignSubmit.nodeId, 'className', 'bg-rose-600 text-white hover:bg-rose-700 w-full mt-1');

  const datesSection = formSection(state, sidebar.nodeId, 'Dates', 'amber', true);
  state = datesSection.state;
  const datesForm = insert(state, 'html.form', datesSection.bodyId);
  state = datesForm.state;
  state = bindRegionDetail(state, datesForm.nodeId, TICKETS_DETAIL_DATA_SOURCE.id, { id: 'routeParams.id' });
  state = metaField(state, datesForm.nodeId, 'Opened', 'openedAt', { inline: true });
  state = metaField(state, datesForm.nodeId, 'Closed', 'closedAt', { inline: true });

  const auditSection = formSection(state, sidebar.nodeId, 'Audit trail', 'slate', true);
  state = auditSection.state;
  const auditForm = insert(state, 'html.form', auditSection.bodyId);
  state = auditForm.state;
  state = bindRegionDetail(state, auditForm.nodeId, TICKETS_DETAIL_DATA_SOURCE.id, { id: 'routeParams.id' });
  state = metaField(state, auditForm.nodeId, 'Created at', 'createdAt', { inline: true });
  state = metaField(state, auditForm.nodeId, 'Created by', 'createdByUsername', { inline: true });

  // --- Main: message feed (simple chronological stack, not a chat kit) + reply ---
  const main = styledLayout(state, slots.slotIds[0]!, 'layout.flex-column', 'flex min-w-0 flex-1 flex-col overflow-hidden bg-white');
  state = main.state;

  const feedHost = styledLayout(state, main.nodeId, 'layout.flex-column', 'flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3');
  state = feedHost.state;

  const feedColumns: DesignerDataGridColumn[] = [
    { key: 'authorId', label: 'From', cellKind: 'text', cardRole: 'meta' } as DesignerDataGridColumn,
    { key: 'body', label: 'Message', cardRole: 'title', cellKind: 'text' } as DesignerDataGridColumn,
    { key: 'createdAt', label: 'Sent', cellKind: 'date', cardRole: 'meta' } as DesignerDataGridColumn,
  ];
  const feedResult = standardGrid(state, feedHost.nodeId, TICKETS_MESSAGES_DATA_SOURCE.id, feedColumns, {
    searchPlaceholder: '',
    resourceLabel: 'messages',
    defaultSortBy: 'createdAt',
    primaryKey: 'id',
    presentation: 'cards',
    pagination: false,
    pageSize: 200,
    urlParams: { id: 'routeParams.id' },
    toolbarConfig: { enabled: false },
  });
  state = feedResult.state;

  const replyBar = styledLayout(state, main.nodeId, 'layout.flex-row', 'flex shrink-0 items-end gap-2 border-t border-slate-200 bg-white px-4 py-3');
  state = replyBar.state;

  const replyForm = insert(state, 'html.form', replyBar.nodeId);
  state = replyForm.state;
  state = setProp(state, replyForm.nodeId, 'className', 'flex w-full items-end gap-2');
  state = bindRegionDetail(state, replyForm.nodeId, TICKETS_REPLY_DATA_SOURCE.id, { id: 'routeParams.id' });
  const replyToast = createDynamicAction('showToast');
  replyToast.toastTitle = 'Reply sent.';
  replyToast.toastVariant = 'success';
  const replyRefresh = createDynamicAction('refreshDataSource');
  replyRefresh.dataSourceRef = TICKETS_MESSAGES_DATA_SOURCE.id;
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: replyForm.nodeId,
    bindingKey: eventBindingKeyForEvent('onSubmit'),
    definition: createRegionSubmitEventBindingDefinition('onSubmit', { trueActions: [replyToast, replyRefresh] }),
  });
  const replyField = insert(state, 'heroui.textarea', replyForm.nodeId);
  state = setProp(replyField.state, replyField.nodeId, 'label', '');
  state = setProp(state, replyField.nodeId, 'placeholder', 'Write a reply…');
  state = setProp(state, replyField.nodeId, 'className', 'flex-1');
  state = setProp(state, replyField.nodeId, 'rows', 2);
  state = bindValue(state, replyField.nodeId, 'body');
  const replySend = insert(state, 'heroui.button-solid', replyForm.nodeId);
  state = setProp(replySend.state, replySend.nodeId, 'text', 'Send');
  state = setProp(state, replySend.nodeId, 'type', 'submit');
  state = setProp(state, replySend.nodeId, 'className', 'bg-sky-600 text-white hover:bg-sky-700');

  const document = patchDocumentPageShell(state.document);
  return finalizeBuiltDocument('crm-tickets-editor', FOLDER, document, state.bindingDefinitions);
};
