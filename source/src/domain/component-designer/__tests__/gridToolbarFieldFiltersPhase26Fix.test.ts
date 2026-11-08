/**
 * Bug found (Users gap U9 — Phase 26): DesignerGridToolbarConfig only knew hard-coded
 * `roleFilters` (checkbox list named for roles, no matchLogic) and radio-only `paramFilters`.
 * The real Users toolbar needs generic checkbox/radio filters on any field plus AND/OR match
 * logic (`ToolbarFilterMatchLogicBadge` / `roleMatch`). Fixed in designerGridToolbarConfig.ts /
 * designerGridPageToolbar*.tsx / InspectorGridToolbarField.tsx / bindingCodegen + tsxPhase2Palette:
 * `fieldFilters` with migration from legacy `roleFilters`.
 */
import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import {
  createGridListResourceBindingDefinition,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from '../bindingGridEngine';
import {
  applyDesignerGridToolbarClientFilters,
  buildGridListQueryParamBindings,
  migrateRoleFiltersToFieldFilter,
  normalizeDesignerGridToolbarConfig,
  parseDesignerGridToolbarConfig,
  resolveEffectiveFieldFilters,
  serializeDesignerGridToolbarConfig,
  USERS_GRID_TOOLBAR_PRESET,
} from '../designerGridToolbarConfig';
import { resolveHydrationTargetUrl } from '../designerPreviewHydration';
import type { PreviewDataSourceHydrationTarget } from '../bindingDynamicActionsCodegen';
import type { DesignerState } from '../types';

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('Phase 26 grid toolbar fieldFilters (U9)', () => {
  it('migrates legacy roleFilters documents into a fieldFilters entry with field=roles', () => {
    const legacySerialized = JSON.stringify({
      enabled: true,
      roleFilters: {
        enabled: true,
        roles: ['ADMIN', 'DEVELOPER'],
        storePath: 'gridToolbar.roleNames',
        apiParam: 'roleNames',
      },
      serverQuery: { enabled: true },
    });

    const parsed = parseDesignerGridToolbarConfig(legacySerialized);
    expect(parsed?.roleFilters?.roles).toEqual(['ADMIN', 'DEVELOPER']);
    expect(parsed?.fieldFilters).toEqual([
      expect.objectContaining({
        id: 'roles',
        field: 'roles',
        controlType: 'checkbox-group',
        apiParam: 'roleNames',
        storePath: 'gridToolbar.roleNames',
        matchLogic: 'or',
        matchLogicApiParam: 'roleMatch',
      }),
    ]);
    expect(parsed?.fieldFilters?.[0]?.options).toEqual([
      { value: 'ADMIN', label: 'ADMIN' },
      { value: 'DEVELOPER', label: 'DEVELOPER' },
    ]);

    const normalized = normalizeDesignerGridToolbarConfig(parsed!);
    expect(resolveEffectiveFieldFilters(normalized)[0]).toMatchObject({
      field: 'roles',
      controlType: 'checkbox-group',
      matchLogicApiParam: 'roleMatch',
    });
    // Legacy mirror kept so Auto Table/CRUD + older consumers keep compiling.
    expect(normalized.roleFilters?.roles).toEqual(['ADMIN', 'DEVELOPER']);
  });

  it('migrateRoleFiltersToFieldFilter preserves store/api paths without dropping options', () => {
    const migrated = migrateRoleFiltersToFieldFilter({
      enabled: true,
      roles: ['USER'],
      storePath: 'custom.roles',
      apiParam: 'roles',
    });
    expect(migrated).toMatchObject({
      field: 'roles',
      storePath: 'custom.roles',
      apiParam: 'roles',
      matchLogicApiParam: 'roleMatch',
      options: [{ value: 'USER', label: 'USER' }],
    });
  });

  it('USERS_GRID_TOOLBAR_PRESET still round-trips and exposes roleNames + roleMatch bindings', () => {
    const parsed = parseDesignerGridToolbarConfig(serializeDesignerGridToolbarConfig(USERS_GRID_TOOLBAR_PRESET));
    const bindings = buildGridListQueryParamBindings(parsed);
    expect(bindings.roleNames).toBe('gridToolbar.roleNames');
    expect(bindings.roleMatch).toBe('gridToolbar.roleMatch');
  });

  it('applies checkbox matchLogic AND vs OR on client-side filtering', () => {
    const rows = [
      { id: 1, roles: ['ADMIN', 'USER'] },
      { id: 2, roles: ['ADMIN'] },
      { id: 3, roles: ['USER'] },
    ];
    const fieldFilters = [{
      id: 'roles',
      field: 'roles',
      label: 'Roles',
      controlType: 'checkbox-group' as const,
      optionsSource: 'static' as const,
      options: [
        { value: 'ADMIN', label: 'ADMIN' },
        { value: 'USER', label: 'USER' },
      ],
      matchLogic: 'or' as const,
      apiParam: 'roleNames',
      storePath: 'gridToolbar.roleNames',
    }];

    const orIds = applyDesignerGridToolbarClientFilters(rows, {
      fieldFilters,
      checkboxSelections: { roles: { ADMIN: true, USER: true } },
      matchLogicByFilterId: { roles: 'or' },
    }).map((row) => row.id);
    expect(orIds).toEqual([1, 2, 3]);

    const andIds = applyDesignerGridToolbarClientFilters(rows, {
      fieldFilters,
      checkboxSelections: { roles: { ADMIN: true, USER: true } },
      matchLogicByFilterId: { roles: 'and' },
    }).map((row) => row.id);
    expect(andIds).toEqual([1]);
  });

  it('codegen: radio field filter on status lands in exported fetch URL via designerStore', () => {
    let state = insert(createInitialDesignerState(), 'heroui.app-table-grid');
    const nodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'orders',
      dataSource: {
        id: 'orders',
        name: 'Orders',
        endpoint: '/api/orders',
        fields: ['id', 'status'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/orders' } },
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('orders'),
    });

    const toolbarConfig = normalizeDesignerGridToolbarConfig({
      enabled: true,
      search: { enabled: true, storePath: 'gridToolbar.search', apiParam: 'search' },
      fieldFilters: [{
        id: 'status',
        field: 'status',
        label: 'Status',
        controlType: 'radio-group',
        optionsSource: 'static',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
        ],
        apiParam: 'status',
        storePath: 'gridToolbar.status',
      }],
      serverQuery: { enabled: true },
    });

    state = designerReducer(state, {
      type: 'set-grid-toolbar-config',
      nodeId,
      config: toolbarConfig,
    });

    const node = state.document.nodes[nodeId]!;
    const binding = node.binding[GRID_LIST_RESOURCE_BINDING_KEY];
    expect(binding?.queryParams?.status).toBe('gridToolbar.status');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('grid toolbar status radio field filter export', tsx);
    expect(tsx).toMatch(/resolveBindingUrl\("\/api\/orders", designerStore, \{[^}]*"status":\s*"gridToolbar\.status"/);
    expect(tsx).toContain('handleGridRadioFilterChange_');
    expect(tsx).toContain('gridToolbar.status');

    // Runtime helper: store value for the radio filter must appear on the hydration URL.
    const target: PreviewDataSourceHydrationTarget = {
      dataSourceId: 'orders',
      dataVar: 'gridData_status',
      endpoint: '/api/orders',
      queryParams: {
        status: 'gridToolbar.status',
      },
    };
    const url = resolveHydrationTargetUrl(target, {
      gridToolbar: { status: 'open' },
    });
    expect(url).toContain('status=open');
  });
});
