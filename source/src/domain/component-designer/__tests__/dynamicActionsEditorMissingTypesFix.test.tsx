/**
 * @vitest-environment jsdom
 * Bug found (parity audit item 87): InspectorDynamicActionsField's ACTION_TYPE_OPTIONS only listed
 * 4 of 6 DesignerDynamicActionType values — refreshDataSource and resetForm were missing from the
 * dropdown (resetForm also had no field editor). Fixed by adding both options + a Target Node
 * editor for resetForm (refreshDataSource already had a Data Source picker).
 *
 * Verified two ways:
 * 1. Real render + fireEvent against the actual `InspectorDynamicActionsField` component (wrapped
 *    in `DesignerDialogHostContext` so `UiSelect` renders a plain native `<select>`, matching how
 *    it renders inside the real event-binding dialogs) — proves a user can actually pick
 *    "Refresh Data Source" / "Reset Form" from the dropdown and configure their fields, with the
 *    resulting `DesignerDynamicAction[]` reaching `onChange` with real shape.
 * 2. Source-text guard (kept from the original pass) as a fast regression tripwire.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { InspectorDynamicActionsField } from '../../../features/component-designer/components/InspectorDynamicActionsField';
import { DesignerDialogHostContext } from '../../../shared/ui/designerDialogHostContext';
import { createDynamicAction } from '../bindingDynamicActionsEngine';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerDynamicAction } from '../types';

afterEach(() => {
  cleanup();
});

const buildFixture = () => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'orders',
    dataSource: {
      id: 'orders',
      name: 'Orders',
      endpoint: '/api/orders',
      fields: ['id'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/orders' } },
    },
  });
  return state;
};

describe('dynamic actions editor missing types (item 87)', () => {
  it('lets a user pick "Refresh Data Source" from the Action dropdown and choose a real data source', () => {
    const state = buildFixture();
    const initialAction = createDynamicAction('setValue');
    const onChange = vi.fn();

    const { rerender } = render(
      <DesignerDialogHostContext.Provider value>
        <InspectorDynamicActionsField
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          trueActions={[initialAction]}
          onChange={onChange}
        />
      </DesignerDialogHostContext.Provider>,
    );

    const actionTypeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(within(actionTypeSelect).getByText('Refresh Data Source')).toBeTruthy();
    expect(within(actionTypeSelect).getByText('Reset Form')).toBeTruthy();

    fireEvent.change(actionTypeSelect, { target: { value: 'refreshDataSource' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [nextActions] = onChange.mock.calls[0] as [DesignerDynamicAction[]];
    expect(nextActions).toHaveLength(1);
    expect(nextActions[0]?.type).toBe('refreshDataSource');

    // Rerender in place (not a fresh mount) with the committed action so the Data Source picker
    // for refreshDataSource mounts, without leaving stale DOM from the previous mount behind.
    onChange.mockClear();
    rerender(
      <DesignerDialogHostContext.Provider value>
        <InspectorDynamicActionsField
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          trueActions={nextActions}
          onChange={onChange}
        />
      </DesignerDialogHostContext.Provider>,
    );

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2); // Action type + Data Source picker
    const dataSourceSelect = selects[1] as HTMLSelectElement;
    expect(within(dataSourceSelect).getByText('Orders')).toBeTruthy();

    fireEvent.change(dataSourceSelect, { target: { value: 'orders' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [afterDataSourcePick] = onChange.mock.calls[0] as [DesignerDynamicAction[]];
    expect(afterDataSourcePick[0]?.type).toBe('refreshDataSource');
    expect((afterDataSourcePick[0] as { dataSourceRef?: string }).dataSourceRef).toBe('orders');
  });

  it('lets a user pick "Reset Form" and choose a real Target Node from the document', () => {
    const state = buildFixture();
    const rootNodeId = state.document.rootNodeId;
    const initialAction = createDynamicAction('setValue');
    const onChange = vi.fn();

    const { rerender } = render(
      <DesignerDialogHostContext.Provider value>
        <InspectorDynamicActionsField
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          trueActions={[initialAction]}
          onChange={onChange}
        />
      </DesignerDialogHostContext.Provider>,
    );

    const actionTypeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(actionTypeSelect, { target: { value: 'resetForm' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [nextActions] = onChange.mock.calls[0] as [DesignerDynamicAction[]];
    expect(nextActions[0]?.type).toBe('resetForm');

    onChange.mockClear();
    rerender(
      <DesignerDialogHostContext.Provider value>
        <InspectorDynamicActionsField
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          trueActions={nextActions}
          onChange={onChange}
        />
      </DesignerDialogHostContext.Provider>,
    );

    expect(screen.getAllByText('Target Node (form / region)').length).toBeGreaterThan(0);
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2); // Action type + resetForm's Target Node picker
    const targetNodeSelect = selects[1] as HTMLSelectElement;

    fireEvent.change(targetNodeSelect, { target: { value: rootNodeId } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [afterTargetPick] = onChange.mock.calls[0] as [DesignerDynamicAction[]];
    expect(afterTargetPick[0]?.type).toBe('resetForm');
    expect((afterTargetPick[0] as { targetNodeId?: string }).targetNodeId).toBe(rootNodeId);
  });

  it('createDynamicAction supports both previously-hidden types', () => {
    expect(createDynamicAction('refreshDataSource').type).toBe('refreshDataSource');
    expect(createDynamicAction('resetForm').type).toBe('resetForm');
  });

  it('source-text regression guard: ACTION_TYPE_OPTIONS + resetForm field block are present', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../features/component-designer/components/InspectorDynamicActionsField.tsx'),
      'utf8',
    );

    expect(source).toMatch(/value:\s*'refreshDataSource'/);
    expect(source).toMatch(/value:\s*'resetForm'/);
    expect(source).toMatch(/action\.type === 'resetForm'/);
    expect(source).toMatch(/Target Node \(form \/ region\)/);
    expect(source).toMatch(/action\.type === 'refreshDataSource'/);
  });
});
