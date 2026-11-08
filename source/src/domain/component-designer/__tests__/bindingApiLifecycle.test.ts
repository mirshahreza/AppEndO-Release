import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { createEventBindingDefinition, createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import { createInitialDesignerState, designerReducer } from '../state';

describe('binding API lifecycle codegen', () => {
  it('exposes refresh from useDataFetch and invalidates queries after mutation success', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: state.document.rootNodeId,
    });
    const inputId = state.document.nodes[state.document.rootNodeId].children[0];

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputId,
      bindingKey: propertyBindingKeyForProp('placeholder'),
      definition: createPropertyBindingDefinition('placeholder', 'user.email', {
        fetchEndpoint: '/api/v1/user/profile',
      }),
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputId,
      bindingKey: 'event:onChange',
      definition: createEventBindingDefinition('onChange', '/api/v1/user/update', 'PATCH', undefined, {
        invalidateQueries: ['/api/v1/user/profile'],
      }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain('refresh: refreshDataContext');
    expect(tsx).toContain('AUTH / TOKEN LIFECYCLE INJECTION POINT');
    expect(tsx).toContain('const designerFetch: typeof fetch = fetch;');
    expect(tsx).toContain('await refreshDataContext();');
    expect(tsx).toContain('await designerFetch(');
  });

  it('debounces onChange mutation handlers when debounceMs is configured', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: state.document.rootNodeId,
    });
    const inputId = state.document.nodes[state.document.rootNodeId].children[0];

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputId,
      bindingKey: 'event:onChange',
      definition: createEventBindingDefinition('onChange', '/api/v1/search', 'POST', undefined, {
        debounceMs: 500,
      }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('debounceTimer_');
    expect(tsx).toContain('setTimeout(async () => {');
    expect(tsx).toContain('}, 500);');
  });

  it('merges isSubmitting into submit button isDisabled inside mutation forms', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.form',
      parentId: state.document.rootNodeId,
    });
    const formId = state.document.nodes[state.document.rootNodeId].children[0];

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: formId,
    });
    const buttonId = state.document.nodes[formId].children[0];

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: buttonId,
      key: 'type',
      value: 'submit',
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: 'event:onSubmit',
      definition: createEventBindingDefinition('onSubmit', '/api/v1/user/update', 'PUT'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('isDisabled={isSubmitting}');
  });
});
