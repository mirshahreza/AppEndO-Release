/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CultureProvider } from '../../../core/culture/CultureContext';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createRegionColumnBindingDefinition, REGION_DATA_SOURCE_BINDING_KEY, createRegionDataSourceBindingDefinition } from '../bindingRegionEngine';
import { buildPreviewDesignerStore } from '../designerPreviewResolvers';
import {
  createGridListResourceBindingDefinition,
  GRID_LIST_RESOURCE_BINDING_KEY,
  resolveGridListDataVarName,
} from '../bindingGridEngine';
import {
  createGridDetailFlowBindingDefinition,
  GRID_DETAIL_FLOW_BINDING_KEY,
} from '../bindingGridDetailEngine';
import {
  APP_TABLE_GRID_PALETTE_ITEM_ID,
  DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS,
  serializeDesignerDataGridColumns,
} from '../designerDataGridColumns';
import { DesignerRuntimeAppTableGrid } from '../DesignerRuntimeAppTableGrid';
import type { DesignerNode } from '../types';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';

const insertNode = (state: ReturnType<typeof createInitialDesignerState>, itemId: string, parentId: string) => {
  const next = designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId,
  });
  const parent = next.document.nodes[parentId];
  const childId = parent.children[parent.children.length - 1];
  return { state: next, nodeId: childId };
};

/**
 * Bug found: this suite rendered `renderDesignerDocumentPreview`/`DesignerRuntimeAppTableGrid`
 * directly via bare `render()`, without the `CultureProvider` ancestor real usage always has
 * (see `DesignerPreviewViewport.tsx`). `AppTableGridColumnHeader`/`ToolbarSearchInput`
 * (shared/ui) call `useCultureT()`, which throws "useCulture must be used within
 * CultureProvider." outside one — every test that rendered an App Table Grid (10 of 14 in this
 * file) errored out via the Designer's own preview error boundary instead of exercising real
 * behavior. Wrapping with `CultureProvider` (same `cultureId="us"` pattern already used by
 * `previewPageHydrationRefreshItem0bVerification.test.tsx`) restores real coverage.
 */
const renderWithCulture = (ui: React.ReactElement) => render(
  <CultureProvider cultureId="us">{ui}</CultureProvider>,
);

