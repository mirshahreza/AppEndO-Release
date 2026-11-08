/**
 * Bug found (Users gap U5/U6 — Phase 25 / gap #33): session identity lived only as an ambient
 * `designerStore.user.*` injection for visibility/row-disable expressions — there was no formal
 * `sourceType: 'session'` for binding any prop (e.g. greeting text), and the only row-disable
 * presets that compared "this row vs current user" were hard-coded Users entity presets
 * (`users-login-as`). Fixed in bindingSessionEngine.ts / types.ts / designerGridRowDisableRules.ts /
 * inspectorBindingUi + Inspector*: formal session binding + general `current-user-row` preset.
 */
import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx, generateDesignerJsonString, parseDesignerJson } from '../codegen';
import { createSessionReadBindingDefinition } from '../bindingSessionEngine';
import {
  buildCurrentUserRowDisableExpression,
  compileDesignerRowConditionExpression,
  isDesignerGridRowDisabled,
  parseDesignerGridRowDisableRule,
} from '../designerGridRowDisableRules';
import { createDesignerPreviewBindingBridge } from '../designerPreviewResolvers';
import { collectDocumentBindingPlan, resolveBoundCanvasTextContent } from '../bindingEngine';
import { resolveStorePathExpression } from '../bindingStoreEngine';
import { serializeDesignerDataGridColumns } from '../designerDataGridColumns';
import type { DesignerDataGridColumn } from '../designerDataGridColumns';
import { createGridListResourceBindingDefinition, GRID_LIST_RESOURCE_BINDING_KEY } from '../bindingGridEngine';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const bindSessionProp = (
  state: DesignerState,
  nodeId: string,
  prop: string,
  sessionField: 'userId' | 'email' | 'role' | 'displayName',
): DesignerState => {
  const binding = createSessionReadBindingDefinition(prop, sessionField);
  return designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: binding.bindingKey,
    definition: binding.definition,
  });
};

describe('sourceType session binding (Phase 25 / U6)', () => {
  it('exports text bound to session.displayName as designerStore.user.displayName', () => {
    let state = insertItem(createInitialDesignerState(), 'html.text');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'text', value: 'Hello' });
    state = bindSessionProp(state, nodeId, 'text', 'displayName');

    const plan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    expect(plan.storeReadBindings.some((item) => (
      item.nodeId === nodeId
      && item.targetProp === 'text'
      && item.storePath === 'user.displayName'
      && item.definition.sourceType === 'session'
    ))).toBe(true);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('session displayName text export', tsx);
    expect(tsx).toContain(resolveStorePathExpression('user.displayName'));
    expect(tsx).toContain('{designerStore?.user?.displayName');
    expect(tsx).not.toMatch(/\stext=\{/);
  });

  it('resolves session.displayName in Preview with a mock session store', () => {
    let state = insertItem(createInitialDesignerState(), 'html.text');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'text', value: 'Hello' });
    state = bindSessionProp(state, nodeId, 'text', 'displayName');
    const node = state.document.nodes[nodeId]!;

    const bridge = createDesignerPreviewBindingBridge({
      previewResults: {},
      designerStore: {
        user: {
          id: 42,
          email: 'ada@example.com',
          role: 'ADMIN',
          displayName: 'Ada Lovelace',
        },
      },
      dataContext: {},
      document: state.document,
    });

    expect(bridge.resolveTextContent(node, 'fallback')).toBe('Ada Lovelace');
  });

  it('shows a Session canvas placeholder (not a dead static literal)', () => {
    let state = insertItem(createInitialDesignerState(), 'html.text');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'text', value: 'Hello' });
    state = bindSessionProp(state, nodeId, 'text', 'displayName');
    const node = state.document.nodes[nodeId]!;

    expect(resolveBoundCanvasTextContent(node, 'fallback')).toBe('[Session: displayName]');
  });

  it('round-trips sessionField through JSON sanitize', () => {
    let state = insertItem(createInitialDesignerState(), 'html.text');
    const nodeId = lastChildId(state);
    state = bindSessionProp(state, nodeId, 'text', 'email');

    const json = generateDesignerJsonString(state.document, state.bindingDefinitions);
    const parsed = parseDesignerJson(json);
    expect(parsed).not.toBeNull();
    const binding = parsed!.document.nodes[nodeId]?.binding[`prop:text`];
    expect(binding).toMatchObject({
      sourceType: 'session',
      sessionField: 'email',
      targetProp: 'text',
    });
  });
});

