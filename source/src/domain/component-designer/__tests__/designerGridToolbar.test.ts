import { describe, expect, it } from 'vitest';
import { EMPTY_GRID_QUERY } from '../../../shared/lib/appTableGridQuery';
import {
  createGridListResourceBindingDefinition,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from '../bindingGridEngine';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  buildGridListQueryParamBindings,
  buildServerQueryColumnFiltersFromGridColumns,
  buildServerQueryStorePatches,
  designerGridColumnsToListWhereFields,
  mergeManifestListWhereFieldsWithColumnLabels,
  DEFAULT_GRID_TOOLBAR_PRESET,
  normalizeDesignerGridToolbarConfig,
  parseDesignerGridToolbarConfig,
  resolveDesignerGridToolbarConfigForHwyMemberDirectoryList,
  resolveEffectiveFieldFilters,
  serializeDesignerGridToolbarConfig,
  serializeRoleFilterSelection,
  USERS_GRID_TOOLBAR_PRESET,
} from '../designerGridToolbarConfig';
import { resolveHydrationTargetUrl } from '../designerPreviewHydration';
import type { PreviewDataSourceHydrationTarget } from '../bindingDynamicActionsCodegen';

describe('designerGridToolbarConfig', () => {
  it('parses the generic standard toolbar preset without Users-specific filters', () => {
    const parsed = parseDesignerGridToolbarConfig(JSON.stringify(DEFAULT_GRID_TOOLBAR_PRESET));
    expect(parsed?.enabled).toBe(true);
    expect(parsed?.search?.enabled).toBe(true);
    expect(parsed?.create?.label).toBe('Add');
    expect(parsed?.create?.icon).toBe('Plus');
    expect(parsed?.roleFilters).toBeUndefined();
    expect(parsed?.serverQuery).toBeUndefined();
  });

  it('parses and serializes the Users example preset', () => {
    const parsed = parseDesignerGridToolbarConfig(JSON.stringify(USERS_GRID_TOOLBAR_PRESET));
    expect(parsed?.enabled).toBe(true);
    expect(parsed?.search?.enabled).toBe(true);
    expect(parsed?.roleFilters?.roles).toEqual(['ADMIN', 'DEVELOPER']);
    expect(parsed?.serverQuery?.enabled).toBe(true);
  });

  it('preserves a valid default param-filter value', () => {
    const config = {
      enabled: true,
      paramFilters: {
        enabled: true,
        filters: [{
          id: 'status',
          label: 'Status',
          options: [{ value: 'pending', label: 'Pending' }],
          storePath: 'gridToolbar.filters.status',
          apiParam: 'status',
          defaultValue: 'pending',
        }],
      },
    };

    const parsed = parseDesignerGridToolbarConfig(serializeDesignerGridToolbarConfig(config));
    expect(parsed?.paramFilters?.filters[0]?.defaultValue).toBe('pending');
  });

  it('builds query param bindings from toolbar server query config', () => {
    const bindings = buildGridListQueryParamBindings(USERS_GRID_TOOLBAR_PRESET);
    expect(bindings.search).toBe('gridToolbar.search');
    expect(bindings.roleNames).toBe('gridToolbar.roleNames');
    expect(bindings.sortBy).toBe('gridQuery.sortBy');
    expect(bindings.includeCount).toBe('static:page1Only');
    expect(bindings.email).toBe('gridQuery.filters.email');
  });

  it('binds static list view when serverQuery.listView is set', () => {
    const bindings = buildGridListQueryParamBindings({
      enabled: true,
      serverQuery: {
        enabled: true,
        listView: 'summary',
      },
      refresh: { enabled: true },
    });
    expect(bindings.view).toBe('static:summary');
    expect(bindings.includeCount).toBe('static:page1Only');
  });

  it('omits search and role bindings when those toolbar sections are disabled', () => {
    const bindings = buildGridListQueryParamBindings({
      enabled: true,
      serverQuery: USERS_GRID_TOOLBAR_PRESET.serverQuery,
      refresh: { enabled: true },
    });
    expect(bindings.search).toBeUndefined();
    expect(bindings.roleNames).toBeUndefined();
    expect(bindings.sortBy).toBe('gridQuery.sortBy');
  });

  it('maps filterable grid columns into server query column filters', () => {
    const mappings = buildServerQueryColumnFiltersFromGridColumns([
      { key: 'name', label: 'Name', filter: true, filterType: 'text' },
      { key: 'active', label: 'Active', filter: true, filterType: 'boolean' },
      { key: 'created_at', label: 'Created', filter: true, filterType: 'dateRange' },
      { key: '__actions', label: 'Actions', kind: 'action-group', filter: false },
    ]);

    expect(mappings).toEqual([
      { columnId: 'name', apiParam: 'filter[name][like]', kind: 'text' },
      { columnId: 'active', apiParam: 'filter[active][eq]', kind: 'boolean' },
      { columnId: 'created_at', apiParam: 'filter[created_at][gte]', kind: 'dateFrom' },
      { columnId: 'created_at', apiParam: 'filter[created_at][lte]', kind: 'dateTo' },
    ]);
  });

  it('merges manifest list where fields with grid column labels', () => {
    const merged = mergeManifestListWhereFieldsWithColumnLabels(
      [
        { id: 'id', label: 'id', type: 'text' },
        { id: 'displayFullName', label: 'displayFullName', type: 'text' },
      ],
      [
        { id: 'displayFullName', label: 'Member', type: 'text' },
      ],
    );
    expect(merged).toEqual([
      { id: 'id', label: 'id', type: 'text' },
      { id: 'displayFullName', label: 'Member', type: 'text' },
    ]);
  });

  it('maps designer grid columns to list where fields using column key and label', () => {
    const fields = designerGridColumnsToListWhereFields([
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'active', label: 'Active', cellKind: 'boolean-icon', filterType: 'boolean' },
      { key: 'created_at', label: 'Created', cellKind: 'date', filterType: 'dateRange' },
      { key: '__actions', label: 'Actions', kind: 'action-group' },
    ]);

    expect(fields).toEqual([
      { id: 'id', label: 'ID', type: 'text' },
      { id: 'name', label: 'Name', type: 'text' },
      { id: 'active', label: 'Active', type: 'boolean' },
      { id: 'created_at', label: 'Created', type: 'date' },
    ]);
  });

  it('normalizes disabled toolbar sections before serialize', () => {
    const serialized = serializeDesignerGridToolbarConfig({
      enabled: true,
      search: { enabled: false, placeholder: 'ignored' },
      refresh: { enabled: true },
    });
    const parsed = parseDesignerGridToolbarConfig(serialized);
    expect(parsed?.search).toBeUndefined();
    expect(parsed?.refresh?.enabled).toBe(true);
  });

  it('preserves an explicitly disabled refresh control', () => {
    const serialized = serializeDesignerGridToolbarConfig({
      enabled: true,
      search: { enabled: true },
      refresh: { enabled: false },
    });
    expect(parseDesignerGridToolbarConfig(serialized)?.refresh).toEqual({ enabled: false });
  });

  it('serialize stores explicit disabled toolbar state', () => {
    expect(serializeDesignerGridToolbarConfig({ enabled: false })).toBe('{"enabled":false}');
    expect(normalizeDesignerGridToolbarConfig({ enabled: false })).toEqual({ enabled: false });
  });

  it('serializes role filter selection', () => {
    expect(serializeRoleFilterSelection({ ADMIN: true, USER: false, DEVELOPER: true })).toBe('ADMIN,DEVELOPER');
  });

  it('maps grid query state to store patches', () => {
    const patches = buildServerQueryStorePatches({
      ...EMPTY_GRID_QUERY,
      sort: { columnId: 'email', direction: 'asc' },
      filters: {
        email: { type: 'text', value: 'alice@example.com' },
        locked: { type: 'boolean', value: 'true' },
      },
    }, {
      page: 2,
      pageSize: 50,
      searchText: 'alice',
      roleFilters: { ADMIN: true, DEVELOPER: false },
      config: USERS_GRID_TOOLBAR_PRESET.serverQuery!,
      searchStorePath: 'gridToolbar.search',
      roleStorePath: 'gridToolbar.roleNames',
    });

    expect(patches['gridQuery.sortBy']).toBe('email');
    expect(patches['gridQuery.sortDir']).toBe('asc');
    expect(patches['gridQuery.page']).toBe(2);
    expect(patches['gridQuery.pageSize']).toBe(50);
    expect(patches['gridToolbar.search']).toBe('alice');
    expect(patches['gridToolbar.roleNames']).toBe('ADMIN');
    expect(patches['gridQuery.filters.email']).toBe('alice@example.com');
    expect(patches['gridQuery.filters.locked']).toBe('true');
  });

  it('appends query params to hydration URL', () => {
    const target: PreviewDataSourceHydrationTarget = {
      dataSourceId: 'users',
      dataVar: 'gridData_test',
      endpoint: '/api/users',
      queryParams: {
        search: 'gridToolbar.search',
        sortBy: 'gridQuery.sortBy',
      },
    };

    const url = resolveHydrationTargetUrl(target, {
      gridToolbar: { search: 'alice' },
      gridQuery: { sortBy: 'email' },
    });

    expect(url).toContain('search=alice');
    expect(url).toContain('sortBy=email');
  });

  it('sends includeCount=true on page 1 and false on later pages (static:page1Only)', () => {
    const target: PreviewDataSourceHydrationTarget = {
      dataSourceId: 'hwy',
      dataVar: 'gridData_test',
      endpoint: '/api/hwy/member-directory',
      queryParams: {
        page: 'gridQuery.page',
        includeCount: 'static:page1Only',
      },
    };

    expect(resolveHydrationTargetUrl(target, { gridQuery: { page: 1 } })).toContain('includeCount=true');
    expect(resolveHydrationTargetUrl(target, { gridQuery: { page: 2 } })).toContain('includeCount=false');
  });

  it('merges member-directory legacy field filters into hydration URLs', () => {
    const target: PreviewDataSourceHydrationTarget = {
      dataSourceId: 'hwy',
      dataVar: 'gridData_members',
      endpoint: '/api/hwy/member-directory',
      queryParams: {
        search: 'gridToolbar.search',
        listScope: 'static:HWY_Members_List_All',
      },
    };

    const url = resolveHydrationTargetUrl(target, {
      gridToolbar: {
        search: '',
        legacy: { username: 'ali' },
      },
    });

    expect(url).toContain('filter%5Busername%5D%5Bcontains%5D=ali');
    expect(url).not.toContain('search=');
  });

  it('resolves static: query values in hydration URLs (parity with resolveBindingUrl)', () => {
    const target: PreviewDataSourceHydrationTarget = {
      dataSourceId: 'cms',
      dataVar: 'gridData_cms',
      endpoint: '/api/cms/contents',
      queryParams: {
        view: 'static:summary',
        'filter[statusCode][eq]': 'gridToolbar.filters.statusCode',
      },
    };

    const url = resolveHydrationTargetUrl(target, {
      gridToolbar: { filters: { statusCode: '101.002.003' } },
    });

    expect(url).toContain('view=summary');
    expect(url).toContain('filter%5BstatusCode%5D%5Beq%5D=101.002.003');
  });

  it('migrates legacy paramFilters with filter[field][op] apiParam into a real field name', () => {
    const parsed = parseDesignerGridToolbarConfig(JSON.stringify({
      enabled: true,
      paramFilters: {
        enabled: true,
        filters: [{
          id: 'statusCode',
          label: 'Status',
          options: [{ value: 'draft', label: 'Draft' }],
          storePath: 'gridToolbar.filters.statusCode',
          apiParam: 'filter[statusCode][eq]',
        }],
      },
    }));

    expect(resolveEffectiveFieldFilters(parsed)).toEqual([
      expect.objectContaining({
        id: 'statusCode',
        field: 'statusCode',
        controlType: 'radio-group',
        apiParam: 'filter[statusCode][eq]',
      }),
    ]);
  });
});

