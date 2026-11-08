/**
 * @vitest-environment jsdom
 * Bug found (parity audit item 1): live per-keystroke/on-blur validation feedback
 * (`options.onPreviewFieldValidation`) only ever fired for heroui.input-text/number-input/
 * textarea — every other form element exposing the same validation Inspector fields never
 * called it at all, so the interactive canvas never showed a red/invalid state for them. Fixed
 * via a shared `triggerPreviewFieldValidation` helper wired into each element's own
 * value-committed event (select/autocomplete/entity-picker: on selection; tags-input: on
 * add/remove; date-picker/code-editor/html-editor/mask-input/calculator/color-control: via the
 * one shared `resolveDesignerFormFieldBaseProps` base, on blur).
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: state.document.rootNodeId });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId];
  return parent.children[parent.children.length - 1] as string;
};

const renderInteractive = (state: DesignerState, onPreviewFieldValidation: (nodeId: string, message: string | null) => void) =>
  render(<>{renderDesignerDocumentPreview(state.document, { interactive: true, onPreviewFieldValidation })}</>);

describe('live preview field validation wiring (parity audit item 1)', () => {
  afterEach(() => cleanup());

  it('heroui.select: reports a validation message immediately when a Required select stays unselected then a valid option is chosen', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.select');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isRequired', value: true });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'items',
      value: JSON.stringify([{ id: 'a', textValue: 'Option A' }]),
    });

    const calls: Array<[string, string | null]> = [];
    const { container } = renderInteractive(state, (id, message) => calls.push([id, message]));

    fireEvent.click(container.querySelector('button[aria-haspopup="listbox"]')!);
    const option = Array.from(container.querySelectorAll('button[role="option"]')).find((el) => el.textContent === 'Option A');
    expect(option).toBeTruthy();
    fireEvent.click(option!);

    expect(calls.some(([id, message]) => id === nodeId && message === null)).toBe(true);
  });

  it('heroui.tags-input: reports a validation message when Required and the last tag is removed', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tags-input');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isRequired', value: true });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'value', value: 'alpha' });

    const calls: Array<[string, string | null]> = [];
    const { container } = renderInteractive(state, (id, message) => calls.push([id, message]));

    const removeButton = container.querySelector('[data-designer-component="heroui.tags-input"] button');
    expect(removeButton).toBeTruthy();
    fireEvent.click(removeButton!);

    expect(calls.some(([id, message]) => id === nodeId && message === 'This field is required.')).toBe(true);
  });

  it('heroui.color-control (shared form-field base): reports a validation message on blur when Required and empty', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.color-control');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isRequired', value: true });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'value', value: '' });

    const calls: Array<[string, string | null]> = [];
    const { container } = renderInteractive(state, (id, message) => calls.push([id, message]));

    const input = container.querySelector('input');
    expect(input).toBeTruthy();
    fireEvent.blur(input!);

    expect(calls.some(([id, message]) => id === nodeId && message === 'This field is required.')).toBe(true);
  });
});
