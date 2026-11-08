import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { validateDesignerFieldNode } from '../previewFieldValidation';

describe('previewFieldValidation', () => {
  it('flags required fields with the default message', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'isRequired',
      value: true,
    });

    expect(validateDesignerFieldNode(state.document.nodes[nodeId].props, '')).toBe('This field is required.');
  });

  it('validates pattern, min length, and max length', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'pattern', value: '^[A-Z]+$' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'minLength', value: 3 });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'maxLength', value: 5 });

    const node = state.document.nodes[nodeId];
    expect(validateDesignerFieldNode(node.props, 'ab')).toBe('Minimum length is 3.');
    expect(validateDesignerFieldNode(node.props, 'abcdef')).toBe('Maximum length is 5.');
    expect(validateDesignerFieldNode(node.props, 'abc1')).toBe('Value does not match the required pattern.');
    expect(validateDesignerFieldNode(node.props, 'ABC')).toBeNull();
  });

  it('validates cross-field validation rules', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'validationRule',
      value: 'value == data.password',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'validationErrorMessage',
      value: 'Passwords must match!',
    });

    const node = state.document.nodes[nodeId];
    expect(validateDesignerFieldNode(node.props, 'mismatch', {}, { password: 'secret' })).toBe('Passwords must match!');
    expect(validateDesignerFieldNode(node.props, 'secret', {}, { password: 'secret' })).toBeNull();
  });
});