describe('DesignerRuntimeGrid preview', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders hydrated API rows when grid list resource is bound', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.data-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'columns',
      value: JSON.stringify([
        { key: 'category_name', label: 'Category', sort: true },
        { key: 'product_count', label: 'Products', sort: true },
        { key: 'avg_price', label: 'Avg price', sort: true },
      ]),
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'categoryStats',
      dataSource: {
        id: 'categoryStats',
        name: 'Category stats',
        endpoint: '/api/vw-demo-category-stats',
        fields: ['category_name', 'product_count', 'avg_price'],
        responseMapping: { arrayPath: 'data' },
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('categoryStats'),
    });

    const gridDataVar = resolveGridListDataVarName(gridNodeId);
    const apiRows = [
      {
        category_name: 'Books',
        product_count: 2,
        avg_price: '41.50',
      },
      {
        category_name: 'Electronics',
        product_count: 2,
        avg_price: '39.75',
      },
    ];

    renderWithCulture(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData: { [gridDataVar]: apiRows },
        })}
      </>,
    );

    expect(screen.getByText('Books')).toBeTruthy();
    expect(screen.getByText('Electronics')).toBeTruthy();
    expect(screen.getByText('41.50')).toBeTruthy();
  });

  it('paginates hydrated rows according to page size', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.data-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'columns',
      value: JSON.stringify([{ key: 'name', label: 'Name', sort: true }]),
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'pageSize',
      value: 2,
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'name'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('users'),
    });

    const gridDataVar = resolveGridListDataVarName(gridNodeId);
    const apiRows = [
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' },
      { id: 3, name: 'User 3' },
      { id: 4, name: 'User 4' },
      { id: 5, name: 'User 5' },
    ];

    renderWithCulture(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData: { [gridDataVar]: apiRows },
          interactive: true,
        })}
      </>,
    );

    expect(screen.getByText('User 1')).toBeTruthy();
    expect(screen.getByText('User 2')).toBeTruthy();
    expect(screen.queryByText('User 3')).toBeNull();
    expect(screen.getByText(/Showing 1-2 of 5/)).toBeTruthy();

    fireEvent.click(screen.getByText('2'));

    expect(screen.queryByText('User 1')).toBeNull();
    expect(screen.getByText('User 3')).toBeTruthy();
    expect(screen.getByText('User 4')).toBeTruthy();
  });

  it('opens the detail modal when the Details row action is clicked', async () => {
    let state = createInitialDesignerState();
    const columnInsert = insertNode(state, 'layout.flex-column', state.document.rootNodeId);
    state = columnInsert.state;
    const gridInsert = insertNode(state, 'heroui.data-grid', columnInsert.nodeId);
    state = gridInsert.state;
    const modalInsert = insertNode(state, 'heroui.modal', columnInsert.nodeId);
    state = modalInsert.state;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: modalInsert.nodeId,
      key: 'title',
      value: 'Message details',
    });

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridInsert.nodeId,
      key: 'columns',
      value: serializeDesignerDataGridColumns([
        { key: 'title', label: 'Title', sort: true },
        { key: '__action_details', label: 'Details', kind: 'action', actionId: 'details' },
      ]),
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'contact-messages',
      dataSource: {
        id: 'contact-messages',
        name: 'Contact messages',
        endpoint: '/api/contact/messages',
        primaryKey: 'id',
        fields: ['id', 'title'],
        operations: {
          list: { method: 'GET', endpoint: '/api/contact/messages' },
          detail: { method: 'GET', endpoint: '/api/contact/messages/:id' },
        },
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridInsert.nodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('contact-messages'),
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridInsert.nodeId,
      bindingKey: GRID_DETAIL_FLOW_BINDING_KEY,
      definition: createGridDetailFlowBindingDefinition({
        primaryKeyField: 'id',
        selectionStorePath: 'selection.id',
        detailDataSourceRef: 'contact-messages',
        detailModalNodeId: modalInsert.nodeId,
        detailRegionNodeId: 'unused-form-region',
        rowActionId: 'details',
        rowActionLabel: 'Details',
      }),
    });

    state = designerReducer(state, {
      type: 'set-store-segment',
      segmentId: 'selection',
      segment: { id: 'selection', initialValue: { id: null } },
    });

    const gridDataVar = resolveGridListDataVarName(gridInsert.nodeId);
    const apiRows = [{ id: 42, title: 'Hello world' }];

    const PreviewHarness: React.FC = () => {
      const [designerStore, setDesignerStore] = React.useState(() =>
        buildPreviewDesignerStore(state.bindingDefinitions),
      );

      return (
        <>
          {renderDesignerDocumentPreview(state.document, {
            bindingDefinitions: state.bindingDefinitions,
            designerStore,
            onStoreChange: setDesignerStore,
            hydrationData: { [gridDataVar]: apiRows },
            interactive: true,
          })}
        </>
      );
    };

    renderWithCulture(<PreviewHarness />);

    expect(screen.getByText('Hello world')).toBeTruthy();
    expect(screen.queryByText('Message details')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    await waitFor(() => {
      expect(screen.getByText('Message details')).toBeTruthy();
    });
  });

  it('shows explicit loading and error states for bound grids', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.data-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'isLoading',
      value: true,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'errorContent',
      value: 'Could not load records',
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'name'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('users'),
    });

    const loadingRender = renderWithCulture(
      <>{renderDesignerDocumentPreview(state.document, {
        bindingDefinitions: state.bindingDefinitions,
      })}</>,
    );
    expect(screen.getByText('Loading records…')).toBeTruthy();
    loadingRender.unmount();

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'isLoading',
      value: false,
    });

    const gridDataVar = resolveGridListDataVarName(gridNodeId);
    renderWithCulture(
      <>{renderDesignerDocumentPreview(state.document, {
        bindingDefinitions: state.bindingDefinitions,
        hydrationData: { [`error_${gridDataVar}`]: true },
      })}</>,
    );
    expect(screen.getByText('Could not load records')).toBeTruthy();
  });

  it('binds region column values into detail form fields from hydration data', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;
    const inputInsert = insertNode(state, 'heroui.input-text', formInsert.nodeId);
    state = inputInsert.state;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formInsert.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('contact-messages', {
        loadOperation: 'detail',
        urlParams: { id: 'selection.id' },
      }),
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputInsert.nodeId,
      bindingKey: 'prop:value',
      definition: createRegionColumnBindingDefinition('value', 'title'),
    });

    renderWithCulture(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          designerStore: { selection: { id: 42 } },
          hydrationData: {
            regionData_contact_messages: {
              title: 'Bound title from API',
            },
          },
          interactive: true,
        })}
      </>,
    );

    expect(screen.getByDisplayValue('Bound title from API')).toBeTruthy();
  });

  it('binds region column values when hydration data is a single-item array', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;
    const inputInsert = insertNode(state, 'heroui.input-text', formInsert.nodeId);
    state = inputInsert.state;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formInsert.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('contact-messages', {
        loadOperation: 'detail',
        urlParams: { id: 'selection.id' },
      }),
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputInsert.nodeId,
      bindingKey: 'prop:value',
      definition: createRegionColumnBindingDefinition('value', 'title'),
    });

    renderWithCulture(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          designerStore: { selection: { id: 42 } },
          hydrationData: {
            regionData_contact_messages: [{
              title: 'Bound title from array payload',
            }],
          },
          interactive: true,
        })}
      </>,
    );

    expect(screen.getByDisplayValue('Bound title from array payload')).toBeTruthy();
  });

  it('allows typing in create-form region fields during interactive preview', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;
    const inputInsert = insertNode(state, 'heroui.input-text', formInsert.nodeId);
    state = inputInsert.state;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formInsert.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('contact-messages'),
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputInsert.nodeId,
      bindingKey: 'prop:value',
      definition: createRegionColumnBindingDefinition('value', 'title'),
    });

    renderWithCulture(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
        })}
      </>,
    );

    const input = document.querySelector(`[name="${inputInsert.nodeId}"]`) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.readOnly).not.toBe(true);
    fireEvent.change(input!, { target: { value: 'New contact title' } });
    expect(input?.value).toBe('New contact title');
  });

  it('renders app table grid with column layout and footer sort controls', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'name', 'status', 'active', 'created_at'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('users'),
    });

    const gridDataVar = resolveGridListDataVarName(gridNodeId);
    const apiRows = [
      { id: 'u-1', name: 'Alice', status: 'Active', active: true, created_at: '2026-01-01' },
      { id: 'u-2', name: 'Bob', status: 'Pending', active: false, created_at: '2026-02-01' },
    ];

    renderWithCulture(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData: { [gridDataVar]: apiRows },
        })}
      </>,
    );

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(document.querySelector('[data-designer-component="heroui.app-table-grid"]')).toBeTruthy();
  });

  it('keeps app table grid visible when a column becomes non-hideable', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'columns',
      value: JSON.stringify([
        { key: 'username', label: 'Username', sort: true, layoutHideable: false },
        { key: 'email', label: 'Email', sort: true, filter: true },
      ]),
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['username', 'email'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('users'),
    });

    const gridDataVar = resolveGridListDataVarName(gridNodeId);
    renderWithCulture(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData: {
            [gridDataVar]: [{ id: 'u-1', username: 'alice', email: 'alice@example.com' }],
          },
        })}
      </>,
    );

    expect(screen.getByText('alice')).toBeTruthy();
    expect(screen.getByText('alice@example.com')).toBeTruthy();
  });

  it('keeps app table grid stable when toggling active column hideable repeatedly', () => {
    const usersRows = [
      {
        id: 'u-1',
        name: 'Alice',
        status: 'Active',
        active: true,
        created_at: '2026-01-01',
      },
      {
        id: 'u-2',
        name: 'Bob',
        status: 'Pending',
        active: false,
        created_at: '2026-02-01',
      },
    ];

    const buildState = (layoutHideable: boolean) => {
      let state = createInitialDesignerState();
      state = designerReducer(state, {
        type: 'insert-palette-item',
        itemId: 'heroui.app-table-grid',
        parentId: state.document.rootNodeId,
      });
      const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

      const columns = DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS.map((column) => (
        column.key === 'active'
          ? { ...column, layoutHideable }
          : column
      ));

      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId: gridNodeId,
        key: 'columns',
        value: serializeDesignerDataGridColumns(columns),
      });

      state = designerReducer(state, {
        type: 'set-data-source',
        dataSourceId: 'users',
        dataSource: {
          id: 'users',
          name: 'Users',
          endpoint: '/api/users',
          fields: ['id', 'username', 'email', 'active', 'created_at'],
        },
      });

      state = designerReducer(state, {
        type: 'set-node-binding',
        nodeId: gridNodeId,
        bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
        definition: createGridListResourceBindingDefinition('users'),
      });

      return { state, gridNodeId };
    };

    const ToggleHarness: React.FC = () => {
      const [layoutHideable, setLayoutHideable] = React.useState(true);
      const { state } = React.useMemo(() => buildState(layoutHideable), [layoutHideable]);
      const gridDataVar = resolveGridListDataVarName(
        state.document.nodes[state.document.rootNodeId].children[0]!,
      );

      return (
        <>
          <button type="button" onClick={() => setLayoutHideable((current) => !current)}>
            Toggle hideable
          </button>
          {renderDesignerDocumentPreview(state.document, {
            bindingDefinitions: state.bindingDefinitions,
            hydrationData: { [gridDataVar]: usersRows },
          })}
        </>
      );
    };

    renderWithCulture(<ToggleHarness />);

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(document.querySelector('[data-designer-component="heroui.app-table-grid"]')).toBeTruthy();

    for (let index = 0; index < 6; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Toggle hideable' }));
    }

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(document.querySelector('[data-designer-component="heroui.app-table-grid"]')).toBeTruthy();
  });

  it('renders app table grid runtime directly after hideable toggles without crashing', () => {
    const buildNode = (layoutHideable: boolean): DesignerNode => ({
      id: 'grid-node',
      type: 'container',
      parentId: null,
      order: 0,
      layout: {},
      props: {
        [DESIGNER_PALETTE_ITEM_ID_PROP]: APP_TABLE_GRID_PALETTE_ITEM_ID,
        columns: serializeDesignerDataGridColumns(
          DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS.map((column) => (
            column.key === 'active'
              ? { ...column, layoutHideable }
              : column
          )),
        ),
        gridQueryMode: 'server',
        pageSize: 50,
        presentation: 'auto',
        enableColumnLayout: true,
      },
      children: [],
      binding: {},
    });

    const rows = [
      { id: 'u-1', name: 'Alice', status: 'Active', active: true, created_at: '2026-01-01' },
      { id: 'u-2', name: 'Bob', status: 'Pending', active: false, created_at: '2026-02-01' },
    ];

    const DirectHarness: React.FC = () => {
      const [layoutHideable, setLayoutHideable] = React.useState(true);
      const node = React.useMemo(() => buildNode(layoutHideable), [layoutHideable]);

      return (
        <>
          <button type="button" onClick={() => setLayoutHideable((current) => !current)}>
            Toggle active hideable
          </button>
          <DesignerRuntimeAppTableGrid
            node={node}
            options={{
              mode: 'design',
              gridListBound: true,
              gridRows: rows,
            }}
          />
        </>
      );
    };

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithCulture(<DirectHarness />);

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();

    for (let index = 0; index < 8; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Toggle active hideable' }));
    }

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('renders action group icons for app table grid', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'columns',
      value: serializeDesignerDataGridColumns([
        { key: 'name', label: 'Name', sort: true },
        {
          key: 'actions',
          label: '',
          kind: 'action-group',
          width: '140px',
          layoutHideable: false,
          cardRole: 'actions',
          actions: [
            { actionId: 'edit-attributes', icon: 'Tags', intent: 'edit', tooltip: 'Edit Attributes' },
            { actionId: 'delete', icon: 'Trash2', intent: 'delete', tooltip: 'Delete' },
          ],
        },
      ]),
    });

    renderWithCulture(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData: {},
        })}
      </>,
    );

    expect(screen.getAllByLabelText('Edit Attributes').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Delete').length).toBeGreaterThan(0);
  });

  it('opens the target dialog when clicking an app table grid action-group button in interactive preview', async () => {
    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.app-table-grid', state.document.rootNodeId);
    state = gridInsert.state;
    const dialogInsert = insertNode(state, 'heroui.alert-dialog', state.document.rootNodeId);
    state = dialogInsert.state;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: dialogInsert.nodeId,
      key: 'title',
      value: 'Delete content?',
    });

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridInsert.nodeId,
      key: 'columns',
      value: serializeDesignerDataGridColumns([
        { key: 'title', label: 'Title', sort: true },
        {
          key: 'actions',
          label: '',
          kind: 'action-group',
          width: '140px',
          layoutHideable: false,
          cardRole: 'actions',
          actions: [
            {
              actionId: 'delete',
              icon: 'Trash2',
              intent: 'delete',
              tooltip: 'Delete',
              behavior: {
                kind: 'open-modal',
                modalNodeId: dialogInsert.nodeId,
                primaryKeyField: 'id',
                selectionStorePath: 'selection.id',
              },
            },
          ],
        },
      ]),
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'contents',
      dataSource: {
        id: 'contents',
        name: 'Contents',
        endpoint: '/api/contents',
        fields: ['id', 'title'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridInsert.nodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('contents'),
    });

    state = designerReducer(state, {
      type: 'set-store-segment',
      segmentId: 'selection',
      segment: { id: 'selection', initialValue: { id: null } },
    });

    const gridDataVar = resolveGridListDataVarName(gridInsert.nodeId);

    const PreviewHarness: React.FC = () => {
      const [designerStore, setDesignerStore] = React.useState(() =>
        buildPreviewDesignerStore(state.bindingDefinitions),
      );

      return (
        <>
          {renderDesignerDocumentPreview(state.document, {
            bindingDefinitions: state.bindingDefinitions,
            designerStore,
            onStoreChange: setDesignerStore,
            hydrationData: { [gridDataVar]: [{ id: 42, title: 'Welcome to CMS' }] },
            interactive: true,
          })}
        </>
      );
    };

    renderWithCulture(<PreviewHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeTruthy();
      expect(screen.getByText('Delete content?')).toBeTruthy();
    });
  });

  it('renders users-style rich cells in app table grid preview', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'columns',
      value: serializeDesignerDataGridColumns([
        {
          key: 'image',
          label: '',
          cellKind: 'avatar',
          cellFields: { imageUrlField: 'avatar_url', fallbackTextField: 'username' },
        },
        {
          key: 'email',
          label: 'Account',
          cellKind: 'account',
          cellFields: { primaryField: 'email', secondaryField: 'username', badgeField: 'is_builtin' },
        },
        {
          key: 'roles',
          label: 'Roles',
          cellKind: 'chips',
          cellFields: { valuesField: 'roles' },
        },
        {
          key: 'created_at',
          label: 'Created',
          cellKind: 'audit',
          cellFields: {
            dateField: 'created_at',
            actorUsernameField: 'created_by_username',
            actorIdField: 'created_by',
          },
        },
      ]),
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('users'),
    });

    const gridDataVar = resolveGridListDataVarName(gridNodeId);
    renderWithCulture(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData: {
            [gridDataVar]: [{
              id: 'u-1',
              username: 'alice',
              email: 'alice@example.com',
              is_builtin: true,
              roles: ['ADMIN', 'DEVELOPER'],
              created_at: '2026-01-15',
              created_by_username: 'system',
            }],
          },
        })}
      </>,
    );

    expect(screen.getByText('alice@example.com')).toBeTruthy();
    expect(screen.getByText('alice')).toBeTruthy();
    expect(screen.getByText('ADMIN')).toBeTruthy();
    expect(screen.getByText('DEVELOPER')).toBeTruthy();
    expect(screen.getByText('system')).toBeTruthy();
    expect(screen.getByLabelText('Built-in user')).toBeTruthy();
  });

  it('renders a flush users-style page toolbar when toolbar config is enabled', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridNodeId,
      key: 'toolbarConfig',
      value: JSON.stringify({
        enabled: true,
        search: { enabled: true, placeholder: 'users…' },
        roleFilters: { enabled: true, roles: ['ADMIN', 'USER'] },
        refresh: { enabled: true },
      }),
    });

    renderWithCulture(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData: {},
        })}
      </>,
    );

    expect(screen.getByPlaceholderText('users…')).toBeTruthy();
    expect(screen.getByText('ADMIN')).toBeTruthy();
    expect(screen.getByText('USER')).toBeTruthy();
    const gridShell = document.querySelector('[data-designer-component="heroui.app-table-grid"]');
    expect(gridShell?.querySelector(':scope > .mb-2')).toBeNull();
  });
});
