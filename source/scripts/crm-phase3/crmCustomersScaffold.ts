/**
 * CRM زیرفاز 3b — Customers list + deep editor (the "golden" reference page every
 * later catalog's file structure is copied from — see docs/standards/package-ui.md P9/P10).
 *
 * Known, documented simplifications (backlog, not silent gaps):
 * - Toolbar has search + refresh only; Lifecycle/Source dropdown filters, an Owner filter,
 *   and the "My customers" quick toggle are deferred — the grid's lifecycle/source badges
 *   are still visible, just not filterable from the toolbar yet.
 * - Add Individual / Add Company / Merge render as a thin action row above the grid rather
 *   than inside the grid's own single-slot toolbar `create` button (which only supports one
 *   action) — a two-row toolbar, not the strict P2 single-row ideal.
 * - The "Person type" grid column is omitted from the list (visible in the editor rail).
 * - Merge uses a pragmatic two-text-field modal (survivorUserId/loserUserId), not a grid
 *   selection-driven mutation — same fallback already documented for v1 parties merge.
 */

import { designerReducer } from '../../src/domain/component-designer/state';
import type {
  DataSourceDefinition,
  DesignerState,
} from '../../src/domain/component-designer/types';
import {
  createRecordsPageState,
  appendStandaloneCreateOverlay,
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
  selectField,
  clickableNoteField,
  stripOutlineButtonLinkChrome,
  setDataSource,
  standardGrid,
  bindRegionDetail,
  chainCreateSuccessActions,
  findModalFormFieldsBodyId,
} from './crmDesignerScaffold';
import type { CrmFilterOptions } from './crmIds';

const FOLDER = 'crm';

const USERS_CREATE_DATA_SOURCE = {
  id: 'crmUsersCreate',
  name: 'Platform Users (create)',
  endpoint: '/api/users',
  primaryKey: 'id',
  fields: ['id', 'email', 'password', 'firstName', 'lastName', 'nickname', 'companyName', 'registrationNumber', 'website'],
};

const CUSTOMERS_EXTENSION_CREATE_DATA_SOURCE = {
  id: 'crmCustomersExtensionCreate',
  name: 'CRM Customers (extension create)',
  endpoint: '/api/crm/customers',
  primaryKey: 'id',
  fields: ['userId', 'lifecycleStageCode'],
};

const CUSTOMERS_MERGE_DATA_SOURCE = {
  id: 'crmCustomersMerge',
  name: 'CRM Customers (merge)',
  endpoint: '/api/crm/customers/merge',
  // NOT 'survivorUserId'/'loserUserId' — a create-form data source whose primaryKey matches one
  // of its own submitted body fields gets that value appended onto the URL by the codegen
  // (update-with-id convention), turning POST /api/crm/customers/merge into
  // POST /api/crm/customers/merge/{survivorUserId}. 'id' is not a submitted field, so it stays
  // a plain body-only POST. Confirmed by reading the generated .tsx before this fix.
  primaryKey: 'id',
  fields: ['survivorUserId', 'loserUserId'],
};

const CUSTOMERS_DETAIL_DATA_SOURCE = {
  id: 'crmCustomersDetail',
  name: 'CRM Customers (detail)',
  endpoint: '/api/crm/customers',
  primaryKey: 'userId',
  // Flat keys, matching `customersGet`'s response shape exactly — bindValue/metaField field
  // arguments are single JS property accessors (`regionColumnToExpression`), NOT dotted
  // traversal paths. A dotted string like `'profile.firstname'` compiles to a literal bracket
  // lookup `data?.["profile.firstname"]`, which is never populated (the real key is nested
  // under `data.profile.firstname`) — every Profile/Identity/Audit field silently rendered
  // blank until this was found via a user screenshot report and fixed here + server-side in
  // `customersGet` (Phase 2), which used to return the raw unflattened Sequelize include tree.
  fields: [
    'id', 'userId', 'displayName', 'note', 'lifecycleStageCode', 'sourceCode', 'ownerId',
    'createdAt', 'createdBy', 'createdByUsername', 'updatedAt', 'updatedBy', 'updatedByUsername',
    'username', 'email', 'mobile',
    'firstname', 'lastname', 'nickname', 'companyName', 'registrationNumber', 'website', 'personTypeCode',
    'lifecycleStageCodeTitle', 'lifecycleStageCodeUiColor', 'sourceCodeTitle', 'ownerUsername',
  ],
};

