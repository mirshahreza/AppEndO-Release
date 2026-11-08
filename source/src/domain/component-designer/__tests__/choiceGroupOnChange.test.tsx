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

describe('T1-2 CheckboxGroup/RadioGroup onChange wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('emits adapted onChange in export TSX for CheckboxGroup and RadioGroup', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.checkbox-group',
      parentId: state.document.rootNodeId,
    });
    const checkboxId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: checkboxId,
      bindingKey: eventBindingKeyForEvent('onChange'),
      definition: createEventBindingDefinition('onChange', '/api/v1/checkbox', 'POST'),
    });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.radio-group',
      parentId: state.document.rootNodeId,
    });
    const radioId = state.document.nodes[state.document.rootNodeId].children[1]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: radioId,
      bindingKey: eventBindingKeyForEvent('onChange'),
      definition: createEventBindingDefinition('onChange', '/api/v1/radio', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<CheckboxGroup');
    expect(tsx).toContain('<RadioGroup');
    expect(tsx).toMatch(/onChange=\{\(nextValue\) => handleonChange_/);
    expect(tsx).toContain(
      'target: { value: String(Array.isArray(nextValue) ? nextValue.join(\',\') : nextValue ?? \'\') }',
    );
  });

  it('submits a form with live CheckboxGroup + RadioGroup values in the mutation payload', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.form',
      parentId: state.document.rootNodeId,
    });
    const formId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'choices',
      dataSource: {
        id: 'choices',
        name: 'Choices',
        endpoint: '/api/choices',
        fields: ['id', 'features', 'plan'],
        primaryKey: 'id',
        kind: 'record',
        operations: {
          create: { method: 'POST', endpoint: '/api/choices' },
          update: { method: 'PUT', endpoint: '/api/choices/:id' },
        },
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('choices'),
    });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.checkbox-group',
      parentId: formId,
    });
    const checkboxId = state.document.nodes[formId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: checkboxId,
      key: 'isSelected',
      value: 'option-1',
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: checkboxId,
      bindingKey: propertyBindingKeyForProp('isSelected'),
      definition: createRegionColumnBindingDefinition('isSelected', 'features'),
    });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.radio-group',
      parentId: formId,
    });
    const radioId = state.document.nodes[formId].children[1]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: radioId,
      key: 'isSelected',
      value: 'option-1',
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: radioId,
      bindingKey: propertyBindingKeyForProp('isSelected'),
      definition: createRegionColumnBindingDefinition('isSelected', 'plan'),
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
      value: 'Save choices',
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

    const checkboxInput = document.querySelector(`[name="${checkboxId}"]`) as HTMLInputElement | null;
    const radioInput = document.querySelector(`[name="${radioId}"]`) as HTMLInputElement | null;
    expect(checkboxInput).not.toBeNull();
    expect(radioInput).not.toBeNull();
    expect(checkboxInput!.value).toBe('option-1');
    expect(radioInput!.value).toBe('option-1');

    const featureOption2 = screen.getByText('Option 2', {
      selector: '[data-designer-component="heroui.checkbox-group"] *',
    });
    fireEvent.click(featureOption2);
    expect(checkboxInput!.value).toBe('option-1,option-2');

    const planOption3 = screen.getByText('Option 3', {
      selector: '[data-designer-component="heroui.radio-group"] *',
    });
    fireEvent.click(planOption3);
    expect(radioInput!.value).toBe('option-3');

    fireEvent.click(screen.getByText('Save choices'));

    await vi.waitFor(() => {
      const hasPost = fetchMock.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(hasPost).toBe(true);
    });

    const mutationCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    ) as [string, RequestInit];
    expect(mutationCall[0]).toContain('/api/choices');
    expect(JSON.parse(String(mutationCall[1].body))).toMatchObject({
      features: 'option-1,option-2',
      plan: 'option-3',
    });
  });
});
