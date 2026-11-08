/**
 * @vitest-environment jsdom
 * Cluster D — heroui.listbox export/codegen regression.
 *
 * Bug: `<ListBox>` (real @heroui/react component, react-aria based) defaults
 * `selectionMode` to 'none'. The Designer never set `selectionMode` on the exported
 * `<ListBox>`, so in a *published* app clicking an option never fired
 * `onSelectionChange` at all — the "Selection Change" event binding configured in the
 * Inspector was a complete no-op in exported code, even though it worked in the live
 * canvas preview (which uses a hand-rolled `DesignerRuntimeListbox`, not the real
 * `<ListBox>`). Separately, the "Selected Keys" Inspector field stored a comma-separated
 * string, which was passed straight through as `selectedKeys="..."` — react-aria's
 * `selectedKeys`/`defaultSelectedKeys` prop type is `'all' | Iterable<Key>`, and a raw JS
 * string is iterable *over its characters*, so this never selected the intended option
 * either. Fixed in `tsxNodeRenderer.ts` (`case 'heroui.listbox'`): always emit
 * `selectionMode="single"` and convert the CSV into a real array literal via
 * `defaultSelectedKeys`.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ListBox } from '@heroui/react';
import { generateDesignerTsx } from '../codegen';
import {
  createEventBindingDefinition,
  eventBindingKeyForEvent,
} from '../bindingEngine';
import { createInitialDesignerState, designerReducer } from '../state';

const insertListbox = () => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'heroui.listbox',
    parentId: state.document.rootNodeId,
  });
  const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId,
    key: 'items',
    value: JSON.stringify([
      { id: 'alpha', textValue: 'Alpha option' },
      { id: 'beta', textValue: 'Beta option' },
    ]),
  });
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId,
    key: 'selectedKeys',
    value: 'beta',
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: eventBindingKeyForEvent('onSelectionChange'),
    definition: createEventBindingDefinition('onSelectionChange', '/api/v1/listbox', 'POST'),
  });
  return { state, nodeId };
};

describe('Cluster D — heroui.listbox export selectionMode + selectedKeys', () => {
  afterEach(() => cleanup());

  it('exported TSX sets selectionMode="single" and defaultSelectedKeys as a real array, never a bare selectedKeys string', () => {
    const { state } = insertListbox();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain('<ListBox');
    expect(tsx).toContain('selectionMode="single"');
    expect(tsx).toContain('defaultSelectedKeys={["beta"]}');
    // Must not regress to passing the raw CSV string straight through as `selectedKeys="beta"`.
    expect(tsx).not.toMatch(/\sselectedKeys="beta"/);
  });

  it('DOM proof: the exact props codegen now emits make a real @heroui/react ListBox actually select the option and fire onSelectionChange on click', () => {
    const onSelectionChange = vi.fn();
    // These are literally the props `generateDesignerTsx` now emits for the scenario above:
    // selectionMode="single" and defaultSelectedKeys={["beta"]}.
    const { container } = render(
      <ListBox
        aria-label="Options"
        selectionMode="single"
        defaultSelectedKeys={['beta']}
        onSelectionChange={onSelectionChange}
      >
        <ListBox.Item id="alpha" textValue="Alpha option">Alpha option</ListBox.Item>
        <ListBox.Item id="beta" textValue="Beta option">Beta option</ListBox.Item>
      </ListBox>,
    );

    const options = Array.from(container.querySelectorAll('[role="option"]'));
    const betaOption = options.find((el) => el.textContent === 'Beta option');
    expect(betaOption).toBeTruthy();
    // The pre-configured "Selected Keys" value is honored on initial render.
    expect(betaOption).toHaveAttribute('aria-selected', 'true');

    const alphaOption = options.find((el) => el.textContent === 'Alpha option');
    fireEvent.click(alphaOption!);

    // Clicking a different option actually fires onSelectionChange in the exported app
    // (this is exactly what was broken pre-fix: selectionMode defaulted to 'none' and no
    // click ever reached onSelectionChange at all).
    expect(onSelectionChange).toHaveBeenCalled();
  });

  it('regression guard: without selectionMode, the same click never reaches onSelectionChange (documents the pre-fix failure mode)', () => {
    const onSelectionChange = vi.fn();
    const { container } = render(
      <ListBox aria-label="Options" onSelectionChange={onSelectionChange}>
        <ListBox.Item id="alpha" textValue="Alpha option">Alpha option</ListBox.Item>
        <ListBox.Item id="beta" textValue="Beta option">Beta option</ListBox.Item>
      </ListBox>,
    );
    const options = Array.from(container.querySelectorAll('[role="option"]'));
    fireEvent.click(options[0]!);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});