describe('current-user-row disable preset (Phase 25 / U5)', () => {
  it('parses and evaluates without hard-coding a users entity name', () => {
    const rule = parseDesignerGridRowDisableRule({
      preset: 'current-user-row',
      matchField: 'ownerId',
    });
    expect(rule).toEqual({ preset: 'current-user-row', matchField: 'ownerId' });
    expect(JSON.stringify(rule)).not.toMatch(/users/i);

    const store = { user: { id: 9 } };
    expect(isDesignerGridRowDisabled({ ownerId: 9, name: 'Mine' }, rule, store)).toBe(true);
    expect(isDesignerGridRowDisabled({ ownerId: 3, name: 'Other' }, rule, store)).toBe(false);
    expect(isDesignerGridRowDisabled({ id: 9, name: 'Wrong field' }, rule, store)).toBe(false);
  });

  it('defaults matchField to id and builds the same expression authors would write by hand', () => {
    expect(buildCurrentUserRowDisableExpression()).toBe('store.user.id === row.id');
    expect(buildCurrentUserRowDisableExpression('productOwnerId')).toBe(
      'store.user.id === row.productOwnerId',
    );

    const compiled = compileDesignerRowConditionExpression(buildCurrentUserRowDisableExpression('ownerId'));
    expect(compiled).toContain('designerStore');
    expect(compiled).toContain('item?.ownerId');

    const store = { user: { id: 5 } };
    expect(isDesignerGridRowDisabled({ id: 5 }, { preset: 'current-user-row' }, store)).toBe(true);
    expect(isDesignerGridRowDisabled({ id: 1 }, { preset: 'current-user-row' }, store)).toBe(false);
  });

  it('serializes current-user-row into App Table Grid export for a non-users datasource', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'orders',
      dataSource: {
        id: 'orders',
        name: 'Orders',
        endpoint: '/api/orders',
        fields: ['id', 'ownerId', 'total'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/orders' } },
      },
    });

    const columns: DesignerDataGridColumn[] = [
      { key: 'id', label: 'ID' },
      { key: 'ownerId', label: 'Owner' },
      {
        key: 'actions',
        label: '',
        kind: 'action-group',
        actions: [
          {
            actionId: 'delete',
            icon: 'Trash2',
            intent: 'delete',
            tooltip: 'Delete',
            disabledWhen: { preset: 'current-user-row', matchField: 'ownerId' },
          },
        ],
      },
    ];

    state = insertItem(state, 'heroui.app-table-grid');
    const gridNodeId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'columns',
      value: serializeDesignerDataGridColumns(columns),
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('orders'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('current-user-row grid export', tsx);
    expect(tsx).toContain('"preset":"current-user-row"');
    expect(tsx).toContain('"matchField":"ownerId"');
    expect(tsx).not.toMatch(/"preset":"users-/);
    // Must keep a live designerStore for isDesignerGridRowDisabled(current-user-row).
    expect(tsx).toMatch(/useDesignerStore|designerStore/);
  });

  it('keeps manual store.user.* expression presets working (regression)', () => {
    const row = { id: 7 };
    const expression = 'store.user.id === row.id';
    expect(isDesignerGridRowDisabled(row, {
      preset: 'expression',
      expression,
    }, { user: { id: 7 } })).toBe(true);
    expect(isDesignerGridRowDisabled(row, {
      preset: 'expression',
      expression,
    }, { user: { id: 1 } })).toBe(false);
  });
});

describe('session binding Preview render smoke (Phase 25)', () => {
  it('resolves session displayName for a Preview text node (behavioral assert)', () => {
    let state = insertItem(createInitialDesignerState(), 'html.text');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'text', value: 'Hello' });
    state = bindSessionProp(state, nodeId, 'text', 'displayName');

    const bridge = createDesignerPreviewBindingBridge({
      previewResults: {},
      designerStore: {
        user: { id: 1, email: 'a@b.c', role: 'USER', displayName: 'Grace Hopper' },
      },
      dataContext: {},
      document: state.document,
    });

    expect(bridge.resolveTextContent(state.document.nodes[nodeId]!, 'x')).toBe('Grace Hopper');
    expect(bridge.resolveTextContent(state.document.nodes[nodeId]!, 'x')).not.toBe('Hello');
  });
});
