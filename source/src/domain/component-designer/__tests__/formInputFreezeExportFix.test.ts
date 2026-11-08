import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { createEventBindingDefinition, eventBindingKeyForEvent } from '../bindingEngine';
import type { DesignerState } from '../types';

/**
 * Bug found (not covered by the earlier preview-side "controlled-without-onChange freeze" fix):
 * `heroui.input-text`/`number-input`/`textarea`/`switch`/`checkbox-group`/`radio-group` still
 * emitted a static default as a real, controlled `value`/`isSelected` attribute in EXPORTED
 * code whenever no `onChange` handler was wired — with nothing to update it, React resets the
 * DOM back to that unchanging prop every render, so the field/control can never be
 * typed/toggled/clicked in the published app. Preview already falls back to `defaultValue`/
 * `defaultSelected` in this case; export must do the same.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const withOnChange = (state: DesignerState, nodeId: string): DesignerState =>
  designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: eventBindingKeyForEvent('onChange'),
    definition: createEventBindingDefinition('onChange', '/api/v1/save', 'POST'),
  });

describe('form input freeze fix (export)', () => {
  it('heroui.input-text: uses defaultValue (typable) without onChange, value (controlled) with onChange', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.input-text');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'value', value: 'hello default' });

    let tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('input-text no onChange', tsx);
    expect(tsx).toContain('defaultValue="hello default"');
    expect(tsx).not.toMatch(/ value="hello default"/);

    state = withOnChange(state, nodeId);
    tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('input-text with onChange', tsx);
    expect(tsx).toContain('value="hello default"');
    expect(tsx).not.toContain('defaultValue="hello default"');
  });

  it('heroui.number-input: uses defaultValue without onChange', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.number-input');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'value', value: '42' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('number-input no onChange', tsx);
    expect(tsx).toContain('defaultValue={42}');
    expect(tsx).not.toMatch(/ value=\{42\}/);
  });

  it('heroui.textarea: uses defaultValue without onChange', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.textarea');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'value', value: 'default text' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('textarea no onChange', tsx);
    expect(tsx).toContain('defaultValue="default text"');
    expect(tsx).not.toMatch(/ value="default text"/);
  });

  it('heroui.switch: uses defaultSelected without onChange, isSelected with onChange', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.switch');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isSelected', value: true });

    let tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('switch no onChange', tsx);
    expect(tsx).toContain('defaultSelected');
    expect(tsx).not.toContain('isSelected');

    state = withOnChange(state, nodeId);
    tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('switch with onChange', tsx);
    expect(tsx).toContain('isSelected');
    expect(tsx).not.toContain('defaultSelected');
  });

  it('heroui.checkbox-group: uses defaultValue without onChange, value with onChange', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.checkbox-group');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isSelected', value: 'option-1,option-2' });

    let tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('checkbox-group no onChange', tsx);
    expect(tsx).toMatch(/defaultValue=\{\[.*"option-1".*"option-2".*\]\}/);
    expect(tsx).not.toMatch(/ value=\{\[/);

    state = withOnChange(state, nodeId);
    tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('checkbox-group with onChange', tsx);
    expect(tsx).toMatch(/ value=\{\[.*"option-1".*"option-2".*\]\}/);
  });

  it('heroui.radio-group: uses defaultValue without onChange, value with onChange', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.radio-group');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isSelected', value: 'option-2' });

    let tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('radio-group no onChange', tsx);
    expect(tsx).toMatch(/<RadioGroup[^>]*\bdefaultValue="option-2"/);
    expect(tsx).not.toMatch(/<RadioGroup[^>]*\bvalue="option-2"/);

    state = withOnChange(state, nodeId);
    tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('radio-group with onChange', tsx);
    expect(tsx).toMatch(/<RadioGroup[^>]*\bvalue="option-2"/);
  });
});