const CUSTOMERS_RELATED_COUNTS_DATA_SOURCE = {
  id: 'crmCustomersRelatedCounts',
  name: 'CRM Customers (related counts)',
  endpoint: '/api/crm/customers/:userId/related-counts',
  primaryKey: 'userId',
  fields: ['opportunities', 'activities', 'tickets', 'individuals'],
};

const CUSTOMERS_TAGS_DATA_SOURCE = {
  id: 'crmCustomersTags',
  name: 'CRM Customers (tags)',
  endpoint: '/api/crm/customers/:userId/tags',
  primaryKey: 'userId',
  fields: ['tagCodes'],
};

/** Registers all 6 CRM Customers data sources shared by list + editor. */
const registerCrmCustomersDataSources = (state: DesignerState): DesignerState => {
  let next = setDataSource(state, USERS_CREATE_DATA_SOURCE.id, USERS_CREATE_DATA_SOURCE.name, {
    endpoint: USERS_CREATE_DATA_SOURCE.endpoint,
    primaryKey: USERS_CREATE_DATA_SOURCE.primaryKey,
    fields: USERS_CREATE_DATA_SOURCE.fields,
    operations: { create: { method: 'POST', endpoint: '/api/users' } },
  });
  next = setDataSource(next, CUSTOMERS_EXTENSION_CREATE_DATA_SOURCE.id, CUSTOMERS_EXTENSION_CREATE_DATA_SOURCE.name, {
    endpoint: CUSTOMERS_EXTENSION_CREATE_DATA_SOURCE.endpoint,
    primaryKey: CUSTOMERS_EXTENSION_CREATE_DATA_SOURCE.primaryKey,
    fields: CUSTOMERS_EXTENSION_CREATE_DATA_SOURCE.fields,
    operations: { create: { method: 'POST', endpoint: '/api/crm/customers' } },
  });
  next = setDataSource(next, CUSTOMERS_MERGE_DATA_SOURCE.id, CUSTOMERS_MERGE_DATA_SOURCE.name, {
    endpoint: CUSTOMERS_MERGE_DATA_SOURCE.endpoint,
    primaryKey: CUSTOMERS_MERGE_DATA_SOURCE.primaryKey,
    fields: CUSTOMERS_MERGE_DATA_SOURCE.fields,
    operations: { create: { method: 'POST', endpoint: '/api/crm/customers/merge' } },
  });
  next = setDataSource(next, CUSTOMERS_DETAIL_DATA_SOURCE.id, CUSTOMERS_DETAIL_DATA_SOURCE.name, {
    endpoint: '/api/crm/customers/:userId',
    primaryKey: CUSTOMERS_DETAIL_DATA_SOURCE.primaryKey,
    fields: CUSTOMERS_DETAIL_DATA_SOURCE.fields,
    operations: {
      detail: { method: 'GET', endpoint: '/api/crm/customers/:userId' },
      update: { method: 'PATCH', endpoint: '/api/crm/customers/:userId' },
      custom: { archive: { method: 'POST', endpoint: '/api/crm/customers/:userId/archive', label: 'Archive' } },
    },
  });
  next = setDataSource(next, CUSTOMERS_RELATED_COUNTS_DATA_SOURCE.id, CUSTOMERS_RELATED_COUNTS_DATA_SOURCE.name, {
    endpoint: CUSTOMERS_RELATED_COUNTS_DATA_SOURCE.endpoint,
    primaryKey: CUSTOMERS_RELATED_COUNTS_DATA_SOURCE.primaryKey,
    fields: CUSTOMERS_RELATED_COUNTS_DATA_SOURCE.fields,
    operations: { detail: { method: 'GET', endpoint: '/api/crm/customers/:userId/related-counts' } },
  });
  next = setDataSource(next, CUSTOMERS_TAGS_DATA_SOURCE.id, CUSTOMERS_TAGS_DATA_SOURCE.name, {
    endpoint: CUSTOMERS_TAGS_DATA_SOURCE.endpoint,
    primaryKey: CUSTOMERS_TAGS_DATA_SOURCE.primaryKey,
    fields: CUSTOMERS_TAGS_DATA_SOURCE.fields,
    // `detail` is required even though Tags has no GET of its own: the regionSubmit codegen only
    // resolves the update URL's `:userId` (and only picks PUT over POST) from a value it reads off
    // this region's OWN fetched detail record — reusing the customer detail GET is what actually
    // populates that record. See TICKETS_ASSIGN/REPLY_DATA_SOURCE in crmTicketsScaffold.ts for the
    // full writeup of this bug class (found live-testing CRM 3d).
    operations: {
      detail: { method: 'GET', endpoint: '/api/crm/customers/:userId' },
      update: { method: 'PUT', endpoint: '/api/crm/customers/:userId/tags' },
    },
  });
  return next;
};

