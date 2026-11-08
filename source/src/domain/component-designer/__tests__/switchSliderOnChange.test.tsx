/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { DesignerDocumentPreview } from '../designerRuntimePreview';
import { generateDesignerTsx } from '../codegen';
import {
  createEventBindingDefinition,
  eventBindingKeyForEvent,
  propertyBindingKeyForProp,
} from '../bindingEngine';
import {
  REGION_DATA_SOURCE_BINDING_KEY,
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  createRegionSubmitEventBindingDefinition,
} from '../bindingRegionEngine';

describe('T1-1 Switch/Slider onChange wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('emits adapted onChange in export TSX for Switch and Slider', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.switch',
      parentId: state.document.rootNodeId,
    });
    const switchId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: switchId,
      bindingKey: eventBindingKeyForEvent('onChange'),
      definition: createEventBindingDefinition('onChange', '/api/v1/toggle', 'POST'),
    });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.slider',
      parentId: state.document.rootNodeId,
    });
    const sliderId = state.document.nodes[state.document.rootNodeId].children[1]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: sliderId,
      bindingKey: eventBindingKeyForEvent('onChange'),
      definition: createEventBindingDefinition('onChange', '/api/v1/slider', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Switch');
    expect(tsx).toContain('<Slider');
    expect(tsx).toMatch(/onChange=\{\(nextValue\) => handleonChange_/);
    expect(tsx).toContain('target: { value: String(Array.isArray(nextValue) ? nextValue[0] : nextValue) }');
    expect(tsx).toContain('defaultValue={');
  });

  it('submits a form with live Switch + Slider values in the mutation payload', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.form',
      parentId: state.document.rootNodeId,
    });
    const formId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'prefs',
      dataSource: {
        id: 'prefs',
        name: 'Prefs',
        endpoint: '/api/prefs',
        fields: ['id', 'notifications', 'volume'],
        primaryKey: 'id',
        kind: 'record',
        operations: {
          create: { method: 'POST', endpoint: '/api/prefs' },
          update: { method: 'PUT', endpoint: '/api/prefs/:id' },
        },
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('prefs'),
    });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.switch',
      parentId: formId,
    });
    const switchId = state.document.nodes[formId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: switchId,
      key: 'isSelected',
      value: false,
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: switchId,
      bindingKey: propertyBindingKeyForProp('isSelected'),
      definition: createRegionColumnBindingDefinition('isSelected', 'notifications'),
    });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.slider',
      parentId: formId,
    });
    const sliderId = state.document.nodes[formId].children[1]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: sliderId,
      key: 'value',
      value: 40,
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: sliderId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createRegionColumnBindingDefinition('value', 'volume'),
    });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: formId,
    });
    const buttonId = state.document.nodes[formId].children[2]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: buttonId,
      key: 'text',
      value: 'Save prefs',
    });
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
      <DesignerDocumentPreview
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        interactive
      />,
    );

    const switchInput = document.querySelector(`[name="${switchId}"]`) as HTMLInputElement | null;
    const sliderInput = document.querySelector(`[name="${sliderId}"]`) as HTMLInputElement | null;
    expect(switchInput).not.toBeNull();
    expect(sliderInput).not.toBeNull();
    expect(switchInput!.value).toBe('false');
    expect(sliderInput!.value).toBe('40');

    const switchControl = document.querySelector('[aria-label="switch"]') as HTMLElement | null;
    expect(switchControl).not.toBeNull();
    fireEvent.click(switchControl!);
    expect(switchInput!.value).toBe('true');

    const sliderRange = document.querySelector('input[type="range"]') as HTMLInputElement | null;
    expect(sliderRange).not.toBeNull();
    fireEvent.change(sliderRange!, { target: { value: '72' } });
    expect(sliderInput!.value).toBe('72');

    fireEvent.click(screen.getByText('Save prefs'));

    await vi.waitFor(() => {
      const hasPost = fetchMock.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(hasPost).toBe(true);
    });

    const mutationCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    ) as [string, RequestInit];
    expect(mutationCall[0]).toContain('/api/prefs');
    expect(JSON.parse(String(mutationCall[1].body))).toMatchObject({
      notifications: true,
      volume: '72',
    });
  });
});