describe('set-grid-toolbar-config reducer', () => {
  it('updates toolbar prop and grid list binding query params in one mutation', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'email'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('users'),
    });

    const beforeFingerprint = JSON.stringify(state.document.nodes[gridNodeId]);

    state = designerReducer(state, {
      type: 'set-grid-toolbar-config',
      nodeId: gridNodeId,
      config: USERS_GRID_TOOLBAR_PRESET,
    });

    const node = state.document.nodes[gridNodeId]!;
    expect(node.props.toolbarConfig).toContain('"enabled":true');
    expect(node.binding[GRID_LIST_RESOURCE_BINDING_KEY]?.queryParams?.search).toBe('gridToolbar.search');
    expect(JSON.stringify(state.document.nodes[gridNodeId])).not.toBe(beforeFingerprint);
    expect(state.isDirty).toBe(true);
  });

  it('enables quick search on Hawiety member-directory toolbars when missing from config', () => {
    const base = parseDesignerGridToolbarConfig(JSON.stringify({
      enabled: true,
      refresh: { enabled: true },
      serverQuery: { enabled: true },
    }));
    const resolved = resolveDesignerGridToolbarConfigForHwyMemberDirectoryList(base, true);
    expect(resolved?.search?.enabled).toBe(true);
    expect(resolved?.search?.apiParam).toBe('search');
    expect(resolveDesignerGridToolbarConfigForHwyMemberDirectoryList(base, false)).toBe(base);
  });
});
