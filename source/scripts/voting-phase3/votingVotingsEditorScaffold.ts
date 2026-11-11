/**
 * Voting scope editor — questions (ballots) + participant choices (candidates).
 */

import { designerReducer } from '../../src/domain/component-designer/state';
import type { DataSourceDefinition, DesignerState } from '../../src/domain/component-designer/types';
import {
  appendRecordsCrudOverlays,
  createRecordsPageState,
} from '../crm-phase3/designerRecordsPageBuilder';
import {
  buildServerQueryColumnFiltersFromGridColumns,
  DEFAULT_GRID_SERVER_QUERY_CONFIG,
  DEFAULT_GRID_TOOLBAR_REFRESH,
  DEFAULT_GRID_TOOLBAR_SEARCH,
  type DesignerGridToolbarConfig,
} from '../../src/domain/component-designer/designerGridToolbarConfig';
import type { DesignerDataGridColumn } from '../../src/domain/component-designer/designerDataGridColumns';
import {
  parseDesignerAppTableGridColumns,
  serializeDesignerDataGridColumns,
} from '../../src/domain/component-designer/designerDataGridColumns';
import type { DesignerGridRowActionBehavior } from '../../src/domain/component-designer/designerGridActionColumns';
import { parseDesignerGridToolbarConfig, serializeDesignerGridToolbarConfig } from '../../src/domain/component-designer/designerGridToolbarConfig';
import {
  createDynamicAction,
  createDynamicActionsEventBindingDefinition,
} from '../../src/domain/component-designer/bindingDynamicActionsEngine';
import { eventBindingKeyForEvent } from '../../src/domain/component-designer/bindingEngine';
import { createRegionSubmitEventBindingDefinition } from '../../src/domain/component-designer/bindingRegionEngine';
import {
  bindRegionDetail,
  boundText,
  finalizeBuiltDocument,
  formSection,
  insert,
  patchDocumentPageShell,
  prepareGridSlots,
  setDataSource,
  setProp,
  selectField,
  setVisibleCondition,
  standardGrid,
  styledLayout,
  dateTimeField,
  textField,
  type VotingDesignerDraftBundle,
  wireCreateModalFieldFromStore,
  metaField,
} from './votingDesignerScaffold';
import type { VotingFilterOptions } from './votingIds';

const FOLDER = 'voting';

const VOTING_DETAIL = {
  id: 'voteVotingDetail',
  name: 'Voting scope (detail)',
  endpoint: '/api/voting/votings',
  primaryKey: 'id',
  fields: ['id', 'title', 'statusCode', 'startsAt', 'endsAt', 'operatorNote', 'updatedAt'],
};

const BALLOTS_LIST: DataSourceDefinition = {
  id: 'voteBallotsList',
  name: 'Ballots',
  endpoint: '/api/voting/ballots',
  primaryKey: 'id',
  fields: ['id', 'votingId', 'title', 'selectionMode', 'maxSelections', 'sortOrder', 'ballotTypeCode', 'statusCode', 'updatedAt'],
  kind: 'collection',
  operations: {
    list: { method: 'GET', endpoint: '/api/voting/ballots' },
    create: { method: 'POST', endpoint: '/api/voting/ballots' },
    update: { method: 'PUT', endpoint: '/api/voting/ballots/:id' },
    delete: { method: 'DELETE', endpoint: '/api/voting/ballots/:id' },
  },
  responseMapping: { arrayPath: 'data', totalPath: 'count', dataPath: 'data' },
};

const POLLING_STATIONS_LIST: DataSourceDefinition = {
  id: 'votePollingStationsList',
  name: 'Polling stations',
  endpoint: '/api/voting/polling-stations',
  primaryKey: 'id',
  fields: ['id', 'votingId', 'title', 'isActive', 'operatorNote', 'geoNodeId', 'updatedAt'],
  kind: 'collection',
  operations: {
    list: { method: 'GET', endpoint: '/api/voting/polling-stations' },
    create: { method: 'POST', endpoint: '/api/voting/polling-stations' },
    update: { method: 'PUT', endpoint: '/api/voting/polling-stations/:id' },
    delete: { method: 'DELETE', endpoint: '/api/voting/polling-stations/:id' },
  },
  responseMapping: { arrayPath: 'data', totalPath: 'count', dataPath: 'data' },
};

