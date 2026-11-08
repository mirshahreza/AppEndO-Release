/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UiTreeSelect, type UiTreeSelectNode } from '../UiTreeSelect';

const TREE: UiTreeSelectNode[] = [
  {
    id: 'org',
    label: 'Organization',
    children: [
      { id: 'eng', label: 'Engineering', children: [{ id: 'eng-fe', label: 'Frontend' }] },
    ],
  },
  { id: 'partners', label: 'Partners' },
];

describe('UiTreeSelect', () => {
  afterEach(() => {
    cleanup();
  });

  it('selects a branch and closes the popover', async () => {
    const onChange = vi.fn();
    render(
      <UiTreeSelect
        ariaLabel="Department"
        value=""
        items={TREE}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Department' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Engineering' }));

    expect(onChange).toHaveBeenCalledWith('eng');
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  it('lazy-loads children on expand', async () => {
    const onLoadChildren = vi.fn(async () => [
      { id: 'lazy-child', label: 'Lazy child' },
    ]);
    const items: UiTreeSelectNode[] = [
      { id: 'root', label: 'Root', hasChildren: true },
    ];

    render(
      <UiTreeSelect
        ariaLabel="Lazy tree"
        value=""
        items={items}
        onLoadChildren={onLoadChildren}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lazy tree' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

    await waitFor(() => {
      expect(onLoadChildren).toHaveBeenCalledWith('root');
      expect(screen.getByRole('button', { name: 'Lazy child' })).toBeTruthy();
    });
  });

  it('portals the listbox to document.body so overflow shells cannot clip it', () => {
    render(
      <div style={{ overflow: 'hidden', height: 40 }}>
        <UiTreeSelect
          ariaLabel="Clipped host"
          value=""
          items={TREE}
          onChange={vi.fn()}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clipped host' }));
    const listbox = screen.getByRole('listbox', { name: 'Clipped host' });
    expect(listbox.parentElement).toBe(document.body);
    expect(listbox.className).toContain('fixed');
  });

  it('opens the tree in a larger window from the grouped ⋯ control', async () => {
    const onChange = vi.fn();
    render(
      <UiTreeSelect
        ariaLabel="Browse root"
        browserTitle="Browse departments"
        value=""
        items={TREE}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Browse root in larger window' }));

    expect(screen.getByRole('dialog', { name: 'Browse departments' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Partners' }));

    expect(onChange).toHaveBeenCalledWith('partners');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Browse departments' })).toBeNull();
    });
  });

  it('uses valueLabel when the selected node is not yet in items', () => {
    render(
      <UiTreeSelect
        ariaLabel="Nested root"
        value="102.003"
        valueLabel="102 — Parent / 102.003 — Child"
        items={[{ id: '102', label: '102 — Parent', hasChildren: true }]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Nested root' }).textContent).toContain(
      '102 — Parent / 102.003 — Child',
    );
  });
});