/** A dashed-free action button in the custom row above the grid. */
const actionButton = (
  state: DesignerState,
  parentId: string,
  text: string,
  icon: string,
): { state: DesignerState; nodeId: string } => {
  const { state: s1, nodeId } = insert(state, 'heroui.button-solid', parentId);
  let s2 = setProp(s1, nodeId, 'text', text);
  s2 = setProp(s2, nodeId, 'icon', icon);
  s2 = setProp(s2, nodeId, 'size', 'sm');
  s2 = setProp(s2, nodeId, 'type', 'button');
  s2 = setProp(s2, nodeId, 'className', 'bg-sky-600 text-white hover:bg-sky-700');
  return { state: s2, nodeId };
};

const wireOpenModal = (state: DesignerState, triggerNodeId: string, modalNodeId: string): DesignerState => {
  // Bug found live-testing (user report — Add Individual/Add Company/Merge buttons did nothing):
  // `resolveDynamicActions` only emits a `showHide` action when `action.targetNodeId` is set —
  // it derives `visibilityStorePath` itself via `visibilityStorePathForNode(action.targetNodeId)`.
  // Setting `.storePath` directly (a field that doesn't exist on `showHide` actions at all) left
  // `targetNodeId` empty, so the whole action was silently dropped and the generated onClick
  // handler compiled to an empty function body — confirmed by reading the generated .tsx.
  const show = createDynamicAction('showHide');
  show.targetNodeId = modalNodeId;
  show.showHideEffect = 'show';
  return designerReducer(state, {
    type: 'set-node-binding',
    nodeId: triggerNodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createDynamicActionsEventBindingDefinition('onClick', [show]),
  });
};

