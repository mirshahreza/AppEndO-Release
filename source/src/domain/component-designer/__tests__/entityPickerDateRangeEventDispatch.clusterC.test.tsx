/**
 * @vitest-environment jsdom
 * Cluster C (heroui-forms-inputs) audit — real event dispatch for heroui.entity-picker /
 * form.date-range in the interactive canvas preview.
 *
 * Bug found: `renderEntityPickerLeafNode` and `renderDateRangeLeafNode` in
 * runtimePhase2Palette.tsx always called `resolveCanvasMockEventProps(node)` for their
 * onChange/onBlur handlers, regardless of `options.mode`/`options.previewEvents`. Every other
 * form-input renderer in this codebase (DesignerRuntimeSelect, DesignerRuntimeAutocomplete,
 * the Switch/Slider/CheckboxGroup/RadioGroup leaves in runtimeRenderer.tsx and
 * DesignerRuntimeParityPalette.tsx) switches between the real dispatcher
 * (`resolveCanvasPreviewEventProps`, which runs mutations/store writes/dynamic actions) and the
 * inert design-time mock (`resolveCanvasMockEventProps`, which only `console.log`s) based on
 * whether the canvas is in interactive runtime preview. Entity Picker and Date Range always used
 * the inert mock, so a user configuring "when this changes, do X" for either widget would see the
 * action silently do nothing on the live canvas — the same class of bug already fixed for
 * heroui.select's onChange wiring (see selectOnChangeWiring.test.tsx).
 *
 * Only heroui.entity-picker gets a full DOM-level interaction regression test here: selecting an
 * option really does trigger react-aria's onSelectionChange via the ComboBox's hidden native
 * <select>, which is a legitimate way a browser/user (and jsdom) can drive the control.
 * form.date-range's popover renders no interactive calendar cells at all (verified separately —
 * see the audit log) so there is no real user gesture to reproduce a same-fidelity DOM test with;
 * the source fix was still applied for consistency and is exercised by the existing
 * "exports TSX" / "renders without throwing" coverage, but is flagged in the findings doc as
 * needing follow-up (implementing a real range calendar) rather than claimed as DOM-proven here.
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

describe('Cluster C — heroui.entity-picker onChange wiring (interactive canvas preview)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('fires a showHide Dynamic Action bound to onChange when the user picks an entity on the live canvas', async () => {
    let state = createInitialDesignerState();

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.entity-picker',
      parentId: state.document.rootNodeId,
    });
    const pickerId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.modal',
      parentId: state.document.rootNodeId,
    });
    const modalId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, { type: 'set-node-prop', nodeId: modalId, key: 'title', value: 'Entity chosen' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId: modalId, key: 'isOpen', value: false });

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = modalId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: pickerId,
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

    expect(screen.queryByText('Entity chosen')).toBeNull();

    // HeroUI's Autocomplete/ComboBox renders a visually-hidden native <select> that mirrors
    // selection for accessibility/autofill; changing it drives the same onSelectionChange path a
    // real pointer/keyboard selection would.
    const hiddenSelect = document.querySelector('select') as HTMLSelectElement;
    expect(hiddenSelect).not.toBeNull();
    fireEvent.change(hiddenSelect, { target: { value: 'entity-1' } });

    await vi.waitFor(() => {
      expect(screen.getByText('Entity chosen')).toBeTruthy();
    });

    expect(visibilityPath).toBe(`ui.visibility.${modalId}`);
  });
});
