/**
 * @vitest-environment jsdom
 * viz.tree-select / viz.cascader / viz.tree-combobox — the flat "Options" LOV field was removed
 * (it silently overrode the correct hierarchical data), and real selection output + an empty
 * state for bound-but-empty data were added. See DesignerRuntimeTreeWidgets.tsx.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  DesignerVizCascader,
  DesignerVizTreeCombobox,
  DesignerVizTreeSelect,
} from '../DesignerRuntimeTreeWidgets';

afterEach(() => cleanup());

const TREE_DATA = JSON.stringify([
  {
    id: 'root',
    label: 'Head Office',
    children: [
      { id: 'eng', label: 'Engineering' },
      { id: 'sales', label: 'Sales' },
    ],
  },
]);

describe('viz.tree-select', () => {
  it('single mode: picking a node fires onSelectionChange with the node id and closes the popup', () => {
    const onSelectionChange = vi.fn();
    render(<DesignerVizTreeSelect data={TREE_DATA} onSelectionChange={onSelectionChange} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Engineering'));

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect((onSelectionChange.mock.calls[0][0] as { target: { value: string } }).target.value).toBe('eng');
    expect(screen.queryByText('Sales')).toBeNull();
  });

  it('multiple mode: checkboxes accumulate a CSV and the trigger shows a count', () => {
    const onSelectionChange = vi.fn();
    render(<DesignerVizTreeSelect data={TREE_DATA} multiple onSelectionChange={onSelectionChange} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByLabelText('Select Engineering'));
    fireEvent.click(screen.getByLabelText('Select Sales'));

    expect(onSelectionChange).toHaveBeenCalledTimes(2);
    const lastValue = (onSelectionChange.mock.calls[1][0] as { target: { value: string } }).target.value;
    expect(lastValue.split(',').sort()).toEqual(['eng', 'sales']);
    expect(screen.getByText('2 selected')).toBeTruthy();
  });

  it('selectedKeys seeds initial checked state in multiple mode', () => {
    render(<DesignerVizTreeSelect data={TREE_DATA} multiple selectedKeys="eng,sales" />);
    expect(screen.getByText('2 selected')).toBeTruthy();
  });

  it('shows an empty state instead of nothing when bound and resolved to zero nodes', () => {
    // Shared Data-bound Element Contract (Phase 45): the empty state now replaces the dropdown
    // trigger entirely (same pattern as viz.cascader / viz.tree-combobox below), rather than
    // requiring the user to open an empty dropdown to discover there is nothing to select.
    render(<DesignerVizTreeSelect data="[]" vizListBound />);
    expect(screen.getByText(/No data/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a stale flat "items" prop has no effect — DesignerVizTreeSelect no longer accepts one', () => {
    // Type-level proof: the props type has no `optionItems`/`items` field at all any more.
    // @ts-expect-error items is not a valid prop
    render(<DesignerVizTreeSelect data={TREE_DATA} items={[{ id: 'x', textValue: 'x' }]} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Engineering')).toBeTruthy();
  });
});

describe('viz.cascader', () => {
  it('drilling into a leaf fires onSelectionChange with the leaf id', () => {
    const onSelectionChange = vi.fn();
    render(<DesignerVizCascader data={TREE_DATA} onSelectionChange={onSelectionChange} />);

    fireEvent.click(screen.getByText('Head Office'));
    fireEvent.click(screen.getByText('Engineering'));

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect((onSelectionChange.mock.calls[0][0] as { target: { value: string } }).target.value).toBe('eng');
  });

  it('selectedKey seeds the levels/selection from a bound value', () => {
    render(<DesignerVizCascader data={TREE_DATA} selectedKey="eng" />);
    expect(screen.getByText('Head Office / Engineering')).toBeTruthy();
  });

  it('shows an empty state instead of nothing when bound and resolved to zero nodes', () => {
    render(<DesignerVizCascader data="[]" vizListBound />);
    expect(screen.getByText(/No data/)).toBeTruthy();
  });
});

describe('viz.tree-combobox', () => {
  it('picking a search result commits a real selectedId and fires onSelectionChange', () => {
    const onSelectionChange = vi.fn();
    render(<DesignerVizTreeCombobox data={TREE_DATA} onSelectionChange={onSelectionChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Eng' } });
    fireEvent.click(screen.getByText('Head Office / Engineering'));

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect((onSelectionChange.mock.calls[0][0] as { target: { value: string } }).target.value).toBe('eng');
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Head Office / Engineering');
  });

  it('selectedKey seeds the initial query text from a bound value', () => {
    render(<DesignerVizTreeCombobox data={TREE_DATA} selectedKey="sales" />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Head Office / Sales');
  });

  it('shows an empty state instead of nothing when bound and resolved to zero nodes', () => {
    render(<DesignerVizTreeCombobox data="[]" vizListBound />);
    expect(screen.getByText(/No data/)).toBeTruthy();
  });
});
