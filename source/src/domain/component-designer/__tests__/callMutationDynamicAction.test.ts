import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import {
  createDynamicActionsEventBindingDefinition,
  eventBindingKeyForEvent,
} from '../bindingEngine';
import {
  createDynamicAction,
  resolveDynamicActions,
  resolveMutationRuntimeUrl,
  resolveMutationUrlExpressionForCodegen,
} from '../bindingDynamicActionsEngine';
import { executeDynamicActions } from '../bindingDynamicActionsRuntime';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderBindingComponentPreamble } from '../bindingCodegen';

/**
 * Group D: "Delete" (and arbitrary Create/Update) previously had NO mechanism anywhere in the
 * stack — no row-action behavior kind, no Dynamic Action type, nothing that could call a
 * mutating endpoint outside a Data Region form. `callMutation` fills that gap as a reusable
 * Dynamic Action: it resolves a Data Source's `operations.<create|update|delete>` endpoint,
 * substitutes a record id read from a designerStore path, and — because it can fail — stops the
 * rest of its `trueActions` chain (e.g. a refresh + success toast) when the request fails.
 */

describe('resolveMutationRuntimeUrl', () => {
  it('substitutes a colon path param with the record id', () => {
    expect(resolveMutationRuntimeUrl('/api/users/:id', 42)).toBe('/api/users/42');
  });

  it('appends the record id when the endpoint has no path param', () => {
    expect(resolveMutationRuntimeUrl('/api/users', 42)).toBe('/api/users/42');
  });

  it('returns the bare endpoint when there is no record id (create)', () => {
    expect(resolveMutationRuntimeUrl('/api/users', undefined)).toBe('/api/users');
  });
});

describe('resolveMutationUrlExpressionForCodegen', () => {
  it('emits a literal string when there is no record id expression', () => {
    expect(resolveMutationUrlExpressionForCodegen('/api/users', null)).toBe('"/api/users"');
  });

  it('emits a template-splice expression around a colon path param', () => {
    const expr = resolveMutationUrlExpressionForCodegen('/api/users/:id', 'designerStore?.selection?.id');
    // eslint-disable-next-line no-new-func
    const url = new Function('designerStore', `return (${expr});`)({ selection: { id: 7 } });
    expect(url).toBe('/api/users/7');
  });
});

describe('callMutation dynamic action resolution', () => {
  it('resolves method/endpoint from the data source delete operation', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'name'],
        primaryKey: 'id',
        operations: {
          list: { method: 'GET', endpoint: '/api/users' },
          delete: { method: 'DELETE', endpoint: '/api/users/:id' },
        },
      },
    });

    const deleteAction = createDynamicAction('callMutation');
    deleteAction.dataSourceRef = 'users';
    deleteAction.mutationRecordIdStorePath = 'selection.id';

    const definition = createDynamicActionsEventBindingDefinition('onClick', [deleteAction]);
    const resolved = resolveDynamicActions(definition, state.bindingDefinitions);
    expect(resolved).toHaveLength(1);
    const action = resolved[0]!;
    expect(action.type).toBe('callMutation');
    if (action.type === 'callMutation') {
      expect(action.method).toBe('DELETE');
      expect(action.endpoint).toBe('/api/users/:id');
      expect(action.mutationOperation).toBe('delete');
      expect(action.mutationRecordIdStorePath).toBe('selection.id');
    }
  });

  it('silently drops the action when the data source has no matching operation', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id'],
        operations: { list: { method: 'GET', endpoint: '/api/users' } },
      },
    });

    const deleteAction = createDynamicAction('callMutation');
    deleteAction.dataSourceRef = 'users';

    const definition = createDynamicActionsEventBindingDefinition('onClick', [deleteAction]);
    expect(resolveDynamicActions(definition, state.bindingDefinitions)).toEqual([
      expect.objectContaining({
        type: 'callMutation',
        endpoint: '',
        dataSourceRef: 'users',
      }),
    ]);
  });
});

