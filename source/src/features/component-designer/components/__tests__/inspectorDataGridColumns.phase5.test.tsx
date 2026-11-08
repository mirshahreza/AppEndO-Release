// @vitest-environment jsdom

/**
 * Phase 5 — collapsible grid column editor.
 * Real DOM assertions: accordion expand, summary badges, control-count density, a11y.
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';

vi.mock('@heroui/react', async () => {
  const { componentDesignerHeroUiMock } = await import('../../../../test-support/componentDesignerHeroUiMock');
  return componentDesignerHeroUiMock;
});

vi.mock('../../../../shared/ui/HeroFieldControls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/ui/HeroFieldControls')>();
  return {
    ...actual,
    UiInput: ({ value, onChange, ariaLabel, type, placeholder, isDisabled, disabled, label }: any) => (
      <label>
        {label ? <span>{label}</span> : null}
        <input
          value={value ?? ''}
          onChange={onChange}
          aria-label={ariaLabel ?? label}
          type={type}
          placeholder={placeholder}
          disabled={Boolean(isDisabled ?? disabled)}
        />
      </label>
    ),
    UiSelect: ({ value, onChange, ariaLabel, children, isDisabled, disabled, label }: any) => (
      <label>
        {label ? <span>{label}</span> : null}
        <select
          value={value ?? ''}
          onChange={onChange}
          aria-label={ariaLabel ?? label}
          disabled={Boolean(isDisabled ?? disabled)}
        >
          {children}
        </select>
      </label>
    ),
    UiCheckbox: ({ checked, onChange, children }: any) => (
      <label>
        <input
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(event: any) => onChange?.({ target: { checked: event.target.checked } })}
        />
        {children}
      </label>
    ),
    UiCheckboxChoice: ({ checked, onChange, children, id }: any) => (
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(event: any) => onChange?.(event.target.checked)}
        />
        {children}
      </label>
    ),
  };
});

vi.mock('../../../../shared/api/queries/slots', () => ({
  useSlotsCatalogQuery: () => ({ data: { slots: [] }, isError: false }),
}));

vi.mock('../../../../shared/api/queries/component-designer', () => ({
  useComponentDesignerDraftsQuery: () => ({ data: [], isError: false }),
}));

vi.mock('../../../../shared/api/queries/roles', () => ({
  useRolesListQuery: () => ({ data: [], isError: false, isLoading: false }),
}));

import { createInitialDesignerState, designerReducer } from '../../../../domain/component-designer/state';
import { serializeDesignerDataGridColumns } from '../../../../domain/component-designer/designerDataGridColumns';
import { InspectorDataGridColumnsField } from '../InspectorDataGridColumnsField';

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const insertAndSelect = (itemId: string) => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });
  const root = state.document.nodes[state.document.rootNodeId];
  const childId = root.children[root.children.length - 1];
  state = designerReducer(state, { type: 'select-node', nodeId: childId });
  const node = state.document.nodes[childId];
  return { state, node };
};

const countFormControls = (container: HTMLElement) => {
  const inputs = container.querySelectorAll('input:not([type="hidden"])');
  const selects = container.querySelectorAll('select');
  const textareas = container.querySelectorAll('textarea');
  return inputs.length + selects.length + textareas.length;
};

afterEach(() => {
  cleanup();
});

describe('Phase 5 — collapsible grid columns editor', () => {
  it('defaults all columns collapsed; expanding one keeps others collapsed', () => {
    const { state, node } = insertAndSelect('heroui.app-table-grid');
    const { container } = wrap(
      <InspectorDataGridColumnsField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );

    const cards = container.querySelectorAll('[data-column-card]');
    expect(cards.length).toBeGreaterThanOrEqual(3);
    for (const card of Array.from(cards)) {
      expect(card.getAttribute('data-expanded')).toBe('false');
    }
    expect(screen.queryByText('Header Label')).toBeNull();
    expect(screen.queryByText('Identity')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Column 1:/i }));
    expect(cards[0].getAttribute('data-expanded')).toBe('true');
    expect(cards[1].getAttribute('data-expanded')).toBe('false');
    expect(cards[2].getAttribute('data-expanded')).toBe('false');
    expect(screen.getByText('Identity')).toBeTruthy();
    expect(screen.getByText('Behavior')).toBeTruthy();
    expect(screen.getByText('Display')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Column 2:/i }));
    expect(cards[0].getAttribute('data-expanded')).toBe('false');
    expect(cards[1].getAttribute('data-expanded')).toBe('true');
    expect(cards[2].getAttribute('data-expanded')).toBe('false');
  });

  it('label edit in expanded mode appears on collapsed summary after collapse', () => {
    const { state, node } = insertAndSelect('heroui.app-table-grid');
    wrap(
      <InspectorDataGridColumnsField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Column 1:/i }));
    fireEvent.change(screen.getByLabelText('Column 1 header'), { target: { value: 'Renamed ID' } });

    // Collapse via summary click — local state keeps the edited label
    fireEvent.click(screen.getByRole('button', { name: /Column 1:/i }));
    expect(screen.queryByLabelText('Column 1 header')).toBeNull();
    expect(screen.getByRole('button', { name: /Column 1: Renamed ID/i })).toBeTruthy();
  });

  it('summary badges show only active options; turning off removes badge', () => {
    const { state, node } = insertAndSelect('heroui.app-table-grid');
    // Default col 0 (ID): sort=true → Sortable badge; col 1 (Name): sort+filter → both
    const { container } = wrap(
      <InspectorDataGridColumnsField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );

    const firstCard = () => container.querySelector('[data-column-index="0"]') as HTMLElement;
    const secondCard = () => container.querySelector('[data-column-index="1"]') as HTMLElement;

    expect(within(firstCard()).queryAllByText('Sortable')).toHaveLength(1);
    expect(within(firstCard()).queryByText('Filterable')).toBeNull();
    expect(within(secondCard()).getByText('Sortable')).toBeTruthy();
    expect(within(secondCard()).getByText('Filterable')).toBeTruthy();

    // Expand first column, turn off Sortable via chip (Phase 6)
    fireEvent.click(within(firstCard()).getByRole('button', { name: /Column 1:/i }));
    const sortChip = within(firstCard()).getByRole('button', { name: /^Sortable$/i });
    expect(sortChip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(sortChip);

    // Collapse and verify badge gone (local state updated by persist)
    fireEvent.click(within(firstCard()).getByRole('button', { name: /Column 1:/i }));
    expect(within(firstCard()).queryByText('Sortable')).toBeNull();
  });

  it('move/remove column actions remain keyboard-reachable (not hover-only)', () => {
    const { state, node } = insertAndSelect('heroui.app-table-grid');
    wrap(
      <InspectorDataGridColumnsField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );

    // Column 1 "up" is disabled — use "down" and column 2 "up" for focusability checks.
    const down = screen.getByRole('button', { name: 'Move column 1 down' });
    const up2 = screen.getByRole('button', { name: 'Move column 2 up' });
    const remove = screen.getByRole('button', { name: 'Remove column 1' });
    expect(down).toBeTruthy();
    expect(up2).toBeTruthy();
    expect(remove).toBeTruthy();
    expect(down).not.toBeDisabled();
    expect(up2).not.toBeDisabled();
    // Present in the a11y tree even while visually opacity-0 until hover/focus-within
    down.focus();
    expect(document.activeElement === down || down.contains(document.activeElement)).toBe(true);
  });

  it('Self-Audit: 10-column default-collapsed form control count is ≤30 (was ~130)', () => {
    const tenColumns = Array.from({ length: 10 }, (_, index) => ({
      key: `field_${index + 1}`,
      label: `Column ${index + 1}`,
      sort: index % 2 === 0,
      filter: index % 3 === 0,
      width: '100px',
      layoutHideable: true,
      layoutResizable: true,
      layoutReorderable: true,
    }));

    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const root = state.document.nodes[state.document.rootNodeId];
    const childId = root.children[root.children.length - 1];
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: childId,
      key: 'columns',
      value: serializeDesignerDataGridColumns(tenColumns),
    });
    state = designerReducer(state, { type: 'select-node', nodeId: childId });
    const node = state.document.nodes[childId];

    const { container } = wrap(
      <InspectorDataGridColumnsField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );

    const cards = container.querySelectorAll('[data-column-card]');
    expect(cards.length).toBe(10);
    for (const card of Array.from(cards)) {
      expect(card.getAttribute('data-expanded')).toBe('false');
    }

    const collapsedControlCount = countFormControls(container);
    // Pre-phase-5: ~13 controls × 10 columns ≈ 130. Collapsed: no per-column inputs/selects/checkboxes.
    expect(collapsedControlCount).toBeLessThanOrEqual(30);
    expect(collapsedControlCount).toBeLessThan(20);

    // Expand one column — controls appear for that column only; others stay collapsed
    fireEvent.click(screen.getByRole('button', { name: /Column 1:/i }));
    const expandedControlCount = countFormControls(container);
    expect(expandedControlCount).toBeGreaterThan(collapsedControlCount);
    expect(expandedControlCount).toBeLessThan(50);

    // Record for final report (visible in vitest output)
    // eslint-disable-next-line no-console
    console.log(
      `[phase5-self-audit] collapsedControls=${collapsedControlCount} expandedOneControls=${expandedControlCount} (baseline-before≈130 for 10 cols)`,
    );
  });

  it('re-expanding a column restores previous field values (no reset)', () => {
    const { state, node } = insertAndSelect('heroui.app-table-grid');
    wrap(
      <InspectorDataGridColumnsField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Column 1:/i }));
    fireEvent.change(screen.getByLabelText('Column 1 header'), { target: { value: 'Kept Label' } });
    fireEvent.click(screen.getByRole('button', { name: /Column 1:/i })); // collapse
    fireEvent.click(screen.getByRole('button', { name: /Column 1: Kept Label/i })); // expand again
    expect((screen.getByLabelText('Column 1 header') as HTMLInputElement).value).toBe('Kept Label');
  });

  it('collapsed summary rows use data-column-summary and expand control tokens', () => {
    const { state, node } = insertAndSelect('heroui.app-table-grid');
    const { container } = wrap(
      <InspectorDataGridColumnsField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );

    const summaries = container.querySelectorAll('[data-column-summary]');
    expect(summaries.length).toBeGreaterThanOrEqual(3);
    const first = summaries[0] as HTMLElement;
    expect(first.className).toMatch(/min-h-8/);
    const expand = within(first).getByRole('button', { name: /Column 1:/i });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    expect(expand.className).toMatch(/cursor-pointer/);
  });
});
