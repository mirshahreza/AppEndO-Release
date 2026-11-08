/**
 * @vitest-environment jsdom
 *
 * heroui.select was listed as eventComplete:false: resolveNodeEventBindingTargets()
 * declares onChange as a bindable target (it's in DESIGNER_FORM_INPUT_PALETTE_ITEM_IDS),
 * codegen already wired it correctly onto the real <UiSelect> element, but
 * DesignerRuntimeSelect.tsx never dispatched to the designer event system on option
 * click — any onChange Dynamic Action a user configured would silently never fire in
 * the live canvas preview, even though it would work in the exported/published code.
 * This reproduces the bug against the pre-fix behavior pattern and proves the fix.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import {
  createDynamicActionsEventBindingDefinition,
  eventBindingKeyForEvent,
  resolveNodeEventBindingTargets,
} from '../bindingEngine';
import { createDynamicAction, visibilityStorePathForNode } from '../bindingDynamicActionsEngine';

describe('heroui.select onChange wiring (eventComplete fix)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('declares onChange as a bindable event target', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.select',
      parentId: state.document.rootNodeId,
    });
    const selectId = state.document.nodes[state.document.rootNodeId].children[0]!;
    expect(resolveNodeEventBindingTargets(state.document.nodes[selectId]!)).toEqual(
      expect.arrayContaining(['onChange']),
    );
  });

  it('fires a showHide Dynamic Action bound to onChange when the user picks an option on the live canvas', async () => {
    let state = createInitialDesignerState();

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.select',
      parentId: state.document.rootNodeId,
    });
    // Uses the palette item's default static `items` (Option 1/2/3) — no binding needed.
    const selectId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.modal',
      parentId: state.document.rootNodeId,
    });
    const modalId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: modalId,
      key: 'title',
      value: 'Plan changed',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: modalId,
      key: 'isOpen',
      value: false,
    });

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = modalId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: selectId,
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
      });
    };

    render(<PreviewHarness />);

    expect(screen.queryByText('Plan changed')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Select…' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Option 1' }));

    await vi.waitFor(() => {
      expect(screen.getByText('Plan changed')).toBeTruthy();
    });

    expect(visibilityPath).toBe(`ui.visibility.${modalId}`);
  });
});
