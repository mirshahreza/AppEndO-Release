// @vitest-environment jsdom

/**
 * Phase 4 — shared Inspector field primitives.
 * Asserts real DOM className / structure (not props-only) after MicroLabel + FieldGroup extraction.
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
import { InspectorDataGridColumnsField } from '../InspectorDataGridColumnsField';
import { InspectorLucideIconPickerField } from '../InspectorLucideIconPickerField';
import { InspectorGridDisableRuleFields } from '../InspectorGridDisableRuleFields';
import {
  InspectorFieldGroup,
  InspectorMicroLabel,
  INSPECTOR_MICRO_LABEL_CLASS,
} from '../inspectorFieldPrimitives';
import { INSPECTOR_TEXT_2XS } from '../inspectorDesignTokens';

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

afterEach(() => {
  cleanup();
});

describe('Phase 4 — inspector field primitives', () => {
  it('InspectorMicroLabel renders the official caption className token', () => {
    const { container } = render(<InspectorMicroLabel>Header Label</InspectorMicroLabel>);
    const el = container.querySelector('span');
    expect(el).toBeTruthy();
    expect(el!.className).toBe(INSPECTOR_MICRO_LABEL_CLASS);
    expect(el!.className).toContain(INSPECTOR_TEXT_2XS);
    expect(el!.className).toContain('font-semibold');
    expect(el!.className).toContain('text-slate-500');
    expect(el!.className).toContain('ps-[4px]');
    expect(el!.textContent).toBe('Header Label');
  });

  it('InspectorFieldGroup renders a real grid-cols-2 structure', () => {
    const { container } = render(
      <InspectorFieldGroup columns={2}>
        <span>A</span>
        <span>B</span>
      </InspectorFieldGroup>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('grid');
    expect(root.className).toContain('grid-cols-2');
    expect(root.className).toContain('gap-2');
    expect(root.children).toHaveLength(2);
  });

  it('InspectorFieldGroup optional title uses InspectorMicroLabel className', () => {
    render(
      <InspectorFieldGroup title="Identity" columns={2}>
        <span>A</span>
        <span>B</span>
      </InspectorFieldGroup>,
    );
    const title = screen.getByText('Identity');
    expect(title.className).toContain(INSPECTOR_TEXT_2XS);
    expect(title.className).toBe(INSPECTOR_MICRO_LABEL_CLASS);
  });

  it('Grid columns field captions use InspectorMicroLabel className (real render)', () => {
    const { state, node } = insertAndSelect('heroui.app-table-grid');
    wrap(
      <InspectorDataGridColumnsField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );

    // Phase 5: expand first column to reveal Identity captions.
    fireEvent.click(screen.getAllByRole('button', { name: /Column 1:/i })[0]);

    const headerCaptions = screen.getAllByText('Header Label');
    expect(headerCaptions.length).toBeGreaterThan(0);
    for (const caption of headerCaptions) {
      expect(caption.tagName.toLowerCase()).toBe('span');
      expect(caption.className).toBe(INSPECTOR_MICRO_LABEL_CLASS);
      expect(caption.className).toContain('text-[10px]');
    }

    const fieldKeys = screen.getAllByText('Field Key');
    for (const caption of fieldKeys) {
      expect(caption.className).toBe(INSPECTOR_MICRO_LABEL_CLASS);
    }
  });

  it('Grid columns Header Label + Field Key sit inside InspectorFieldGroup grid', () => {
    const { state, node } = insertAndSelect('heroui.app-table-grid');
    const { container } = wrap(
      <InspectorDataGridColumnsField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Column 1:/i })[0]);

    const header = screen.getAllByText('Header Label')[0];
    const group = header.closest('.grid.grid-cols-2') as HTMLElement | null;
    expect(group).toBeTruthy();
    expect(group!.className).toMatch(/\bgrid\b/);
    expect(group!.className).toMatch(/\bgrid-cols-2\b/);
    expect(within(group!).getByText('Field Key')).toBeTruthy();

    // No leftover hand-written caption span with the old duplicated template
    const leftover = Array.from(container.querySelectorAll('span')).filter((el) =>
      el.className.includes('font-semibold text-slate-500')
      && el.className.includes('text-[10px]')
      && el.className.includes('ps-[4px]')
      && el.textContent === 'Header Label'
      && el.className !== INSPECTOR_MICRO_LABEL_CLASS,
    );
    expect(leftover).toHaveLength(0);
  });

  it('changing Header Label still dispatches update (behavior unchanged)', () => {
    const { state, node } = insertAndSelect('heroui.app-table-grid');
    const dispatch = vi.fn();
    wrap(
      <InspectorDataGridColumnsField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Column 1:/i })[0]);

    const input = screen.getByLabelText('Column 1 header');
    fireEvent.change(input, { target: { value: 'Renamed Col' } });
    expect(dispatch).toHaveBeenCalled();
    const action = dispatch.mock.calls[0][0];
    expect(action).toMatchObject({
      type: 'set-node-prop',
      nodeId: node.id,
      key: 'columns',
    });
    expect(String(action.value)).toContain('Renamed Col');
  });

  it('Lucide icon picker label uses InspectorMicroLabel', () => {
    wrap(
      <InspectorLucideIconPickerField
        label="Icon"
        value="Settings2"
        onChange={vi.fn()}
      />,
    );
    const label = screen.getByText('Icon');
    expect(label.className).toBe(INSPECTOR_MICRO_LABEL_CLASS);
  });

  it('Disable-rule fields use InspectorMicroLabel for nested captions', () => {
    wrap(
      <InspectorGridDisableRuleFields
        rule={{ preset: 'builtin-field', field: 'is_builtin' }}
        onChange={vi.fn()}
        fieldKey="test-disable"
      />,
    );
    const booleanField = screen.getByText('Boolean field');
    expect(booleanField.className).toBe(INSPECTOR_MICRO_LABEL_CLASS);
    expect(screen.getByLabelText('test-disable:disable-field')).toHaveValue('is_builtin');
  });
});
