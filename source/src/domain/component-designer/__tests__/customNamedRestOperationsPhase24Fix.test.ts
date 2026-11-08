/**
 * Bug found (parity audit / Users gap U1 — Phase 24): `callMutation` could only target the fixed
 * CRUD slots `operations.{create,update,delete}`. Real admin pages (Users: reset-password,
 * change-password, set-locked, update-roles, …) need arbitrary named REST ops with their own
 * method/endpoint while still chaining the same success actions (toast → close → refresh).
 * Fixed in types.ts / bindingResourceModel.ts / bindingDynamicActionsEngine.ts /
 * bindingLovRegistry.ts / codegen.ts / Inspector*: `operations.custom` + string
 * `mutationOperation` resolved via `resolveCallMutationOperation`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { transformSync } from 'esbuild';
import {
  createDynamicAction,
  createDynamicActionsEventBindingDefinition,
  resolveDynamicActions,
  resolveMutationRuntimeUrl,
} from '../bindingDynamicActionsEngine';
import { executeDynamicActions } from '../bindingDynamicActionsRuntime';
import { collectCallMutationDiagnostics } from '../bindingDiagnostics';
import { generateDesignerTsx, generateDesignerJsonString, parseDesignerJson } from '../codegen';
import { renderBindingComponentPreamble } from '../bindingCodegen';
import { eventBindingKeyForEvent } from '../bindingEngine';
import { sanitizeDataSourceDefinition } from '../bindingLovRegistry';
import {
  listCallMutationOperationOptions,
  resolveCallMutationOperation,
} from '../bindingResourceModel';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DataSourceDefinition } from '../types';

const usersDataSource = (): DataSourceDefinition => ({
  id: 'users',
  name: 'Users',
  endpoint: '/api/users',
  fields: ['id', 'name'],
  primaryKey: 'id',
  operations: {
    list: { method: 'GET', endpoint: '/api/users' },
    create: { method: 'POST', endpoint: '/api/users' },
    update: { method: 'PUT', endpoint: '/api/users/:id' },
    delete: { method: 'DELETE', endpoint: '/api/users/:id' },
    custom: {
      resetPassword: {
        method: 'POST',
        endpoint: '/api/users/:id/reset-password',
        label: 'Reset Password',
      },
      setLocked: {
        method: 'PATCH',
        endpoint: '/api/users/:id/locked',
        label: 'Toggle Lock',
      },
    },
  },
});

describe('resolveCallMutationOperation (Phase 24)', () => {
  it('resolves known create/update/delete slots', () => {
    const dataSource = usersDataSource();
    expect(resolveCallMutationOperation(dataSource, 'delete')).toMatchObject({
      ok: true,
      kind: 'known',
      operationKey: 'delete',
      operation: { method: 'DELETE', endpoint: '/api/users/:id' },
    });
    expect(resolveCallMutationOperation(dataSource, 'create')).toMatchObject({
      ok: true,
      kind: 'known',
      operationKey: 'create',
    });
    expect(resolveCallMutationOperation(dataSource, 'update')).toMatchObject({
      ok: true,
      kind: 'known',
      operationKey: 'update',
    });
  });

  it('resolves named custom operations under operations.custom', () => {
    const resolved = resolveCallMutationOperation(usersDataSource(), 'resetPassword');
    expect(resolved).toEqual({
      ok: true,
      kind: 'custom',
      operationKey: 'resetPassword',
      operation: {
        method: 'POST',
        endpoint: '/api/users/:id/reset-password',
        label: 'Reset Password',
      },
    });
  });

  it('returns a clear missing-operation failure for unknown custom keys (Diagnostics path)', () => {
    expect(resolveCallMutationOperation(usersDataSource(), 'assignRoles')).toEqual({
      ok: false,
      operationKey: 'assignRoles',
      reason: 'missing-operation',
    });
  });

  it('returns missing-data-source when the registry entry is absent', () => {
    expect(resolveCallMutationOperation(undefined, 'delete')).toEqual({
      ok: false,
      operationKey: 'delete',
      reason: 'missing-data-source',
    });
  });

  it('lists Inspector options with custom labels after the CRUD mutate slots', () => {
    const options = listCallMutationOperationOptions(usersDataSource());
    expect(options.map((entry) => entry.value)).toEqual([
      'delete',
      'create',
      'update',
      'resetPassword',
      'setLocked',
    ]);
    expect(options.find((entry) => entry.value === 'resetPassword')?.label).toBe('Reset Password');
  });
});

describe('callMutation custom named ops — resolve + runtime + diagnostics', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('resolveDynamicActions wires method/endpoint from operations.custom', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: usersDataSource(),
    });

    const action = createDynamicAction('callMutation');
    action.dataSourceRef = 'users';
    action.mutationOperation = 'resetPassword';
    action.mutationRecordIdStorePath = 'selection.id';

    const definition = createDynamicActionsEventBindingDefinition('onClick', [action]);
    const resolved = resolveDynamicActions(definition, state.bindingDefinitions);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      type: 'callMutation',
      mutationOperation: 'resetPassword',
      method: 'POST',
      endpoint: '/api/users/:id/reset-password',
      mutationRecordIdStorePath: 'selection.id',
    });
  });

  it('runtime executes the custom POST against the substituted URL and continues the chain', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const patchStore = vi.fn();
    await executeDynamicActions(
      [
        {
          id: 'da_1',
          type: 'callMutation',
          dataSourceRef: 'users',
          mutationOperation: 'resetPassword',
          method: 'POST',
          endpoint: '/api/users/:id/reset-password',
          mutationRecordIdStorePath: 'selection.id',
        },
        {
          id: 'da_2',
          type: 'setValue',
          targetNodeId: 'n1',
          storePath: 'ranAfterReset',
          valueSource: 'static',
          staticValue: 'yes',
        },
      ],
      { designerStore: { selection: { id: 42 } }, patchStore },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/42/reset-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
    expect(patchStore).toHaveBeenCalledWith('ranAfterReset', 'yes');
  });

  it('collectCallMutationDiagnostics reports missing custom ops instead of silent drop', () => {
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
      dataSource: usersDataSource(),
    });

    const action = createDynamicAction('callMutation');
    action.dataSourceRef = 'users';
    action.mutationOperation = 'assignRoles';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [action]),
    });

    const issues = collectCallMutationDiagnostics(state.document, state.bindingDefinitions);
    expect(issues.some((issue) =>
      issue.severity === 'error'
      && issue.message.includes('assignRoles')
      && issue.message.includes('operations.custom')
    )).toBe(true);
  });
});

describe('callMutation custom named ops — codegen + export round-trip', () => {
  it('generateDesignerTsx emits the custom method/URL and the inlined fetch hits the right endpoint', () => {
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
      dataSource: usersDataSource(),
    });

    const resetAction = createDynamicAction('callMutation');
    resetAction.dataSourceRef = 'users';
    resetAction.mutationOperation = 'resetPassword';
    resetAction.mutationRecordIdStorePath = 'selection.id';
    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Password reset';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [resetAction, toastAction]),
    });

    const preamble = renderBindingComponentPreamble(state.document, state.bindingDefinitions).join('\n');
    expect(preamble).toContain('method: "POST"');
    expect(preamble).toContain('/api/users/');
    expect(preamble).toContain('reset-password');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('reset-password');
    expect(tsx).toMatch(/method:\s*"POST"/);

    // Behavioral: the same URL builder used at export time substitutes the record id.
    expect(resolveMutationRuntimeUrl('/api/users/:id/reset-password', 7)).toBe(
      '/api/users/7/reset-password',
    );

    // Execute the URL expression the codegen emits (strip types via esbuild).
    const urlExprMatch = preamble.match(
      /const response = await \w+\(([^,]+), \{[\s\S]*?method: "POST"/,
    );
    expect(urlExprMatch?.[1]).toBeTruthy();
    const urlExpression = urlExprMatch![1]!.trim();
    const compiled = transformSync(`const url = ${urlExpression};`, { loader: 'ts' }).code;
    // eslint-disable-next-line no-new-func -- evaluating the exact export expression
    const url = new Function('designerStore', `${compiled}\nreturn url;`)({
      selection: { id: '99' },
    });
    expect(url).toBe('/api/users/99/reset-password');
  });

  it('operations.custom + custom mutationOperation survive JSON export → parse round-trip', () => {
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
      dataSource: usersDataSource(),
    });

    const action = createDynamicAction('callMutation');
    action.dataSourceRef = 'users';
    action.mutationOperation = 'setLocked';
    action.mutationRecordIdStorePath = 'selection.id';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [action]),
    });

    const json = generateDesignerJsonString(state.document, state.bindingDefinitions);
    const parsed = parseDesignerJson(json);

    expect(parsed.bindingDefinitions.dataSources.users?.operations?.custom?.setLocked).toEqual({
      method: 'PATCH',
      endpoint: '/api/users/:id/locked',
      label: 'Toggle Lock',
    });

    const clickBinding = parsed.document.nodes[buttonId]?.binding?.[eventBindingKeyForEvent('onClick')];
    expect(clickBinding?.trueActions?.[0]).toMatchObject({
      type: 'callMutation',
      mutationOperation: 'setLocked',
      dataSourceRef: 'users',
    });

    // Sanitizer path used by registry load must also keep custom ops.
    const sanitized = sanitizeDataSourceDefinition(usersDataSource(), 'users');
    expect(sanitized?.operations?.custom?.resetPassword?.endpoint).toBe(
      '/api/users/:id/reset-password',
    );
  });

  it('regression: create/update/delete callMutation behavior is unchanged', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: usersDataSource(),
    });

    const deleteAction = createDynamicAction('callMutation');
    deleteAction.dataSourceRef = 'users';
    deleteAction.mutationOperation = 'delete';
    deleteAction.mutationRecordIdStorePath = 'selection.id';

    const resolved = resolveDynamicActions(
      createDynamicActionsEventBindingDefinition('onClick', [deleteAction]),
      state.bindingDefinitions,
    );
    expect(resolved[0]).toMatchObject({
      type: 'callMutation',
      mutationOperation: 'delete',
      method: 'DELETE',
      endpoint: '/api/users/:id',
    });
  });
});