const CANDIDATES_LIST: DataSourceDefinition = {
  id: 'voteCandidatesList',
  name: 'Participant choices',
  endpoint: '/api/voting/candidates',
  primaryKey: 'id',
  fields: ['id', 'votingId', 'ballotId', 'displayName', 'sortOrder', 'statusCode', 'updatedAt'],
  kind: 'collection',
  operations: {
    list: { method: 'GET', endpoint: '/api/voting/candidates' },
    create: { method: 'POST', endpoint: '/api/voting/candidates' },
    update: { method: 'PUT', endpoint: '/api/voting/candidates/:id' },
    delete: { method: 'DELETE', endpoint: '/api/voting/candidates/:id' },
  },
  responseMapping: { arrayPath: 'data', totalPath: 'count', dataPath: 'data' },
};

const SELECTION_MODE_OPTIONS = [
  { value: 'single', label: 'Single choice (pick one)' },
  { value: 'multiple', label: 'Multiple choice (pick several)' },
];

const ACTIVE_BALLOT_KEYS_PATH = 'voteEditor.activeBallotKeys';
const ACTIVE_BALLOT_ID_PATH = 'voteEditor.activeBallotKeys.0';
/** Visibility conditions must use the `store.` prefix (visibilityConditionEngine). */
const ACTIVE_BALLOT_SELECTED_COND = 'store.voteEditor.activeBallotKeys.0';
const ACTIVE_BALLOT_UNSELECTED_COND = '!store.voteEditor.activeBallotKeys.0';

const withSelectionStorePath = (
  behavior: DesignerGridRowActionBehavior | undefined,
  selectionStorePath: string,
): DesignerGridRowActionBehavior | undefined => {
  if (!behavior || behavior.kind !== 'open-modal') {
    return behavior;
  }
  return { ...behavior, selectionStorePath };
};

const patchGridCrudSelectionStore = (
  state: DesignerState,
  gridNodeId: string,
  selectionStorePath: string,
  options: { clearTitleCellClick?: boolean } = {},
): DesignerState => {
  const grid = state.document.nodes[gridNodeId];
  if (!grid) {
    return state;
  }

  let columns = parseDesignerAppTableGridColumns(grid.props.columns).map((column) => {
    if (options.clearTitleCellClick && column.key === 'title') {
      const { cellClickBehavior: _drop, ...rest } = column;
      return rest;
    }
    if (column.cellClickBehavior?.kind === 'open-modal') {
      return {
        ...column,
        cellClickBehavior: withSelectionStorePath(column.cellClickBehavior, selectionStorePath),
      };
    }
    if (column.actionBehavior) {
      return {
        ...column,
        actionBehavior: withSelectionStorePath(column.actionBehavior, selectionStorePath),
      };
    }
    if (column.actions?.length) {
      return {
        ...column,
        actions: column.actions.map((action) => ({
          ...action,
          behavior: withSelectionStorePath(action.behavior, selectionStorePath),
        })),
      };
    }
    return column;
  });

  const toolbar = parseDesignerGridToolbarConfig(grid.props.toolbarConfig) ?? { enabled: true };
  const nextToolbar = toolbar.create?.behavior?.kind === 'open-modal' && toolbar.create
    ? {
      ...toolbar,
      create: {
        ...toolbar.create,
        behavior: withSelectionStorePath(toolbar.create.behavior, selectionStorePath),
      },
    }
    : toolbar;

  return {
    ...state,
    document: {
      ...state.document,
      nodes: {
        ...state.document.nodes,
        [gridNodeId]: {
          ...grid,
          props: {
            ...grid.props,
            columns: serializeDesignerDataGridColumns(columns),
            toolbarConfig: serializeDesignerGridToolbarConfig(nextToolbar),
          },
        },
      },
    },
  };
};

const ensureVoteEditorStoreSegments = (state: DesignerState): DesignerState => ({
  ...state,
  bindingDefinitions: {
    ...state.bindingDefinitions,
    storeSegments: {
      ...state.bindingDefinitions.storeSegments,
      voteEditor: {
        id: 'voteEditor',
        persist: 'none',
        initialValue: { activeBallotKeys: [] as string[] },
      },
      selection: {
        id: 'selection',
        persist: 'none',
        initialValue: {
          id: null,
          ballotId: null,
          choiceId: null,
        },
      },
    },
  },
});

