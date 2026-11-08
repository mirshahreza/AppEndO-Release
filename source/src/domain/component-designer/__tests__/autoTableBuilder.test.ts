/**
 * Bug found (parity audit item 108 / Phase 19): no wizard existed that builds a full
 * `heroui.app-table-grid` (columns + list binding + toolbar with serverQuery) from an API
 * response schema — existing Binding Grid wizards only connect a grid already on the canvas.
 * Fixed in autoTableTemplateBuilder.ts / AutoTableWizardDialog.tsx / apiFieldSchema.ts:
 * response-row OpenAPI → typed columns → toolbar with real queryParams for Export.
 */
import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { generateDesignerTsx } from '../codegen';
import {
  resolveEndpointResponseFieldsFromOpenApi,
  resolveEndpointResponseFormFieldsFromOpenApi,
  type ApiFormField,
} from '../apiFieldSchema';
import {
  buildAutoTableColumnConfigsFromFields,
  buildAutoTableDocument,
  buildAutoTableSeeds,
  buildDesignerColumnsFromAutoTableConfig,
  documentHasDesignedContent,
  mergeAutoTableIntoDocument,
  resolveAutoTableInsertTarget,
  suggestCellKindForField,
  type AutoTableBuildConfig,
} from '../autoTableTemplateBuilder';
import { buildDataSourceFromEndpoint } from '../bindingResourceModel';
import {
  APP_TABLE_GRID_PALETTE_ITEM_ID,
  parseDesignerDataGridColumns,
} from '../designerDataGridColumns';
import { parseDesignerGridToolbarConfig } from '../designerGridToolbarConfig';
import { GRID_LIST_RESOURCE_BINDING_KEY } from '../bindingGridEngine';
import { createInitialDesignerState, designerReducer } from '../state';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';

