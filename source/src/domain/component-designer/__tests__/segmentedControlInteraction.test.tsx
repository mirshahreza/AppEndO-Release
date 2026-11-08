/**
 * @vitest-environment jsdom
 * Bug found: content.segmented-control rendered every option as a plain, non-interactive
 * `<span>` — clicking a segment could never change the selection anywhere (canvas, interactive
 * preview, or the exported/published app); `selected` could only ever be set via the (also
 * previously broken, see universalContentPropertyBindingExport.test.ts) static/bound prop.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DesignerUniversalSegmentedControl } from '../DesignerRuntimeUniversalWidgets';
import {
  createEventBindingDefinition,
  eventBindingKeyForEvent,
  resolveNodeEventBindingTargets,
} from '../bindingEngine';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

afterEach(() => cleanup());

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('content.segmented-control interactivity', () => {
  it('registers onSelectionChange as an event-binding target', () => {
    const state = insert(createInitialDesignerState(), 'content.segmented-control');
    const nodeId = lastChild(state);
    expect(resolveNodeEventBindingTargets(state.document.nodes[nodeId]!)).toEqual(['onSelectionChange']);
  });

  it('clicking a segment updates the highlighted option and fires onSelectionChange', () => {
    const onSelectionChange = vi.fn();
    render(
      <DesignerUniversalSegmentedControl options="Day,Week,Month" selected="Week" onSelectionChange={onSelectionChange} />,
    );

    const dayTab = screen.getByRole('tab', { name: 'Day' });
    const weekTab = screen.getByRole('tab', { name: 'Week' });
    expect(weekTab).toHaveAttribute('aria-selected', 'true');
    expect(dayTab).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(dayTab);

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect((onSelectionChange.mock.calls[0][0] as { target: { value: string } }).target.value).toBe('Day');
    expect(dayTab).toHaveAttribute('aria-selected', 'true');
    expect(weekTab).toHaveAttribute('aria-selected', 'false');
  });

  it('exports TSX with a real onSelectionChange handler bound to the component', () => {
    let state = insert(createInitialDesignerState(), 'content.segmented-control');
    const nodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: eventBindingKeyForEvent('onSelectionChange'),
      definition: createEventBindingDefinition('onSelectionChange', '/api/v1/segment-selected', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<DesignerUniversalSegmentedControl');
    expect(tsx).toMatch(/onSelectionChange=\{handle/);
  });
});
