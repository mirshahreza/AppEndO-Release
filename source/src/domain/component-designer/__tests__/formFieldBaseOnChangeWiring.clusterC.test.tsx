/**
 * @vitest-environment jsdom
 * Cluster C (heroui-forms-inputs) audit — onChange/onBlur dispatch for the "phase 2" bespoke form
 * fields that share `resolveDesignerFormFieldBaseProps`.
 *
 * Bug found (systemic — affects 6 palette items at once): `resolveDesignerFormFieldBaseProps` in
 * designerFormFieldRuntime.ts always built its onChange/onBlur handlers from
 * `resolveCanvasMockEventProps(node)` — the inert, console.log-only design-time stub — regardless
 * of whether the canvas was in interactive runtime preview. Every widget built on top of this
 * shared helper is affected: form.code-editor, form.html-editor, form.mask-input, form.calculator,
 * heroui.color-control, and heroui.date-picker (via resolveDesignerDatePickerFieldProps). A user
 * configuring "when this changes, do X" for any of these six widgets would see it silently do
 * nothing on the live Designer canvas — the exact class of bug already fixed for heroui.select's
 * onChange wiring, heroui.entity-picker, and form.date-range, but hitting six items through one
 * shared function instead of one leaf renderer each.
 *
 * form.calculator is used here as the representative DOM-level proof because it renders a plain
 * text `<input>` with `allowManualInput` wired directly to `onChange` — the most reliable widget
 * in this family to drive with `fireEvent.change` in jsdom (Monaco/rich-text/IMask-backed siblings
 * are lazy-loaded or 3rd-party-managed and unsuitable for a fast, deterministic DOM test).
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import {
  createDynamicActionsEventBindingDefinition,
  eventBindingKeyForEvent,
} from '../bindingEngine';
import { createDynamicAction, visibilityStorePathForNode } from '../bindingDynamicActionsEngine';

describe('Cluster C — resolveDesignerFormFieldBaseProps onChange wiring (interactive canvas preview)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('fires a showHide Dynamic Action bound to onChange when the user types in form.calculator on the live canvas', async () => {
    let state = createInitialDesignerState();

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'form.calculator',
      parentId: state.document.rootNodeId,
    });
    const calculatorId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.modal',
      parentId: state.document.rootNodeId,
    });
    const modalId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, { type: 'set-node-prop', nodeId: modalId, key: 'title', value: 'Amount changed' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId: modalId, key: 'isOpen', value: false });

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = modalId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: calculatorId,
      bindingKey: eventBindingKeyForEvent('onChange'),
      definition: createDynamicActionsEventBindingDefinition('onChange', [showAction]),
    });

    const visibilityPath = visibilityStorePathForNode(modalId);

    const PreviewHarness: React.FC = () => {
      const [store, setStore] = React.useState<Record<string, unknown>>({});
      return renderDesignerDocumentPreview(state.document, {
        interactive: true,
        bindingDefinitions: state.bindingDefinitions,
        designerStore: store,
        onStoreChange: (updater) => {
          setStore((current) => (typeof updater === 'function' ? updater(current) : updater));
        },
      }) as React.ReactElement;
    };

    render(<PreviewHarness />);

    expect(screen.queryByText('Amount changed')).toBeNull();

    const input = screen.getByRole('textbox', { name: 'Amount' });
    fireEvent.change(input, { target: { value: '42' } });

    await vi.waitFor(() => {
      expect(screen.getByText('Amount changed')).toBeTruthy();
    });

    expect(visibilityPath).toBe(`ui.visibility.${modalId}`);
  });
});