const registerEditorDataSources = (state: DesignerState): DesignerState => {
  let next = setDataSource(state, VOTING_DETAIL.id, VOTING_DETAIL.name, {
    endpoint: '/api/voting/votings/:id',
    primaryKey: VOTING_DETAIL.primaryKey,
    fields: VOTING_DETAIL.fields,
    operations: {
      detail: { method: 'GET', endpoint: '/api/voting/votings/:id' },
      update: { method: 'PUT', endpoint: '/api/voting/votings/:id' },
    },
  });
  next = designerReducer(next, { type: 'set-data-source', dataSourceId: BALLOTS_LIST.id, dataSource: BALLOTS_LIST });
  next = designerReducer(next, { type: 'set-data-source', dataSourceId: CANDIDATES_LIST.id, dataSource: CANDIDATES_LIST });
  next = designerReducer(next, { type: 'set-data-source', dataSourceId: POLLING_STATIONS_LIST.id, dataSource: POLLING_STATIONS_LIST });
  return next;
};

const stationFormFields = () => [
  {
    field: { name: 'votingId', type: 'number' as const, location: 'body' as const, required: true },
    enabled: true,
    label: 'Voting scope',
    controlPaletteItemId: 'heroui.input-text',
    controlProps: { className: 'hidden', readOnly: true },
  },
  {
    field: { name: 'title', type: 'string' as const, location: 'body' as const, required: true },
    enabled: true,
    label: 'Station title',
    controlPaletteItemId: 'heroui.input-text',
    controlProps: { placeholder: 'e.g. Central hall — district 3' },
  },
  {
    field: { name: 'isActive', type: 'boolean' as const, location: 'body' as const, required: false },
    enabled: true,
    label: 'Active',
    controlPaletteItemId: 'heroui.switch',
  },
  {
    field: { name: 'operatorNote', type: 'string' as const, location: 'body' as const, required: false },
    enabled: true,
    label: 'Operator note',
    controlPaletteItemId: 'heroui.textarea',
    controlProps: { rows: 3 },
  },
];

const ballotFormFields = () => [
  {
    field: { name: 'votingId', type: 'number' as const, location: 'body' as const, required: true },
    enabled: true,
    label: 'Voting scope',
    controlPaletteItemId: 'heroui.input-text',
    controlProps: { className: 'hidden', readOnly: true },
  },
  {
    field: { name: 'title', type: 'string' as const, location: 'body' as const, required: true },
    enabled: true,
    label: 'Question / ballot title',
    controlPaletteItemId: 'heroui.input-text',
    controlProps: { placeholder: 'e.g. Choose the committee chair' },
  },
  {
    field: { name: 'selectionMode', type: 'string' as const, location: 'body' as const, required: true },
    enabled: true,
    label: 'How many choices can each voter pick?',
    controlPaletteItemId: 'heroui.radio-group',
    controlProps: {
      items: JSON.stringify(
        SELECTION_MODE_OPTIONS.map((option) => ({ key: option.value, label: option.label })),
      ),
      defaultValue: 'single',
    },
  },
  {
    field: { name: 'maxSelections', type: 'number' as const, location: 'body' as const, required: false },
    enabled: true,
    label: 'Max selections (multiple only)',
    controlPaletteItemId: 'heroui.input-text',
    controlProps: { placeholder: 'Leave empty for no limit' },
  },
  {
    field: { name: 'sortOrder', type: 'number' as const, location: 'body' as const, required: true },
    enabled: true,
    label: 'Display order',
    controlPaletteItemId: 'heroui.input-text',
    controlProps: { placeholder: '0' },
  },
];

