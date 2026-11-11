/**
 * Voting Phase 3b — Voting scopes catalog wired to /api/voting/votings (vote_votings).
 */

import { designerReducer } from '../../src/domain/component-designer/state';
import type { DataSourceDefinition } from '../../src/domain/component-designer/types';
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
  finalizeBuiltDocument,
  patchDocumentPageShell,
  setProp,
  standardGrid,
  type VotingDesignerDraftBundle,
} from './votingDesignerScaffold';
import type { VotingFilterOptions } from './votingIds';

const FOLDER = 'voting';

const buildVotingsListDataSource = (): DataSourceDefinition => ({
  id: 'voteVotingsList',
  name: 'Vote votings',
  endpoint: '/api/voting/votings',
  primaryKey: 'id',
  fields: ['id', 'title', 'statusCode', 'startsAt', 'endsAt', 'geoRootId', 'operatorNote', 'updatedAt'],
  kind: 'collection',
  operations: {
    list: { method: 'GET', endpoint: '/api/voting/votings' },
    create: { method: 'POST', endpoint: '/api/voting/votings' },
    update: { method: 'PUT', endpoint: '/api/voting/votings/:id' },
    delete: { method: 'DELETE', endpoint: '/api/voting/votings/:id' },
  },
  responseMapping: { arrayPath: 'data', totalPath: 'count', dataPath: 'data' },
});

const statusFieldConfig = (options: VotingFilterOptions['votingStatusOptions']) => ({
  field: { name: 'statusCode', type: 'string' as const, location: 'body' as const, required: false },
  enabled: true,
  label: 'Status',
  controlPaletteItemId: 'heroui.input-select',
  controlProps: {
    items: options.map((option) => ({ key: option.value, label: option.label })),
  },
});

export const buildVotingVotingsListDraft = (input: {
  filterOptions: VotingFilterOptions;
}): VotingDesignerDraftBundle => {
  const dataSource = buildVotingsListDataSource();

  let state = createRecordsPageState('Voting');
  state = designerReducer(state, { type: 'set-data-source', dataSourceId: dataSource.id, dataSource });
  state = setProp(state, state.document.rootNodeId, 'className', 'flex h-full min-h-0 w-full flex-col bg-white');

  const columns: DesignerDataGridColumn[] = [
    {
      key: 'title',
      label: 'Title',
      sort: true,
      filter: true,
      filterType: 'text',
      cardRole: 'title',
      cellKind: 'link',
      cellFields: { labelField: 'title', hrefTemplate: '/studio/voting/votings/edit/{id}' },
    } as DesignerDataGridColumn,
    {
      key: 'statusCode',
      label: 'Status',
      sort: true,
      width: '10rem',
      cellKind: 'lookup',
      cellFields: {
        labelField: 'statusCode',
        lookupEntries: input.filterOptions.votingStatusOptions.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      },
      cardRole: 'meta',
    } as DesignerDataGridColumn,
    {
      key: 'startsAt',
      label: 'Starts',
      sort: true,
      cellKind: 'date',
      cardRole: 'meta',
    },
    {
      key: 'endsAt',
      label: 'Ends',
      sort: true,
      cellKind: 'date',
      cardRole: 'meta',
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sort: true,
      cellKind: 'date',
      cardRole: 'meta',
    },
  ];

  const toolbarConfig: DesignerGridToolbarConfig = {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: 'Search voting scopes…' },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    create: {
      enabled: true,
      label: 'New voting scope',
      icon: 'Plus',
      behavior: { kind: 'none' },
    },
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(columns),
    },
  };

  const gridResult = standardGrid(state, state.document.rootNodeId, dataSource.id, columns, {
    searchPlaceholder: 'Search voting scopes…',
    resourceLabel: 'voting scopes',
    defaultSortBy: 'title',
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
    dataSource,
    formFields: [
      {
        field: { name: 'title', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Title',
        controlPaletteItemId: 'heroui.input-text',
      },
      statusFieldConfig(input.filterOptions.votingStatusOptions),
      {
        field: { name: 'startsAt', type: 'string', location: 'body', required: false },
        enabled: true,
        label: 'Starts',
        controlPaletteItemId: 'heroui.date-picker',
        controlProps: { granularity: 'minute', className: 'w-full' },
      },
      {
        field: { name: 'endsAt', type: 'string', location: 'body', required: false },
        enabled: true,
        label: 'Ends',
        controlPaletteItemId: 'heroui.date-picker',
        controlProps: { granularity: 'minute', className: 'w-full' },
      },
      {
        field: { name: 'operatorNote', type: 'string', location: 'body', required: false },
        enabled: true,
        label: 'Operator note',
        controlPaletteItemId: 'heroui.input-textarea',
      },
    ],
    editFormFields: [
      {
        field: { name: 'title', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Title',
        controlPaletteItemId: 'heroui.input-text',
      },
      statusFieldConfig(input.filterOptions.votingStatusOptions),
      {
        field: { name: 'startsAt', type: 'string', location: 'body', required: false },
        enabled: true,
        label: 'Starts',
        controlPaletteItemId: 'heroui.date-picker',
        controlProps: { granularity: 'minute', className: 'w-full' },
      },
      {
        field: { name: 'endsAt', type: 'string', location: 'body', required: false },
        enabled: true,
        label: 'Ends',
        controlPaletteItemId: 'heroui.date-picker',
        controlProps: { granularity: 'minute', className: 'w-full' },
      },
      {
        field: { name: 'operatorNote', type: 'string', location: 'body', required: false },
        enabled: true,
        label: 'Operator note',
        controlPaletteItemId: 'heroui.input-textarea',
      },
    ],
    actions: { create: true, edit: false, delete: true },
    resourceLabel: 'voting scope',
    toolbarConfig,
    createNavigateTarget: '/studio/voting/votings/edit/{response.data.id}',
    createResponseStorePath: 'response',
    createSuccessBehaviors: ['toast'],
  });
  state = built.state;

  const document = patchDocumentPageShell(state.document);
  return finalizeBuiltDocument('voting-votings', FOLDER, document, state.bindingDefinitions);
};