const LIST_SPEC = {
  openapi: '3.1.2',
  paths: {
    '/api/users': {
      get: {
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          email: { type: 'string', format: 'email' },
                          full_name: { type: 'string' },
                          active: { type: 'boolean' },
                          roles: { type: 'array', items: { type: 'string' } },
                          status: { type: 'string', enum: ['active', 'invited', 'locked'] },
                          avatar_url: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          locked: { type: 'boolean' },
                        },
                      },
                    },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const makeField = (overrides: Partial<ApiFormField> & { name: string }): ApiFormField => ({
  type: 'string',
  location: 'body',
  required: false,
  ...overrides,
});

const buildUsersTableConfig = (overrides: Partial<AutoTableBuildConfig> = {}): AutoTableBuildConfig => {
  const fields = resolveEndpointResponseFormFieldsFromOpenApi(LIST_SPEC, 'GET');
  const columns = buildAutoTableColumnConfigsFromFields(fields);
  return {
    title: 'Users table',
    includeTitle: true,
    dataSource: buildDataSourceFromEndpoint('/api/users', {
      fields: fields.map((field) => field.name),
      primaryKey: 'id',
      method: 'GET',
    }),
    columns,
    toolbar: { search: true, refresh: true, createButton: false },
    rowActions: [],
    ...overrides,
  };
};

describe('resolveEndpointResponseFormFieldsFromOpenApi (Phase 19)', () => {
  it('extracts typed response row fields (not request body) from a list endpoint', () => {
    const names = resolveEndpointResponseFieldsFromOpenApi(LIST_SPEC, 'GET');
    expect(names).toEqual(expect.arrayContaining([
      'id', 'email', 'full_name', 'active', 'roles', 'status', 'avatar_url', 'created_at', 'locked',
    ]));

    const typed = resolveEndpointResponseFormFieldsFromOpenApi(LIST_SPEC, 'GET');
    const byName = new Map(typed.map((field) => [field.name, field]));
    expect(byName.get('active')?.type).toBe('boolean');
    expect(byName.get('status')?.enum).toEqual(['active', 'invited', 'locked']);
    expect(byName.get('created_at')?.format).toBe('date-time');
    expect(byName.get('roles')?.type).toBe('array');
    expect(byName.get('id')).toBeDefined();
  });
});

describe('suggestCellKindForField', () => {
  it('maps OpenAPI field hints to App Table Grid cell kinds', () => {
    expect(suggestCellKindForField(makeField({ name: 'active', type: 'boolean' }))).toBe('boolean-icon');
    expect(suggestCellKindForField(makeField({ name: 'created_at', format: 'date-time' }))).toBe('date');
    expect(suggestCellKindForField(makeField({ name: 'status', enum: ['a', 'b'] }))).toBe('badge');
    expect(suggestCellKindForField(makeField({ name: 'roles', type: 'array', itemType: 'string' }))).toBe('chips');
    expect(suggestCellKindForField(makeField({ name: 'avatar_url' }))).toBe('avatar');
    expect(suggestCellKindForField(makeField({ name: 'profile_link' }))).toBe('link');
    expect(suggestCellKindForField(makeField({ name: 'locked' }))).toBe('lock-status');
    expect(suggestCellKindForField(makeField({ name: 'email' }))).toBe('text');
  });
});

describe('buildAutoTableSeeds / buildAutoTableDocument', () => {
  it('builds an app-table-grid seed with typed columns, toolbar, and list binding queryParams', () => {
    const config = buildUsersTableConfig({ rowActions: ['details'] });
    const seeds = buildAutoTableSeeds(config);
    expect(seeds).toHaveLength(1);
    expect(seeds[0]?.paletteItemId).toBe('layout.flex-column');
    const gridSeed = seeds[0]?.children?.find((child) => child.paletteItemId === APP_TABLE_GRID_PALETTE_ITEM_ID);
    expect(gridSeed).toBeDefined();

    const columns = parseDesignerDataGridColumns(gridSeed!.props?.columns);
    expect(columns.some((column) => column.key === 'email' && column.sort)).toBe(true);
    expect(columns.some((column) => column.key === 'active' && column.cellKind === 'boolean-icon')).toBe(true);
    expect(columns.some((column) => column.key === 'status' && column.cellKind === 'badge')).toBe(true);
    expect(columns.some((column) => column.key === 'roles' && column.cellKind === 'chips')).toBe(true);
    expect(columns.some((column) => column.kind === 'action' || column.key.startsWith('__action_'))).toBe(true);

    const toolbar = parseDesignerGridToolbarConfig(gridSeed!.props?.toolbarConfig);
    expect(toolbar?.enabled).toBe(true);
    expect(toolbar?.search?.enabled).toBe(true);
    expect(toolbar?.refresh?.enabled).toBe(true);
    expect(toolbar?.serverQuery?.enabled).toBe(true);

    const listBinding = gridSeed!.binding?.[GRID_LIST_RESOURCE_BINDING_KEY];
    expect(listBinding?.dataSourceRef).toBe(config.dataSource.id);
    expect(listBinding?.queryParams?.search).toBe('gridToolbar.search');
    expect(listBinding?.queryParams?.sortBy).toBe('gridQuery.sortBy');
    expect(listBinding?.queryParams?.page).toBe('gridQuery.page');
  });

  it('hydrates a fresh document with data source + preferred grid selection', () => {
    const result = buildAutoTableDocument(buildUsersTableConfig());
    expect(documentHasDesignedContent(result.document)).toBe(true);
    expect(result.bindingDefinitions.dataSources[result.document.nodes[result.preferredSelectedNodeId!]
      ? Object.keys(result.bindingDefinitions.dataSources)[0]!
      : '']).toBeDefined();

    const gridNode = Object.values(result.document.nodes).find(
      (node) => node.props[DESIGNER_PALETTE_ITEM_ID_PROP] === APP_TABLE_GRID_PALETTE_ITEM_ID,
    );
    expect(gridNode).toBeDefined();
    expect(result.preferredSelectedNodeId).toBe(gridNode!.id);
    expect(result.bindingDefinitions.dataSources.users ?? result.bindingDefinitions.dataSources[
      Object.keys(result.bindingDefinitions.dataSources)[0]!
    ]).toBeDefined();
  });

  it('exports TSX whose list fetch resolveBindingUrl includes toolbar queryParams (Phase 1 contract)', () => {
    const result = buildAutoTableDocument(buildUsersTableConfig());
    const tsx = generateDesignerTsx(result.document, result.bindingDefinitions);
    assertValidTsxSyntax('auto table with toolbar queryParams', tsx);

    expect(tsx).toMatch(/resolveBindingUrl\("\/api\/users", designerStore, \{[^}]*"search":\s*"gridToolbar\.search"/);
    expect(tsx).toMatch(/"sortBy":\s*"gridQuery\.sortBy"/);
    expect(tsx).toMatch(/"page":\s*"gridQuery\.page"/);
  });

  it('merges into an existing canvas container without wiping siblings', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.heading',
      parentId: state.document.rootNodeId,
    });
    const headingId = state.document.nodes[state.document.rootNodeId].children[0]!;
    expect(documentHasDesignedContent(state.document)).toBe(true);

    const target = resolveAutoTableInsertTarget(state.document, state.document.rootNodeId);
    expect(target).toEqual({ mode: 'container-insert', parentNodeId: state.document.rootNodeId });

    const merged = mergeAutoTableIntoDocument(
      state.document,
      state.bindingDefinitions,
      buildUsersTableConfig({ includeTitle: false }),
      target!,
    );

    expect(merged.document.nodes[headingId]).toBeDefined();
    expect(merged.document.nodes[state.document.rootNodeId].children).toContain(headingId);
    expect(merged.document.nodes[state.document.rootNodeId].children.length).toBeGreaterThan(1);
  });

  it('buildDesignerColumnsFromAutoTableConfig respects disabled columns and multi actions', () => {
    const config = buildUsersTableConfig({
      rowActions: ['edit', 'delete'],
      columns: buildAutoTableColumnConfigsFromFields(
        resolveEndpointResponseFormFieldsFromOpenApi(LIST_SPEC, 'GET'),
      ).map((entry) => (
        entry.field.name === 'avatar_url' ? { ...entry, enabled: false } : entry
      )),
    });
    const columns = buildDesignerColumnsFromAutoTableConfig(config);
    expect(columns.some((column) => column.key === 'avatar_url')).toBe(false);
    expect(columns.some((column) => column.kind === 'action-group')).toBe(true);
  });
});
