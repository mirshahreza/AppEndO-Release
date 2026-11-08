/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { DesignerDocumentPreview } from '../designerRuntimePreview';
import {
  REGION_DATA_SOURCE_BINDING_KEY,
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  createRegionSubmitEventBindingDefinition,
} from '../bindingRegionEngine';
import { eventBindingKeyForEvent, propertyBindingKeyForProp } from '../bindingEngine';

describe('DesignerRuntime region submit preview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('fires a real API mutation when a link-type Save button with regionSubmit is clicked', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, { type: 'insert-palette-item', itemId: 'html.form', parentId: state.document.rootNodeId });
    const formId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'test'],
        primaryKey: 'id',
        kind: 'record',
        operations: {
          create: { method: 'POST', endpoint: '/api/users' },
          update: { method: 'PUT', endpoint: '/api/users/:id' },
        },
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users'),
    });

    state = designerReducer(state, { type: 'insert-palette-item', itemId: 'heroui.input-text', parentId: formId });
    const inputId = state.document.nodes[formId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createRegionColumnBindingDefinition('value', 'test'),
    });

    state = designerReducer(state, { type: 'insert-palette-item', itemId: 'heroui.button-solid', parentId: formId });
    const buttonId = state.document.nodes[formId].children[1]!;
    state = designerReducer(state, { type: 'set-node-prop', nodeId: buttonId, key: 'text', value: 'save' });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createRegionSubmitEventBindingDefinition('onClick'),
    });

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DesignerDocumentPreview document={state.document} bindingDefinitions={state.bindingDefinitions} interactive />,
    );

    const input = document.querySelector(`[name="${inputId}"]`) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.readOnly).not.toBe(true);
    fireEvent.change(input!, { target: { value: 'hello world' } });
    expect(input?.value).toBe('hello world');

    const saveButton = screen.getByText('save');
    fireEvent.click(saveButton);

    await vi.waitFor(() => {
      const hasMutationCall = fetchMock.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(hasMutationCall).toBe(true);
    });

    const mutationCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    ) as [string, RequestInit];
    expect(mutationCall[0]).toContain('/api/users');
    expect(mutationCall[1].method).toBe('POST');
    expect(JSON.parse(String(mutationCall[1].body))).toMatchObject({ test: 'hello world' });
  });

  it('blocks submit when required preview fields are invalid', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, { type: 'insert-palette-item', itemId: 'html.form', parentId: state.document.rootNodeId });
    const formId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'test'],
        primaryKey: 'id',
        kind: 'record',
        operations: {
          create: { method: 'POST', endpoint: '/api/users' },
          update: { method: 'PUT', endpoint: '/api/users/:id' },
        },
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users'),
    });

    state = designerReducer(state, { type: 'insert-palette-item', itemId: 'heroui.input-text', parentId: formId });
    const inputId = state.document.nodes[formId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createRegionColumnBindingDefinition('value', 'test'),
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: inputId,
      key: 'isRequired',
      value: true,
    });

    state = designerReducer(state, { type: 'insert-palette-item', itemId: 'heroui.button-solid', parentId: formId });
    const buttonId = state.document.nodes[formId].children[1]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createRegionSubmitEventBindingDefinition('onClick'),
    });

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DesignerDocumentPreview document={state.document} bindingDefinitions={state.bindingDefinitions} interactive />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Action' }));
    await vi.waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
    expect(screen.getByText('This field is required.')).toBeTruthy();
  });
});
