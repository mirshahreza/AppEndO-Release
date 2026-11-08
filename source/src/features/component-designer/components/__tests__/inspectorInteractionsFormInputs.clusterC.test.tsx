/**
 * @vitest-environment jsdom
 * Cluster C (heroui-forms-inputs) audit — Inspector "Behavior" (events) section coverage.
 *
 * Bug found: heroui.switch, heroui.slider, heroui.checkbox-group, and heroui.radio-group all
 * dispatch a real onChange to the designer event system in the live runtime (verified in
 * runtimeRenderer.tsx / DesignerRuntimeParityPalette.tsx via adaptValueChangeToDesignerEvent /
 * adaptChoiceGroupValueToDesignerEvent), but `resolveNodeEventBindingTargets` in bindingEngine.ts
 * never listed these four palette items, so `InspectorInteractionsSection` — which returns null
 * when `resolveNodeEventBindingTargets(node)` is empty — never rendered the "Behavior" accordion
 * for them. A real user could never configure an onChange action for a Switch/Slider/CheckboxGroup/
 * RadioGroup through the Designer UI, even though the underlying wiring worked once a binding
 * existed (e.g. set directly via the reducer in switchSliderOnChange.test.tsx).
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { InspectorInteractionsSection } from '../InspectorInteractionsSection';
import { resolveNodeEventBindingTargets } from '../../../../domain/component-designer/bindingEngine';
import { createInitialDesignerState, designerReducer } from '../../../../domain/component-designer/state';

const insertItem = (itemId: string) => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });
  const rootNode = state.document.nodes[state.document.rootNodeId];
  const nodeId = rootNode.children[rootNode.children.length - 1] as string;
  return { state, nodeId };
};

const noopDispatch = () => undefined;

describe('Cluster C — Inspector Behavior section exposes onChange for choice/toggle form inputs', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(['heroui.switch', 'heroui.slider', 'heroui.checkbox-group', 'heroui.radio-group'])(
    'lists onChange as an event binding target for %s',
    (itemId) => {
      const { state, nodeId } = insertItem(itemId);
      const node = state.document.nodes[nodeId]!;
      expect(resolveNodeEventBindingTargets(node)).toContain('onChange');
    },
  );

  it.each(['heroui.switch', 'heroui.slider', 'heroui.checkbox-group', 'heroui.radio-group'])(
    'renders a Behavior section with a Value Change row for %s in the Inspector',
    (itemId) => {
      const { state, nodeId } = insertItem(itemId);
      const node = state.document.nodes[nodeId]!;

      render(
        <InspectorInteractionsSection
          node={node}
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          dispatch={noopDispatch}
        />,
      );

      const behaviorRegion = document.querySelector('[data-inspector-tier="behavior"]');
      expect(behaviorRegion).not.toBeNull();
      expect(within(behaviorRegion as HTMLElement).getByText('Behavior')).toBeTruthy();

      // Expand via AppSurfaceBox header (Phase 2 replaced UiAccordion).
      fireEvent.click(within(behaviorRegion as HTMLElement).getByRole('button', { name: /Behavior/i }));
      expect(within(behaviorRegion as HTMLElement).getByText('Value Change')).toBeTruthy();
    },
  );

  it('does not render a Behavior section for heroui.field-container (no event targets)', () => {
    const { state, nodeId } = insertItem('heroui.field-container');
    const node = state.document.nodes[nodeId]!;

    const { container } = render(
      <InspectorInteractionsSection
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={noopDispatch}
      />,
    );

    expect(container.querySelector('[data-inspector-tier="behavior"]')).toBeNull();
  });
});