const candidateFormFields = () => [
  {
    field: { name: 'votingId', type: 'number' as const, location: 'body' as const, required: true },
    enabled: true,
    label: 'Voting scope',
    controlPaletteItemId: 'heroui.input-text',
    controlProps: { className: 'hidden', readOnly: true },
  },
  {
    field: { name: 'ballotId', type: 'number' as const, location: 'body' as const, required: true },
    enabled: true,
    label: 'Question',
    controlPaletteItemId: 'heroui.input-text',
    controlProps: { className: 'hidden', readOnly: true },
  },
  {
    field: { name: 'displayName', type: 'string' as const, location: 'body' as const, required: true },
    enabled: true,
    label: 'Choice label (what voters see)',
    controlPaletteItemId: 'heroui.input-text',
    controlProps: { placeholder: 'e.g. Option A — Dr. Sara Ahmadi' },
  },
  {
    field: { name: 'sortOrder', type: 'number' as const, location: 'body' as const, required: true },
    enabled: true,
    label: 'Display order',
    controlPaletteItemId: 'heroui.input-text',
    controlProps: { placeholder: '0' },
  },
];

export const buildVotingVotingsEditorDraft = (input: {
  filterOptions: VotingFilterOptions;
}): VotingDesignerDraftBundle => {
  let state = createRecordsPageState('Voting scope');
  state = registerEditorDataSources(state);
  state = ensureVoteEditorStoreSegments(state);
  state = setProp(state, state.document.rootNodeId, 'publishedFormAssist', false);

  const page = styledLayout(
    state,
    state.document.rootNodeId,
    'layout.flex-column',
    'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white',
  );
  state = page.state;

  const actionBar = styledLayout(
    state,
    page.nodeId,
    'layout.flex-row',
    'flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5',
  );
  state = actionBar.state;
  state = bindRegionDetail(state, actionBar.nodeId, VOTING_DETAIL.id, { id: 'routeParams.id' });

  const backButton = insert(state, 'heroui.button-outline', actionBar.nodeId);
  state = setProp(backButton.state, backButton.nodeId, 'workspaceBack', true);
  state = setProp(state, backButton.nodeId, 'aria-label', 'Back to voting scopes');
  state = setProp(state, backButton.nodeId, 'title', 'Back to list');
  const backNavigate = createDynamicAction('navigate');
  backNavigate.navigateTarget = '/studio/voting/votings';
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

  const saveButton = insert(state, 'heroui.button-solid', actionBar.nodeId);
  state = setProp(saveButton.state, saveButton.nodeId, 'text', 'Save scope');
  state = setProp(state, saveButton.nodeId, 'icon', 'Save');
  state = setProp(state, saveButton.nodeId, 'type', 'submit');
  state = setProp(state, saveButton.nodeId, 'form', 'voting-scope-editor-form');
  state = setProp(state, saveButton.nodeId, 'className', 'bg-violet-600 text-white hover:bg-violet-700');

  const workspace = styledLayout(
    state,
    page.nodeId,
    'layout.grid-2',
    'grid min-h-0 flex-1 gap-0 overflow-hidden bg-white',
  );
  state = setProp(
    workspace.state,
    workspace.nodeId,
    'layoutGridColumnWidths',
    JSON.stringify([{ value: '1', unit: 'fr' }, { value: '320', unit: 'px' }]),
  );
  const slots = prepareGridSlots(state, workspace.nodeId);
  state = slots.state;

  const sidebar = styledLayout(
    state,
    slots.slotIds[1]!,
    'layout.flex-column',
    'flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-s border-slate-200 bg-slate-50 px-3 pb-4 pt-[10px]',
  );
  state = sidebar.state;

  const scopeForm = insert(state, 'html.form', sidebar.nodeId);
  state = scopeForm.state;
  state = setProp(state, scopeForm.nodeId, 'id', 'voting-scope-editor-form');
  state = bindRegionDetail(state, scopeForm.nodeId, VOTING_DETAIL.id, { id: 'routeParams.id' });
  const scopeToast = createDynamicAction('showToast');
  scopeToast.toastTitle = 'Voting scope saved.';
  scopeToast.toastVariant = 'success';
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: scopeForm.nodeId,
    bindingKey: eventBindingKeyForEvent('onSubmit'),
    definition: createRegionSubmitEventBindingDefinition('onSubmit', { trueActions: [scopeToast] }),
  });

  const scopeSection = formSection(state, scopeForm.nodeId, 'Scope settings', 'violet');
  state = scopeSection.state;
  state = metaField(state, scopeSection.bodyId, 'Record id', 'id', { mono: true, tone: 'violet', inline: true });
  state = metaField(state, scopeSection.bodyId, 'Current status (code)', 'statusCode', { tone: 'sky' });
  state = textField(state, scopeSection.bodyId, 'title', 'Title');
  state = selectField(
    state,
    scopeSection.bodyId,
    'statusCode',
    'Status',
    input.filterOptions.votingStatusOptions.map((option) => ({ value: option.value, label: option.label })),
    { nullable: true },
  );
  state = dateTimeField(state, scopeSection.bodyId, 'startsAt', 'Starts');
  state = dateTimeField(state, scopeSection.bodyId, 'endsAt', 'Ends');
  state = textField(state, scopeSection.bodyId, 'operatorNote', 'Operator note', { multiline: true, rows: 4 });

  const main = styledLayout(
    state,
    slots.slotIds[0]!,
    'layout.flex-column',
    'flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-5',
  );
  state = main.state;

  const ballotColumns: DesignerDataGridColumn[] = [
    {
      key: 'title',
      label: 'Question',
      sort: true,
      filter: true,
      filterType: 'text',
      cardRole: 'title',
    },
    {
      key: 'selectionMode',
      label: 'Pick rule',
      sort: true,
      width: '9.5rem',
      cellKind: 'lookup',
      cellFields: {
        labelField: 'selectionMode',
        lookupEntries: [
          { value: 'single', label: 'One answer' },
          { value: 'multiple', label: 'Several answers' },
        ],
      },
      cardRole: 'meta',
    } as DesignerDataGridColumn,
    {
      key: 'maxSelections',
      label: 'Max picks',
      sort: true,
      cardRole: 'meta',
    },
    {
      key: 'sortOrder',
      label: 'Order',
      sort: true,
      cardRole: 'meta',
    },
  ];

  const ballotToolbar: DesignerGridToolbarConfig = {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: 'Search questions…' },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    create: {
      enabled: true,
      label: 'Add question',
      icon: 'Plus',
      behavior: { kind: 'none' },
    },
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(ballotColumns),
    },
  };

  const ballotsHost = styledLayout(
    state,
    main.nodeId,
    'layout.flex-column',
    'flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden',
  );
  state = ballotsHost.state;

  const ballotSection = formSection(state, ballotsHost.nodeId, 'Questions for participants', 'indigo', true);
  state = ballotSection.state;
  const ballotHelp = insert(state, 'html.text', ballotSection.bodyId);
  state = setProp(
    ballotHelp.state,
    ballotHelp.nodeId,
    'text',
    'Click a question row to load its choices below. Pick rule: single = one answer; multiple = voter may pick several.',
  );
  state = setProp(
    state,
    ballotHelp.nodeId,
    'className',
    'text-xs leading-relaxed text-indigo-900/80 ps-[4px] pb-1',
  );
  state = setProp(
    state,
    ballotSection.bodyId,
    'className',
    'flex min-h-0 min-w-0 flex-1 flex-col gap-2',
  );

  const ballotGrid = standardGrid(state, ballotSection.bodyId, BALLOTS_LIST.id, ballotColumns, {
    searchPlaceholder: 'Search questions…',
    resourceLabel: 'questions',
    defaultSortBy: 'sortOrder',
    primaryKey: 'id',
    toolbarConfig: ballotToolbar,
    presentation: 'table',
    pagination: true,
    pageSize: 25,
    listQueryParams: { 'filter[votingId][eq]': 'routeParams.id' },
  });
  state = ballotGrid.state;
  state = setProp(state, ballotGrid.gridId, 'className', 'flex min-h-[200px] min-w-0 flex-[3] flex-col');
  state = setProp(state, ballotGrid.gridId, 'selectionMode', 'single');
  state = setProp(state, ballotGrid.gridId, 'selectionStorePath', ACTIVE_BALLOT_KEYS_PATH);
  state = setProp(state, ballotGrid.gridId, 'emptyContent', 'No questions yet. Use Add question to define what voters will answer.');

  const ballotsBuilt = appendRecordsCrudOverlays({
    state,
    gridNodeId: ballotGrid.gridId,
    dataSource: BALLOTS_LIST,
    formFields: ballotFormFields(),
    editFormFields: ballotFormFields(),
    actions: { create: true, edit: true, delete: true },
    resourceLabel: 'question',
    toolbarConfig: ballotToolbar,
  });
  state = ballotsBuilt.state;
  state = patchGridCrudSelectionStore(state, ballotGrid.gridId, 'selection.ballotId', { clearTitleCellClick: true });
  state = wireCreateModalFieldFromStore(state, ballotsBuilt.createModalNodeId, 'votingId', 'routeParams.id');
  state = wireCreateModalFieldFromStore(state, ballotsBuilt.editModalNodeId, 'votingId', 'routeParams.id');

  const choiceColumns: DesignerDataGridColumn[] = [
    {
      key: 'displayName',
      label: 'Choice',
      sort: true,
      filter: true,
      filterType: 'text',
      cardRole: 'title',
    },
    {
      key: 'sortOrder',
      label: 'Order',
      sort: true,
      cardRole: 'meta',
    },
  ];

  const choiceToolbar: DesignerGridToolbarConfig = {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: 'Search choices…' },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    create: {
      enabled: true,
      label: 'Add choice',
      icon: 'Plus',
      behavior: { kind: 'none' },
    },
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(choiceColumns),
    },
  };

  const choicesHost = styledLayout(
    state,
    main.nodeId,
    'layout.flex-column',
    'flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden',
  );
  state = choicesHost.state;

  const choiceSection = formSection(state, choicesHost.nodeId, 'Participant choices', 'emerald', true);
  state = choiceSection.state;
  const choiceHint = insert(state, 'html.text', choiceSection.bodyId);
  state = setProp(
    choiceHint.state,
    choiceHint.nodeId,
    'text',
    'Choices for the selected question appear below.',
  );
  state = setProp(state, choiceHint.nodeId, 'className', 'text-xs leading-relaxed text-emerald-900/80 ps-[4px]');
  state = setVisibleCondition(state, choiceHint.nodeId, ACTIVE_BALLOT_SELECTED_COND);

  const choicePickPrompt = insert(state, 'html.text', choiceSection.bodyId);
  state = setProp(
    choicePickPrompt.state,
    choicePickPrompt.nodeId,
    'text',
    'No question selected — pick a row in Questions for participants.',
  );
  state = setProp(
    state,
    choicePickPrompt.nodeId,
    'className',
    'rounded-md border border-dashed border-emerald-200 bg-emerald-50/60 px-3 py-4 text-center text-xs font-medium text-emerald-800',
  );
  state = setVisibleCondition(state, choicePickPrompt.nodeId, ACTIVE_BALLOT_UNSELECTED_COND);

  const choicePanel = styledLayout(
    state,
    choiceSection.bodyId,
    'layout.flex-column',
    'flex min-h-0 min-w-0 flex-1 flex-col gap-2',
  );
  state = choicePanel.state;

  const choiceGrid = standardGrid(state, choicePanel.nodeId, CANDIDATES_LIST.id, choiceColumns, {
    searchPlaceholder: 'Search choices…',
    resourceLabel: 'choices',
    defaultSortBy: 'sortOrder',
    primaryKey: 'id',
    toolbarConfig: choiceToolbar,
    presentation: 'cards',
    pagination: true,
    pageSize: 50,
    listQueryParams: {
      'filter[votingId][eq]': 'routeParams.id',
      'filter[ballotId][eq]': ACTIVE_BALLOT_ID_PATH,
    },
  });
  state = choiceGrid.state;
  state = setProp(state, choiceGrid.gridId, 'className', 'flex min-h-[200px] min-w-0 flex-[2] flex-col');
  state = setVisibleCondition(state, choiceGrid.gridId, ACTIVE_BALLOT_SELECTED_COND);
  state = setProp(
    state,
    choiceGrid.gridId,
    'emptyContent',
    'No choices for this question yet. Use Add choice to create voter options.',
  );

  const choicesBuilt = appendRecordsCrudOverlays({
    state,
    gridNodeId: choiceGrid.gridId,
    dataSource: CANDIDATES_LIST,
    formFields: candidateFormFields(),
    editFormFields: candidateFormFields(),
    actions: { create: true, edit: true, delete: true },
    resourceLabel: 'choice',
    toolbarConfig: choiceToolbar,
  });
  state = choicesBuilt.state;
  state = patchGridCrudSelectionStore(state, choiceGrid.gridId, 'selection.choiceId', { clearTitleCellClick: true });
  if (choicesBuilt.createModalNodeId) {
    state = setVisibleCondition(state, choicesBuilt.createModalNodeId, ACTIVE_BALLOT_SELECTED_COND);
  }
  state = wireCreateModalFieldFromStore(state, choicesBuilt.createModalNodeId, 'votingId', 'routeParams.id');
  state = wireCreateModalFieldFromStore(state, choicesBuilt.createModalNodeId, 'ballotId', ACTIVE_BALLOT_ID_PATH);
  state = wireCreateModalFieldFromStore(state, choicesBuilt.editModalNodeId, 'votingId', 'routeParams.id');

  const stationColumns: DesignerDataGridColumn[] = [
    {
      key: 'title',
      label: 'Station',
      sort: true,
      filter: true,
      filterType: 'text',
      cardRole: 'title',
    },
    {
      key: 'isActive',
      label: 'Active',
      sort: true,
      width: '6rem',
      cellKind: 'boolean-icon',
      cardRole: 'meta',
    },
    {
      key: 'operatorNote',
      label: 'Note',
      sort: false,
      cardRole: 'meta',
    },
  ];

  const stationToolbar: DesignerGridToolbarConfig = {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: 'Search stations…' },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    create: {
      enabled: true,
      label: 'Add station',
      icon: 'Plus',
      behavior: { kind: 'none' },
    },
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(stationColumns),
    },
  };

  const stationsHost = styledLayout(
    state,
    main.nodeId,
    'layout.flex-column',
    'flex min-h-0 min-w-0 shrink-0 flex-col gap-2 overflow-hidden',
  );
  state = stationsHost.state;

  const stationSection = formSection(state, stationsHost.nodeId, 'Polling stations (Cars)', 'amber', true);
  state = stationSection.state;
  const stationHelp = insert(state, 'html.text', stationSection.bodyId);
  state = setProp(
    stationHelp.state,
    stationHelp.nodeId,
    'text',
    'Physical or logical polling locations for this voting scope (legacy Elections_Cars parity).',
  );
  state = setProp(state, stationHelp.nodeId, 'className', 'text-xs leading-relaxed text-amber-900/80 ps-[4px] pb-1');

  const stationGrid = standardGrid(state, stationSection.bodyId, POLLING_STATIONS_LIST.id, stationColumns, {
    searchPlaceholder: 'Search stations…',
    resourceLabel: 'stations',
    defaultSortBy: 'title',
    primaryKey: 'id',
    toolbarConfig: stationToolbar,
    presentation: 'table',
    pagination: true,
    pageSize: 15,
    listQueryParams: { 'filter[votingId][eq]': 'routeParams.id' },
  });
  state = stationGrid.state;
  state = setProp(state, stationGrid.gridId, 'className', 'flex min-h-[160px] min-w-0 flex-col');
  state = setProp(
    state,
    stationGrid.gridId,
    'emptyContent',
    'No polling stations yet. Use Add station when you are ready for on-site voting.',
  );

  const stationsBuilt = appendRecordsCrudOverlays({
    state,
    gridNodeId: stationGrid.gridId,
    dataSource: POLLING_STATIONS_LIST,
    formFields: stationFormFields(),
    editFormFields: stationFormFields(),
    actions: { create: true, edit: true, delete: true },
    resourceLabel: 'station',
    toolbarConfig: stationToolbar,
  });
  state = stationsBuilt.state;
  state = wireCreateModalFieldFromStore(state, stationsBuilt.createModalNodeId, 'votingId', 'routeParams.id');
  state = wireCreateModalFieldFromStore(state, stationsBuilt.editModalNodeId, 'votingId', 'routeParams.id');

  const document = patchDocumentPageShell(state.document);
  return finalizeBuiltDocument('voting-votings-editor', FOLDER, document, state.bindingDefinitions);
};