/** Add Individual / Add Company: create the platform user, then the crm_customers extension, then navigate. */
const buildAddCustomerModal = (
  state: DesignerState,
  input: {
    title: string;
    submitLabel: string;
    fields: Array<{ name: string; label: string }>;
    fixedPersonTypeCode: string;
  },
): { state: DesignerState; modalNodeId: string } => {
  const dataSource: DataSourceDefinition = {
    id: USERS_CREATE_DATA_SOURCE.id,
    name: USERS_CREATE_DATA_SOURCE.name,
    endpoint: USERS_CREATE_DATA_SOURCE.endpoint,
    primaryKey: USERS_CREATE_DATA_SOURCE.primaryKey,
    fields: USERS_CREATE_DATA_SOURCE.fields,
    kind: 'collection',
    operations: { create: { method: 'POST', endpoint: '/api/users' } },
    responseMapping: { arrayPath: 'data', totalPath: 'count', dataPath: 'data' },
  };

  const overlay = appendStandaloneCreateOverlay({
    state,
    dataSource,
    formFields: [
      { field: { name: 'email', type: 'string', location: 'body', required: true }, enabled: true, label: 'Email', controlPaletteItemId: 'heroui.input-text' },
      {
        field: { name: 'password', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Password',
        controlPaletteItemId: 'heroui.input-text',
        controlProps: { type: 'password' },
      },
      ...input.fields.map((field) => ({
        field: { name: field.name, type: 'string' as const, location: 'body' as const, required: false },
        enabled: true,
        label: field.label,
        controlPaletteItemId: 'heroui.input-text',
      })),
    ],
    title: input.title,
    submitLabel: input.submitLabel,
  });
  let next = overlay.state;

  const bodyId = findModalFormFieldsBodyId(next.document, overlay.modalNodeId);
  if (bodyId) {
    const personType = insert(next, 'heroui.input-text', bodyId);
    next = setProp(personType.state, personType.nodeId, 'label', '');
    next = setProp(next, personType.nodeId, 'className', 'hidden');
    next = setProp(next, personType.nodeId, 'value', input.fixedPersonTypeCode);
    next = bindValue(next, personType.nodeId, 'personTypeCode');

    // POST /api/users expects roles: string[] — a plain text input's FormData value is
    // always a string, so this MUST use 'commaSeparatedArray' or normalizeRolesInput()
    // (src/server/utils/usersHelpers.ts) silently drops it and falls back to
    // DEFAULT_ASSIGNABLE_ROLE ('DEVELOPER') instead of CUSTOMER — confirmed by reading the
    // generated .tsx + server code before this fix.
    const roles = insert(next, 'heroui.input-text', bodyId);
    next = setProp(roles.state, roles.nodeId, 'label', '');
    next = setProp(next, roles.nodeId, 'className', 'hidden');
    next = setProp(next, roles.nodeId, 'value', 'CUSTOMER');
    next = bindValue(next, roles.nodeId, 'roles', { payloadTransform: 'commaSeparatedArray' });

    // `POST /api/users` defaults singular `role` to DEFAULT_ASSIGNABLE_ROLE ('DEVELOPER') when
    // absent, then ALWAYS merges it into the final role set alongside `roles` (userCrud.service.ts
    // `normalizeRolesInput`) — every customer would silently also get DEVELOPER without this.
    // An explicit empty `role` short-circuits the `?? DEFAULT_ASSIGNABLE_ROLE` fallback. Confirmed
    // via a live create+role-check before this fix (got ['CUSTOMER','DEVELOPER'] without it).
    const roleSingular = insert(next, 'heroui.input-text', bodyId);
    next = setProp(roleSingular.state, roleSingular.nodeId, 'label', '');
    next = setProp(next, roleSingular.nodeId, 'className', 'hidden');
    next = setProp(next, roleSingular.nodeId, 'value', '');
    next = bindValue(next, roleSingular.nodeId, 'role');
  }

  // Chain: POST /api/users succeeds → POST /api/crm/customers with the new userId → navigate
  // to the editor. Two-step because the edge-domain-action sandbox has no bcrypt/require and
  // cannot itself call POST /api/users (see plan §شکل API "Customer create").
  const createExtension = createDynamicAction('callMutation');
  createExtension.dataSourceRef = CUSTOMERS_EXTENSION_CREATE_DATA_SOURCE.id;
  createExtension.mutationOperation = 'create';
  createExtension.mutationBody = { userId: '{newCustomerUser.data.id}' };

  const navigate = createDynamicAction('navigate');
  navigate.navigateTarget = '/studio/crm/customers/edit/{newCustomerUser.data.id}';

  const document = chainCreateSuccessActions(next.document, 'newCustomerUser', [createExtension, navigate]);

  return { state: { ...next, document }, modalNodeId: overlay.modalNodeId };
};

const buildMergeModal = (state: DesignerState): { state: DesignerState; modalNodeId: string } => {
  const dataSource: DataSourceDefinition = {
    id: CUSTOMERS_MERGE_DATA_SOURCE.id,
    name: CUSTOMERS_MERGE_DATA_SOURCE.name,
    endpoint: CUSTOMERS_MERGE_DATA_SOURCE.endpoint,
    primaryKey: CUSTOMERS_MERGE_DATA_SOURCE.primaryKey,
    fields: CUSTOMERS_MERGE_DATA_SOURCE.fields,
    kind: 'collection',
    operations: { create: { method: 'POST', endpoint: '/api/crm/customers/merge' } },
    responseMapping: { arrayPath: 'data', totalPath: 'count', dataPath: 'data' },
  };
  const overlay = appendStandaloneCreateOverlay({
    state,
    dataSource,
    formFields: [
      {
        field: { name: 'survivorUserId', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Survivor user id (kept)',
        controlPaletteItemId: 'heroui.input-text',
      },
      {
        field: { name: 'loserUserId', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Duplicate user id (merged away, archived as Lost)',
        controlPaletteItemId: 'heroui.input-text',
      },
    ],
    title: 'Merge duplicate customers',
    submitLabel: 'Merge',
  });
  return overlay;
};

export const buildCrmCustomersListDraft = (input: {
  filterOptions: CrmFilterOptions;
}): CrmDesignerDraftBundle => {
  const dataSource: DataSourceDefinition = {
    id: 'crmCustomersList',
    name: 'CRM Customers',
    endpoint: '/api/crm/customers',
    primaryKey: 'userId',
    fields: [
      'id', 'userId', 'displayName', 'username', 'email', 'mobile',
      'lifecycleStageCode', 'lifecycleStageCodeTitle', 'lifecycleStageCodeUiColor',
      'sourceCode', 'sourceCodeTitle', 'ownerId', 'ownerUsername', 'updatedAt',
    ],
    kind: 'collection',
    operations: { list: { method: 'GET', endpoint: '/api/crm/customers' } },
    responseMapping: { arrayPath: 'data', totalPath: 'count', dataPath: 'data' },
  };

  let state = createRecordsPageState('Customers');
  state = designerReducer(state, { type: 'set-data-source', dataSourceId: dataSource.id, dataSource });
  state = registerCrmCustomersDataSources(state);
  state = setProp(state, state.document.rootNodeId, 'className', 'flex h-full min-h-0 w-full flex-col bg-white');

  const actionRow = styledLayout(
    state,
    state.document.rootNodeId,
    'layout.flex-row',
    'flex shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-5',
  );
  state = actionRow.state;

  const addIndividual = buildAddCustomerModal(state, {
    title: 'Add Individual',
    submitLabel: 'Create individual',
    fixedPersonTypeCode: '100.2.1',
    fields: [
      { name: 'firstName', label: 'First name' },
      { name: 'lastName', label: 'Last name' },
      { name: 'nickname', label: 'Nickname' },
    ],
  });
  state = addIndividual.state;

  const addCompany = buildAddCustomerModal(state, {
    title: 'Add Company',
    submitLabel: 'Create company',
    fixedPersonTypeCode: '100.2.2',
    fields: [
      { name: 'companyName', label: 'Company name' },
      { name: 'registrationNumber', label: 'Registration number' },
      { name: 'website', label: 'Website' },
    ],
  });
  state = addCompany.state;

  const merge = buildMergeModal(state);
  state = merge.state;

  const addIndividualButton = actionButton(state, actionRow.nodeId, 'Add Individual', 'UserPlus');
  state = wireOpenModal(addIndividualButton.state, addIndividualButton.nodeId, addIndividual.modalNodeId);

  const addCompanyButton = actionButton(state, actionRow.nodeId, 'Add Company', 'Building2');
  state = wireOpenModal(addCompanyButton.state, addCompanyButton.nodeId, addCompany.modalNodeId);

  const mergeButton = insert(state, 'heroui.button-outline', actionRow.nodeId);
  state = setProp(mergeButton.state, mergeButton.nodeId, 'text', 'Merge duplicates');
  state = setProp(state, mergeButton.nodeId, 'icon', 'Merge');
  state = setProp(state, mergeButton.nodeId, 'size', 'sm');
  state = setProp(state, mergeButton.nodeId, 'type', 'button');
  state = stripOutlineButtonLinkChrome(state, mergeButton.nodeId);
  state = wireOpenModal(state, mergeButton.nodeId, merge.modalNodeId);

  const gridHost = styledLayout(state, state.document.rootNodeId, 'layout.flex-column', 'flex min-h-0 w-full flex-1 flex-col');
  state = gridHost.state;

  const columns: DesignerDataGridColumn[] = [
    {
      key: 'displayName', label: 'Name', sort: false, filter: false, cardRole: 'title',
      cellKind: 'link', cellFields: { labelField: 'displayName', hrefTemplate: '/studio/crm/customers/edit/{userId}' },
    } as DesignerDataGridColumn,
    {
      key: 'lifecycleStageCodeTitle', label: 'Lifecycle', cellKind: 'status-badge', cardRole: 'meta',
      cellFields: { colorField: 'lifecycleStageCodeUiColor' },
    } as DesignerDataGridColumn,
    { key: 'sourceCodeTitle', label: 'Source', cardRole: 'meta' },
    { key: 'email', label: 'Email', cardRole: 'meta' },
    { key: 'mobile', label: 'Phone', cardRole: 'meta' },
    { key: 'ownerUsername', label: 'Owner', cardRole: 'meta' },
    { key: 'updatedAt', label: 'Updated', sort: true, cellKind: 'date', cardRole: 'meta' },
  ];

  const toolbarConfig: DesignerGridToolbarConfig = {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: 'Search customers…' },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(columns),
    },
  };

  const gridResult = standardGrid(state, gridHost.nodeId, dataSource.id, columns, {
    searchPlaceholder: 'Search customers…',
    resourceLabel: 'customers',
    defaultSortBy: 'updatedAt',
    primaryKey: 'userId',
    toolbarConfig,
    presentation: 'auto',
    pagination: true,
    pageSize: 50,
  });
  state = gridResult.state;

  const document = patchDocumentPageShell(state.document);
  return finalizeBuiltDocument('crm-customers', FOLDER, document, state.bindingDefinitions);
};

// ---------------------------------------------------------------------------
// Deep editor — main (Profile + CRM note) + rail (Identity/Ownership/Audit/Tags/Related)
// ---------------------------------------------------------------------------

export const buildCrmCustomersEditorDraft = (input: {
  filterOptions: CrmFilterOptions;
}): CrmDesignerDraftBundle => {
  let state = createRecordsPageState('Customer Editor');
  state = registerCrmCustomersDataSources(state);
  state = setProp(state, state.document.rootNodeId, 'publishedFormAssist', false);

  const page = styledLayout(
    state,
    state.document.rootNodeId,
    'layout.flex-column',
    'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white',
  );
  state = page.state;

  // Action bar: Back + identity + Archive + Save.
  const actionBar = styledLayout(
    state,
    page.nodeId,
    'layout.flex-row',
    'flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5',
  );
  state = actionBar.state;
  state = bindRegionDetail(state, actionBar.nodeId, CUSTOMERS_DETAIL_DATA_SOURCE.id, { userId: 'routeParams.id' });

  const backButton = insert(state, 'heroui.button-outline', actionBar.nodeId);
  state = setProp(backButton.state, backButton.nodeId, 'workspaceBack', true);
  state = setProp(state, backButton.nodeId, 'aria-label', 'Back to Customers');
  state = setProp(state, backButton.nodeId, 'title', 'Back to list');
  state = setProp(state, backButton.nodeId, 'className', '');
  const backNavigate = createDynamicAction('navigate');
  backNavigate.navigateTarget = '/studio/crm/customers';
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: backButton.nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createDynamicActionsEventBindingDefinition('onClick', [backNavigate]),
  });

  const identityCluster = styledLayout(state, actionBar.nodeId, 'layout.flex-row', 'flex min-w-0 flex-1 items-center gap-2 overflow-hidden');
  state = identityCluster.state;
  state = boundText(state, identityCluster.nodeId, 'displayName', 'm-0 min-w-0 truncate text-sm font-semibold leading-none text-slate-800');
  const idSep = insert(state, 'html.text', identityCluster.nodeId);
  state = setProp(idSep.state, idSep.nodeId, 'text', '·');
  state = setProp(state, idSep.nodeId, 'className', 'shrink-0 text-slate-300');
  state = boundText(state, identityCluster.nodeId, 'userId', 'm-0 shrink-0 font-mono text-xs font-medium leading-none text-slate-500');

  // Archive → lifecycle Lost, from the action bar (C7: archive ≡ lifecycle Lost, no separate column).
  const archiveButton = insert(state, 'heroui.button-outline', actionBar.nodeId);
  state = setProp(archiveButton.state, archiveButton.nodeId, 'text', 'Archive');
  state = setProp(state, archiveButton.nodeId, 'icon', 'Archive');
  state = setProp(state, archiveButton.nodeId, 'size', 'sm');
  state = setProp(state, archiveButton.nodeId, 'type', 'button');
  state = stripOutlineButtonLinkChrome(state, archiveButton.nodeId);
  const archiveMutation = createDynamicAction('callMutation');
  archiveMutation.dataSourceRef = CUSTOMERS_DETAIL_DATA_SOURCE.id;
  archiveMutation.mutationOperation = 'archive';
  archiveMutation.mutationRecordIdStorePath = 'routeParams.id';
  const archiveToast = createDynamicAction('showToast');
  archiveToast.toastTitle = 'Customer archived (lifecycle: Lost).';
  archiveToast.toastVariant = 'success';
  const archiveRefresh = createDynamicAction('refreshDataSource');
  archiveRefresh.dataSourceRef = CUSTOMERS_DETAIL_DATA_SOURCE.id;
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: archiveButton.nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createDynamicActionsEventBindingDefinition('onClick', [archiveMutation, archiveToast, archiveRefresh]),
  });

  const saveButton = insert(state, 'heroui.button-solid', actionBar.nodeId);
  state = setProp(saveButton.state, saveButton.nodeId, 'text', 'Save');
  state = setProp(state, saveButton.nodeId, 'type', 'submit');
  state = setProp(state, saveButton.nodeId, 'form', 'crm-customer-editor-form');
  state = setProp(state, saveButton.nodeId, 'className', 'bg-sky-600 text-white hover:bg-sky-700');

  // Workspace: main (fr) + rail (320px).
  const workspace = styledLayout(state, page.nodeId, 'layout.grid-2', 'grid min-h-0 flex-1 gap-0 overflow-hidden bg-white');
  state = setProp(workspace.state, workspace.nodeId, 'layoutGridColumnWidths', JSON.stringify([{ value: '1', unit: 'fr' }, { value: '320', unit: 'px' }]));
  const slots = prepareGridSlots(state, workspace.nodeId);
  state = slots.state;

  // --- Rail (built first; main has no dependency on it here, but keeps the CMS-proven order) ---
  const sidebar = styledLayout(
    state,
    slots.slotIds[1]!,
    'layout.flex-column',
    'flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-y-auto border-s border-slate-200 bg-slate-50 px-3 pb-4 pt-[10px]',
  );
  state = sidebar.state;

  // Identity — person type locked (platform), lifecycle + source editable.
  const identitySection = formSection(state, sidebar.nodeId, 'Identity', 'sky');
  state = identitySection.state;
  const identityForm = insert(state, 'html.form', identitySection.bodyId);
  state = identityForm.state;
  state = bindRegionDetail(state, identityForm.nodeId, CUSTOMERS_DETAIL_DATA_SOURCE.id, { userId: 'routeParams.id' });
  state = metaField(state, identityForm.nodeId, 'Person type', 'personTypeCode', { inline: true, tone: 'sky' });
  state = metaField(state, identityForm.nodeId, 'Username', 'username', { inline: true });
  state = metaField(state, identityForm.nodeId, 'Email', 'email', { inline: true });
  state = metaField(state, identityForm.nodeId, 'Mobile', 'mobile', { inline: true });

  const identityEditForm = insert(state, 'html.form', identitySection.bodyId);
  state = identityEditForm.state;
  state = bindRegionDetail(state, identityEditForm.nodeId, CUSTOMERS_DETAIL_DATA_SOURCE.id, { userId: 'routeParams.id' });
  const identityToast = createDynamicAction('showToast');
  identityToast.toastTitle = 'Identity updated.';
  identityToast.toastVariant = 'success';
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: identityEditForm.nodeId,
    bindingKey: eventBindingKeyForEvent('onSubmit'),
    definition: createRegionSubmitEventBindingDefinition('onSubmit', { trueActions: [identityToast] }),
  });
  state = selectField(
    state, identityEditForm.nodeId, 'lifecycleStageCode', 'Lifecycle stage',
    input.filterOptions.lifecycleStages.map((o) => ({ value: o.value, label: o.label })),
  );
  state = selectField(
    state, identityEditForm.nodeId, 'sourceCode', 'Source',
    input.filterOptions.leadSources.map((o) => ({ value: o.value, label: o.label })),
  );
  const identitySubmit = insert(state, 'heroui.button-solid', identityEditForm.nodeId);
  state = setProp(identitySubmit.state, identitySubmit.nodeId, 'text', 'Save lifecycle / source');
  state = setProp(state, identitySubmit.nodeId, 'type', 'submit');
  state = setProp(state, identitySubmit.nodeId, 'className', 'bg-sky-600 text-white hover:bg-sky-700 w-full');

  // Ownership
  const ownerSection = formSection(state, sidebar.nodeId, 'Ownership', 'amber', true);
  state = ownerSection.state;
  const ownerForm = insert(state, 'html.form', ownerSection.bodyId);
  state = ownerForm.state;
  state = bindRegionDetail(state, ownerForm.nodeId, CUSTOMERS_DETAIL_DATA_SOURCE.id, { userId: 'routeParams.id' });
  state = metaField(state, ownerForm.nodeId, 'Owner', 'ownerUsername', { inline: true, tone: 'amber' });

  // Note — clickable placeholder pattern (empty vs bound preview), opens the identity edit form's
  // note field via a compact dedicated modal is out of scope here — kept as a plain textarea in main.

  // Audit trail
  const auditSection = formSection(state, sidebar.nodeId, 'Audit trail', 'slate', true);
  state = auditSection.state;
  const auditForm = insert(state, 'html.form', auditSection.bodyId);
  state = auditForm.state;
  state = bindRegionDetail(state, auditForm.nodeId, CUSTOMERS_DETAIL_DATA_SOURCE.id, { userId: 'routeParams.id' });
  state = metaField(state, auditForm.nodeId, 'Created at', 'createdAt', { inline: true });
  state = metaField(state, auditForm.nodeId, 'Created by', 'createdByUsername', { inline: true });
  state = metaField(state, auditForm.nodeId, 'Updated at', 'updatedAt', { inline: true });
  state = metaField(state, auditForm.nodeId, 'Updated by', 'updatedByUsername', { inline: true });

  // Tags
  const tagsSection = formSection(state, sidebar.nodeId, 'Tags', 'violet', true);
  state = tagsSection.state;
  const tagsForm = insert(state, 'html.form', tagsSection.bodyId);
  state = tagsForm.state;
  state = bindRegionDetail(state, tagsForm.nodeId, CUSTOMERS_TAGS_DATA_SOURCE.id, { userId: 'routeParams.id' });
  const tagsField = insert(state, 'heroui.select', tagsForm.nodeId);
  state = setProp(tagsField.state, tagsField.nodeId, 'label', '');
  state = setProp(state, tagsField.nodeId, 'placeholder', 'Select tags…');
  state = setProp(state, tagsField.nodeId, 'selectionMode', 'multiple');
  state = setProp(state, tagsField.nodeId, 'items', JSON.stringify(
    input.filterOptions.customerTags.map((option) => ({ id: option.value, textValue: option.label })),
  ));
  state = bindValue(state, tagsField.nodeId, 'tagCodes');
  const tagsSubmit = insert(state, 'heroui.button-solid', tagsForm.nodeId);
  state = setProp(tagsSubmit.state, tagsSubmit.nodeId, 'text', 'Save tags');
  state = setProp(state, tagsSubmit.nodeId, 'type', 'submit');
  state = setProp(state, tagsSubmit.nodeId, 'className', 'bg-violet-600 text-white hover:bg-violet-700 w-full mt-1');
  const tagsToast = createDynamicAction('showToast');
  tagsToast.toastTitle = 'Tags saved.';
  tagsToast.toastVariant = 'success';
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: tagsForm.nodeId,
    bindingKey: eventBindingKeyForEvent('onSubmit'),
    definition: createRegionSubmitEventBindingDefinition('onSubmit', { trueActions: [tagsToast] }),
  });

  // Related — count summary rows (heavy collections summarized, per P9).
  const relatedSection = formSection(state, sidebar.nodeId, 'Related', 'emerald', true);
  state = relatedSection.state;
  const relatedForm = insert(state, 'html.form', relatedSection.bodyId);
  state = relatedForm.state;
  state = bindRegionDetail(state, relatedForm.nodeId, CUSTOMERS_RELATED_COUNTS_DATA_SOURCE.id, { userId: 'routeParams.id' });
  state = metaField(state, relatedForm.nodeId, 'Opportunities', 'opportunities', { inline: true, tone: 'emerald' });
  state = metaField(state, relatedForm.nodeId, 'Activities', 'activities', { inline: true, tone: 'emerald' });
  state = metaField(state, relatedForm.nodeId, 'Tickets', 'tickets', { inline: true, tone: 'emerald' });
  state = metaField(state, relatedForm.nodeId, 'Linked individuals (company)', 'individuals', { inline: true, tone: 'emerald' });

  // --- Main (writable) ---
  const main = styledLayout(state, slots.slotIds[0]!, 'layout.flex-column', 'flex min-w-0 flex-1 flex-col overflow-y-auto bg-white p-4');
  state = main.state;

  const mainForm = insert(state, 'html.form', main.nodeId);
  state = mainForm.state;
  state = setProp(state, mainForm.nodeId, 'id', 'crm-customer-editor-form');
  state = setProp(state, mainForm.nodeId, 'className', 'flex flex-col gap-4');
  state = bindRegionDetail(state, mainForm.nodeId, CUSTOMERS_DETAIL_DATA_SOURCE.id, { userId: 'routeParams.id' });
  const mainToast = createDynamicAction('showToast');
  mainToast.toastTitle = 'Customer saved.';
  mainToast.toastVariant = 'success';
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: mainForm.nodeId,
    bindingKey: eventBindingKeyForEvent('onSubmit'),
    definition: createRegionSubmitEventBindingDefinition('onSubmit', { trueActions: [mainToast] }),
  });

  const profileSection = formSection(state, mainForm.nodeId, 'Profile', 'sky');
  state = profileSection.state;
  state = textField(state, profileSection.bodyId, 'firstname', 'First name');
  state = textField(state, profileSection.bodyId, 'lastname', 'Last name');
  state = textField(state, profileSection.bodyId, 'nickname', 'Nickname');
  state = textField(state, profileSection.bodyId, 'companyName', 'Company name');
  state = textField(state, profileSection.bodyId, 'registrationNumber', 'Registration number');
  state = textField(state, profileSection.bodyId, 'website', 'Website');

  const noteSection = formSection(state, mainForm.nodeId, 'CRM note', 'slate', true);
  state = noteSection.state;
  state = textField(state, noteSection.bodyId, 'note', 'Note', { multiline: true, rows: 4 });

  const document = patchDocumentPageShell(state.document);
  return finalizeBuiltDocument('crm-customers-editor', FOLDER, document, state.bindingDefinitions);
};
