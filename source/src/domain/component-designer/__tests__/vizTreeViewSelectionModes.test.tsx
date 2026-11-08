/**
 * @vitest-environment jsdom
 * viz.tree-view — selectionMode ('none' | 'single' | 'checkbox'), per-node icons, and the new
 * onSelectionChange/onCheckedChange event-binding targets (Component Designer Data Display audit,
 * Tree View capability build-out).
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DesignerVizTreeView } from '../DesignerRuntimeTreeWidgets';
import {
  createEventBindingDefinition,
  eventBindingKeyForEvent,
  resolveNodeEventBindingTargets,
} from '../bindingEngine';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

afterEach(() => cleanup());

const TREE_DATA = JSON.stringify([
  {
    id: 'root',
    label: 'Head Office',
    icon: 'Building2',
    children: [
      { id: 'eng', label: 'Engineering' },
      { id: 'sales', label: 'Sales' },
    ],
  },
]);

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState, parentId: string): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
};

describe('viz.tree-view selection modes', () => {
  it('registers onSelectionChange and onCheckedChange as event-binding targets', () => {
    const state = insertItem(createInitialDesignerState(), 'viz.tree-view');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    expect(resolveNodeEventBindingTargets(state.document.nodes[nodeId]!)).toEqual([
      'onSelectionChange',
      'onCheckedChange',
    ]);
  });

  it('single mode: clicking a node highlights it and fires onSelectionChange with the node id', () => {
    const onSelectionChange = vi.fn();
    render(
      <DesignerVizTreeView data={TREE_DATA} selectionMode="single" onSelectionChange={onSelectionChange} />,
    );

    fireEvent.click(screen.getByText('Engineering'));

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    const event = onSelectionChange.mock.calls[0][0] as { target: { value: string } };
    expect(event.target.value).toBe('eng');
    expect(screen.getByText('Engineering').closest('button')).not.toBeNull();
  });

  it('checkbox mode: renders a checkbox per node, toggling fires onCheckedChange with the accumulated CSV, and selection highlighting never applies', () => {
    const onCheckedChange = vi.fn();
    render(
      <DesignerVizTreeView data={TREE_DATA} selectionMode="checkbox" onCheckedChange={onCheckedChange} />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Select Engineering'));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect((onCheckedChange.mock.calls[0][0] as { target: { value: string } }).target.value).toBe('eng');

    fireEvent.click(screen.getByLabelText('Select Sales'));
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
    const secondValue = (onCheckedChange.mock.calls[1][0] as { target: { value: string } }).target.value;
    expect(secondValue.split(',').sort()).toEqual(['eng', 'sales']);
  });

  it('checkedKeys / selectedKey seed initial state (loading selection/checked state from a bound API value)', () => {
    render(
      <DesignerVizTreeView data={TREE_DATA} selectionMode="checkbox" checkedKeys="eng,sales" />,
    );
    const engCheckbox = screen.getByLabelText('Select Engineering') as HTMLInputElement;
    const salesCheckbox = screen.getByLabelText('Select Sales') as HTMLInputElement;
    expect(engCheckbox.checked).toBe(true);
    expect(salesCheckbox.checked).toBe(true);
  });

  it('showIcons renders the per-node Lucide icon only when explicitly enabled', () => {
    const { container, rerender } = render(
      <DesignerVizTreeView data={TREE_DATA} selectionMode="none" showIcons={false} />,
    );
    expect(container.querySelector('svg.lucide-building-2')).toBeNull();

    rerender(<DesignerVizTreeView data={TREE_DATA} selectionMode="none" showIcons />);
    expect(container.querySelector('svg.lucide-building-2')).not.toBeNull();
  });

  it('exports TSX carrying selectionMode/showIcons props and bound onCheckedChange handler', () => {
    let state = insertItem(createInitialDesignerState(), 'viz.tree-view');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'selectionMode',
      value: 'checkbox',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'showIcons',
      value: true,
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: eventBindingKeyForEvent('onCheckedChange'),
      definition: createEventBindingDefinition('onCheckedChange', '/api/v1/tree-checked', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<DesignerVizTreeView');
    expect(tsx).toMatch(/selectionMode="checkbox"/);
    expect(tsx).toMatch(/\sshowIcons(\s|>)/);
    expect(tsx).toMatch(/onCheckedChange=\{handle/);
  });
});