describe('callMutation runtime execution', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls the resolved endpoint and continues the chain on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const patchStore = vi.fn();
    await executeDynamicActions(
      [
        {
          id: 'da_1',
          type: 'callMutation',
          dataSourceRef: 'users',
          mutationOperation: 'delete',
          method: 'DELETE',
          endpoint: '/api/users/:id',
          mutationRecordIdStorePath: 'selection.id',
        },
        {
          id: 'da_2',
          type: 'setValue',
          targetNodeId: 'n1',
          storePath: 'ranAfterDelete',
          valueSource: 'static',
          staticValue: 'yes',
        },
      ],
      { designerStore: { selection: { id: 7 } }, patchStore },
    );

    expect(fetchMock).toHaveBeenCalledWith('/api/users/7', expect.objectContaining({ method: 'DELETE' }));
    expect(patchStore).toHaveBeenCalledWith('ranAfterDelete', 'yes');
  });

  it('stops the chain (no refresh/success actions) when the mutation fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const patchStore = vi.fn();
    await executeDynamicActions(
      [
        {
          id: 'da_1',
          type: 'callMutation',
          dataSourceRef: 'users',
          mutationOperation: 'delete',
          method: 'DELETE',
          endpoint: '/api/users/:id',
          mutationRecordIdStorePath: 'selection.id',
        },
        {
          id: 'da_2',
          type: 'setValue',
          targetNodeId: 'n1',
          storePath: 'ranAfterDelete',
          valueSource: 'static',
          staticValue: 'yes',
        },
      ],
      { designerStore: { selection: { id: 7 } }, patchStore },
    );

    expect(patchStore).not.toHaveBeenCalled();
  });

  it('sends a configured static body for update mutations', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await executeDynamicActions(
      [{
        id: 'da_archive',
        type: 'callMutation',
        dataSourceRef: 'contents',
        mutationOperation: 'update',
        method: 'PUT',
        endpoint: '/api/contents/:id',
        mutationRecordIdStorePath: 'selection.id',
        mutationBody: { statusCode: 'archived' },
      }],
      { designerStore: { selection: { id: 9 } }, patchStore: vi.fn() },
    );

    expect(fetchMock).toHaveBeenCalledWith('/api/contents/9', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ statusCode: 'archived' }),
    }));
  });

  it('stops the success chain when delete has no selected record id', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const patchStore = vi.fn();

    await executeDynamicActions(
      [
        {
          id: 'da_1',
          type: 'callMutation',
          dataSourceRef: 'users',
          mutationOperation: 'delete',
          method: 'DELETE',
          endpoint: '/api/users/:id',
          mutationRecordIdStorePath: 'selection.id',
        },
        {
          id: 'da_2',
          type: 'showHide',
          targetNodeId: 'dlg',
          visibilityStorePath: 'ui.visibility.dlg',
          showHideEffect: 'hide',
        },
      ],
      { designerStore: { selection: {} }, patchStore },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(patchStore).not.toHaveBeenCalled();
  });

  it('stops the success chain when delete reports zero rows removed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      clone() {
        return this;
      },
      json: async () => ({ success: true, data: { deleted: 0 } }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    const patchStore = vi.fn();

    await executeDynamicActions(
      [
        {
          id: 'da_1',
          type: 'callMutation',
          dataSourceRef: 'users',
          mutationOperation: 'delete',
          method: 'DELETE',
          endpoint: '/api/users/:id',
          mutationRecordIdStorePath: 'selection.id',
        },
        {
          id: 'da_2',
          type: 'showHide',
          targetNodeId: 'dlg',
          visibilityStorePath: 'ui.visibility.dlg',
          showHideEffect: 'hide',
        },
      ],
      { designerStore: { selection: { id: 'missing' } }, patchStore },
    );

    expect(fetchMock).toHaveBeenCalled();
    expect(patchStore).not.toHaveBeenCalled();
  });
});

describe('callMutation codegen', () => {
  it('emits a guarded fetch call and gates chained actions on its success', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: state.document.rootNodeId,
    });
    const buttonId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'name'],
        primaryKey: 'id',
        operations: {
          list: { method: 'GET', endpoint: '/api/users' },
          delete: { method: 'DELETE', endpoint: '/api/users/:id' },
        },
      },
    });

    const deleteAction = createDynamicAction('callMutation');
    deleteAction.dataSourceRef = 'users';
    deleteAction.mutationRecordIdStorePath = 'selection.id';
    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Deleted';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [deleteAction, toastAction]),
    });

    const preamble = renderBindingComponentPreamble(state.document, state.bindingDefinitions).join('\n');
    expect(preamble).toMatch(/let mutationOk_\w+ = true;/);
    expect(preamble).toContain("method: \"DELETE\"");
    expect(preamble).toContain('parseApiErrorMessage(response)');
    expect(preamble).toMatch(/if \(mutationOk_\w+\) \{\s*\n\s*toast\("Deleted"/);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toMatch(/import \{[^}]*\btoast\b[^}]*\} from '@heroui\/react';/);
  });

  it('emits a static update payload', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: state.document.rootNodeId,
    });
    const buttonId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'contents',
      dataSource: {
        id: 'contents',
        name: 'Contents',
        endpoint: '/api/contents',
        fields: ['id', 'statusCode'],
        primaryKey: 'id',
        operations: {
          update: { method: 'PUT', endpoint: '/api/contents/:id' },
        },
      },
    });

    const archiveAction = createDynamicAction('callMutation');
    archiveAction.dataSourceRef = 'contents';
    archiveAction.mutationOperation = 'update';
    archiveAction.mutationRecordIdStorePath = 'selection.id';
    archiveAction.mutationBody = { statusCode: 'archived' };
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [archiveAction]),
    });

    const preamble = renderBindingComponentPreamble(state.document, state.bindingDefinitions).join('\n');
    expect(preamble).toContain('body: JSON.stringify({ "statusCode": "archived" })');
  });

  it('resolves {store.path} placeholders in mutationBody at runtime', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await executeDynamicActions(
      [{
        id: 'da_stage',
        type: 'callMutation',
        dataSourceRef: 'crmOpportunities',
        mutationOperation: 'changeStage',
        method: 'POST',
        endpoint: '/api/crm/opportunities/:id/change-stage',
        mutationRecordIdStorePath: 'board.lastMove.cardId',
        mutationBody: { toStageCode: '{board.lastMove.toColumnId}' },
      }],
      {
        designerStore: {
          board: {
            lastMove: { cardId: '42', toColumnId: 'stage-won' },
          },
        },
        patchStore: vi.fn(),
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/crm/opportunities/42/change-stage',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ toStageCode: 'stage-won' }),
      }),
    );
  });
});
