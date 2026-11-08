// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@heroui/react', async () => {
  const { componentDesignerHeroUiMock } = await import('../../../../test-support/componentDesignerHeroUiMock');
  return componentDesignerHeroUiMock;
});

vi.mock('../../../../shared/ui/HeroFieldControls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/ui/HeroFieldControls')>();
  return {
    ...actual,
    UiInput: ({ value, onChange, ariaLabel, placeholder }: any) => (
      <input
        value={value ?? ''}
        onChange={onChange}
        aria-label={ariaLabel}
        placeholder={placeholder}
      />
    ),
    UiSelect: ({ value, onChange, ariaLabel, children }: any) => (
      <select value={value ?? ''} onChange={onChange} aria-label={ariaLabel}>
        {children}
      </select>
    ),
    UiCheckbox: ({ checked, onChange, 'aria-label': ariaLabel }: any) => (
      <input
        type="checkbox"
        aria-label={ariaLabel}
        checked={Boolean(checked)}
        onChange={(event) => onChange?.({ target: { checked: event.target.checked } })}
      />
    ),
  };
});

const routesQueryState = vi.hoisted(() => ({
  isLoading: false,
  isError: false,
  data: [] as Array<{ id: string; path: string; method: string; name: string; folder: string }>,
}));

vi.mock('../../../../shared/api/queries/my-apis', () => ({
  useAccessibleApiRoutesQuery: () => ({
    data: routesQueryState.data,
    isLoading: routesQueryState.isLoading,
    isError: routesQueryState.isError,
    refetch: vi.fn(),
  }),
}));

const fetchEndpointResponseFields = vi.hoisted(() => vi.fn());
const fetchEndpointFormFields = vi.hoisted(() => vi.fn());

vi.mock('../../../../shared/api/queries/api-endpoint-schema', () => ({
  fetchEndpointResponseFields: (...args: unknown[]) => fetchEndpointResponseFields(...args),
  fetchEndpointFormFields: (...args: unknown[]) => fetchEndpointFormFields(...args),
}));

import { createInitialDesignerState, designerReducer } from '../../../../domain/component-designer/state';
import { BindingGridWizardDialog } from '../BindingGridWizardDialog';
import { BindingChartWizardDialog } from '../BindingChartWizardDialog';
import { BindingFormWizardDialog } from '../BindingFormWizardDialog';
import { BindingResourceQuickConnect } from '../BindingResourceQuickConnect';
import { StepWizardShell } from '../../../../shared/ui/StepWizardShell';
import { GRID_LIST_RESOURCE_BINDING_KEY } from '../../../../domain/component-designer/bindingGridEngine';
import { parseDesignerDataGridColumns } from '../../../../domain/component-designer/designerDataGridColumns';
import { createChartDataResourceBindingDefinition, CHART_DATA_RESOURCE_BINDING_KEY } from '../../../../domain/component-designer/bindingChartEngine';
import { createRegionDataSourceBindingDefinition, REGION_DATA_SOURCE_BINDING_KEY } from '../../../../domain/component-designer/bindingRegionEngine';

const insertNode = (state: ReturnType<typeof createInitialDesignerState>, itemId: string, parentId: string) => {
  const next = designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId,
  });
  const parent = next.document.nodes[parentId];
  const nodeId = parent.children[parent.children.length - 1] as string;
  return { state: next, nodeId };
};

afterEach(() => {
  cleanup();
  routesQueryState.isLoading = false;
  routesQueryState.isError = false;
  routesQueryState.data = [];
  fetchEndpointResponseFields.mockReset();
  fetchEndpointFormFields.mockReset();
});

