/**
 * @vitest-environment jsdom
 * Cluster C (heroui-forms-inputs) audit — form.time-input / form.datetime-input.
 *
 * Bug found (two-fold, most severe in this category alongside the missing form.date-range
 * calendar and form.otp-input's fake inputs): `DesignerUniversalTimeInput` /
 * `DesignerUniversalDateTimeInput` rendered `<input type="time"|"datetime-local" readOnly>` — a
 * user could never type into either widget at all, in canvas preview OR exported/published code
 * (same static, read-only markup is used by both). Additionally, `resolveNodeEventBindingTargets`
 * never declared onChange for either palette item, so even if the input had been editable, the
 * Inspector's "Behavior" section would never have offered a way to bind an onChange action (same
 * class of gap already fixed for Switch/Slider/CheckboxGroup/RadioGroup in this cluster).
 *
 * Fixed: `readOnly` removed, a real onChange handler wired through the same mode-aware
 * mock-vs-real dispatch pattern used across this codebase, and onChange declared as a bindable
 * event target for both items.
 *
 * NOT fixed (flagged in the findings doc as needing follow-up, not a narrow patch): the
 * exported/published-code path (tsxUniversalPalette.ts) has no event-binding pattern at all for
 * any item in the universal-palette family, so onChange actions configured for these two widgets
 * still only work in the live Designer canvas, not in the exported app — mirroring the
 * intentionally-unfixed tags-input codegen gap.
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

const insertItem = (state: ReturnType<typeof createInitialDesignerState>, itemId: string) =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });

describe('Cluster C — form.time-input / form.datetime-input onChange wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it.each(['form.time-input', 'form.datetime-input'])(
    'declares onChange as a bindable event target for %s',
    (itemId) => {
      let state = createInitialDesignerState();
      state = insertItem(state, itemId);
      const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
      expect(resolveNodeEventBindingTargets(state.document.nodes[nodeId]!)).toContain('onChange');
    },
  );

  it.each([
    ['form.time-input', 'time', '14:45'],
    ['form.datetime-input', 'datetime-local', '2026-08-01T09:15'],
  ] as const)('is not read-only and dispatches a showHide Dynamic Action when the user edits %s', async (itemId, inputType, nextValue) => {
    let state = createInitialDesignerState();
    state = insertItem(state, itemId);
    const fieldId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    state = insertItem(state, 'heroui.modal');
    const modalId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, { type: 'set-node-prop', nodeId: modalId, key: 'title', value: 'Time changed' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId: modalId, key: 'isOpen', value: false });

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = modalId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: fieldId,
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

    const input = document.querySelector(`input[type="${inputType}"]`) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.readOnly).toBe(false);

    expect(screen.queryByText('Time changed')).toBeNull();
    fireEvent.change(input, { target: { value: nextValue } });

    await vi.waitFor(() => {
      expect(screen.getByText('Time changed')).toBeTruthy();
    });

    expect(visibilityPath).toBe(`ui.visibility.${modalId}`);
  });
});