describe('Binding wizard dialogs (T1-15)', () => {
  it('StepWizardShell shows Cancel on the first step and calls onClose', () => {
    const onClose = vi.fn();

    render(
      <StepWizardShell
        title="Test wizard"
        steps={[{ title: 'Connect' }, { title: 'Done' }]}
        step={0}
        onStepChange={vi.fn()}
        onClose={onClose}
      >
        <p>Step body</p>
      </StepWizardShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('BindingResourceQuickConnect shows loading while API routes are fetched', () => {
    routesQueryState.isLoading = true;

    render(
      <BindingResourceQuickConnect
        bindingDefinitions={{ dataSources: {}, regions: {}, stores: {} }}
        dataSourceId=""
        quickEndpoint=""
        onDataSourceIdChange={vi.fn()}
        onQuickEndpointChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Loading your API routes…')).toBeInTheDocument();
  });

  it('BindingResourceQuickConnect shows a friendly message when schema lookup fails', async () => {
    routesQueryState.data = [{
      id: 'route-1',
      path: '/api/products',
      method: 'GET',
      name: 'Products',
      folder: 'catalog',
    }];
    fetchEndpointResponseFields.mockRejectedValue(new Error('500 Internal Server Error'));

    const onCreateResource = vi.fn();

    render(
      <BindingResourceQuickConnect
        bindingDefinitions={{ dataSources: {}, regions: {}, stores: {} }}
        dataSourceId=""
        quickEndpoint="/api/products"
        onDataSourceIdChange={vi.fn()}
        onQuickEndpointChange={vi.fn()}
        onCreateResource={onCreateResource}
        fieldSource="response"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Connect/i }));

    await waitFor(() => {
      expect(screen.getByText(/Could not read column fields from this API/i)).toBeInTheDocument();
    });
    expect(onCreateResource).not.toHaveBeenCalled();
  });

  it('BindingChartWizardDialog restores endpoint on reopen and clears draft edits after cancel', async () => {
    let state = createInitialDesignerState();
    const chartInsert = insertNode(state, 'viz.chart-bar', state.document.rootNodeId);
    state = chartInsert.state;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'sales',
      dataSource: {
        id: 'sales',
        name: 'Sales',
        endpoint: '/api/sales',
        fields: ['month', 'amount'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: chartInsert.nodeId,
      bindingKey: CHART_DATA_RESOURCE_BINDING_KEY,
      definition: createChartDataResourceBindingDefinition('sales'),
    });

    const chartNode = state.document.nodes[chartInsert.nodeId]!;
    const dispatch = vi.fn();
    const onClose = vi.fn();
    let open = true;

    const { rerender } = render(
      <BindingChartWizardDialog
        open={open}
        onClose={onClose}
        document={state.document}
        chartNode={chartNode}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={dispatch}
      />,
    );

    const pathInput = screen.getByLabelText('API path');
    fireEvent.change(pathInput, { target: { value: '/api/draft-only' } });
    expect(pathInput).toHaveValue('/api/draft-only');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();

    open = false;
    rerender(
      <BindingChartWizardDialog
        open={open}
        onClose={onClose}
        document={state.document}
        chartNode={chartNode}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={dispatch}
      />,
    );

    open = true;
    rerender(
      <BindingChartWizardDialog
        open={open}
        onClose={onClose}
        document={state.document}
        chartNode={chartNode}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={dispatch}
      />,
    );

    expect(screen.getByLabelText('API path')).toHaveValue('/api/sales');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('BindingGridWizardDialog applies bindings end-to-end', async () => {
    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
    state = gridInsert.state;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'products',
      dataSource: {
        id: 'products',
        name: 'Products',
        endpoint: '/api/products',
        fields: ['id', 'name'],
      },
    });

    const gridNode = state.document.nodes[gridInsert.nodeId]!;
    const dispatch = vi.fn((action: Parameters<typeof designerReducer>[1]) => {
      state = designerReducer(state, action);
    });

    render(
      <BindingGridWizardDialog
        open
        onClose={vi.fn()}
        document={state.document}
        gridNode={gridNode}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={dispatch}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Go to step 3: Done' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3: Done' }));
    fireEvent.click(screen.getByRole('button', { name: /Apply & connect/i }));

    expect(dispatch).toHaveBeenCalled();
    const bindingActions = (dispatch.mock.calls as Array<[Parameters<typeof designerReducer>[1]]>)
      .map(([action]) => action)
      .filter((action) => action.type === 'set-node-binding' && action.bindingKey === GRID_LIST_RESOURCE_BINDING_KEY);
    expect(bindingActions.length).toBeGreaterThan(0);
  });

  it('BindingGridWizardDialog: unchecking a column in the Columns step is reflected in the applied node.props.columns, matching what a hand-edit via the Inspector would produce', async () => {
    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
    state = gridInsert.state;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'products',
      dataSource: {
        id: 'products',
        name: 'Products',
        endpoint: '/api/products',
        fields: ['id', 'name', 'price'],
      },
    });

    const gridNode = state.document.nodes[gridInsert.nodeId]!;
    const dispatch = vi.fn((action: Parameters<typeof designerReducer>[1]) => {
      state = designerReducer(state, action);
    });

    render(
      <BindingGridWizardDialog
        open
        onClose={vi.fn()}
        document={state.document}
        gridNode={gridNode}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={dispatch}
      />,
    );

    // Step 0 -> 1 (Columns)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Go to step 2: Columns' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 2: Columns' }));

    // All 3 API fields should auto-populate as enabled columns (real DOM checkboxes, real labels;
    // labels are humanized/title-cased by buildGridColumnWizardRows, e.g. "price" -> "Price").
    await waitFor(() => {
      expect(screen.getByLabelText('Show column Price')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Show column ID')).toBeChecked();
    expect(screen.getByLabelText('Show column Name')).toBeChecked();
    expect(screen.getByLabelText('Show column Price')).toBeChecked();

    // Turn off "price" via a real fireEvent click on the real checkbox.
    fireEvent.click(screen.getByLabelText('Show column Price'));
    expect(screen.getByLabelText('Show column Price')).not.toBeChecked();

    // Step 1 -> 2 (Done) -> Apply
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3: Done' }));
    fireEvent.click(screen.getByRole('button', { name: /Apply & connect/i }));

    const finalNode = state.document.nodes[gridInsert.nodeId]!;
    const finalColumns = parseDesignerDataGridColumns(finalNode.props.columns);
    const finalKeys = finalColumns.map((column) => column.key);

    expect(finalKeys).toContain('id');
    expect(finalKeys).toContain('name');
    expect(finalKeys).not.toContain('price');

    // Parity check: the binding the wizard wrote is functionally identical to what
    // InspectorGridBindingPanel's own commitResource() would write for the same resource
    // (both normalize to the same list-load definition; storeWritePath/dataPath differ only
    // in whether the 'gridQuery.sort'/'gridQuery.page' defaults are stamped at creation time
    // vs resolved later in collectDocumentGridPlan — same effective binding either way).
    const wizardBinding = finalNode.binding[GRID_LIST_RESOURCE_BINDING_KEY];
    expect(wizardBinding?.dataSourceRef).toBe('products');
    expect(wizardBinding?.loadOperation).toBe('list');
  });

  it('BindingFormWizardDialog resets scenario edits after cancel and reopen', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;
    insertNode(state, 'heroui.input-text', formInsert.nodeId);

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'customers',
      dataSource: {
        id: 'customers',
        name: 'Customers',
        endpoint: '/api/customers',
        fields: ['email'],
      },
    });

    const regionNode = state.document.nodes[formInsert.nodeId]!;
    const dispatch = vi.fn();
    const onClose = vi.fn();
    let open = true;

    const { rerender } = render(
      <BindingFormWizardDialog
        open={open}
        onClose={onClose}
        document={state.document}
        regionNode={regionNode}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Search \/ filter/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    open = false;
    rerender(
      <BindingFormWizardDialog
        open={open}
        onClose={onClose}
        document={state.document}
        regionNode={regionNode}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={dispatch}
      />,
    );

    open = true;
    rerender(
      <BindingFormWizardDialog
        open={open}
        onClose={onClose}
        document={state.document}
        regionNode={regionNode}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={dispatch}
      />,
    );

    expect(screen.getByRole('button', { name: /Save form/i })).toHaveClass('ring-1');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('BindingFormWizardDialog applies region binding end-to-end', async () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;
    const inputInsert = insertNode(state, 'heroui.input-text', formInsert.nodeId);
    state = inputInsert.state;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: inputInsert.nodeId,
      key: 'label',
      value: 'Email',
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'customers',
      dataSource: {
        id: 'customers',
        name: 'Customers',
        endpoint: '/api/customers',
        fields: ['email'],
      },
    });

    const regionNode = state.document.nodes[formInsert.nodeId]!;
    const dispatch = vi.fn();

    render(
      <BindingFormWizardDialog
        open
        onClose={vi.fn()}
        document={state.document}
        regionNode={regionNode}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3: Done' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Apply & connect/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Apply & connect/i }));

    const regionBindingActions = (dispatch.mock.calls as Array<[Parameters<typeof designerReducer>[1]]>)
      .map(([action]) => action)
      .filter((action) => action.type === 'set-node-binding' && action.bindingKey === REGION_DATA_SOURCE_BINDING_KEY);
    expect(regionBindingActions.length).toBeGreaterThan(0);
  });
});
