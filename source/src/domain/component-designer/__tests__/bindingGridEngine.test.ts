import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  buildGridBindingWizardActions,
  collectDocumentGridPlan,
  createGridListResourceBindingDefinition,
  GRID_LIST_RESOURCE_BINDING_KEY,
  resolveGridListDataVarName,
} from '../bindingGridEngine';
import { DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON, parseDesignerDataGridColumns } from '../designerDataGridColumns';
import { collectDocumentBindingPlan } from '../bindingEngine';

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

describe('bindingGridEngine', () => {
  it('collects grid list fetch plan when data grid is bound to a resource', () => {
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

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridInsert.nodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('products'),
    });

    const gridPlan = collectDocumentGridPlan(state.document, state.bindingDefinitions);
    expect(gridPlan.gridListFetches).toHaveLength(1);
    expect(gridPlan.gridListFetches[0]?.nodeId).toBe(gridInsert.nodeId);
    expect(gridPlan.gridListFetches[0]?.dataVar).toBe(resolveGridListDataVarName(gridInsert.nodeId));
    expect(gridPlan.gridListFetches[0]?.fetchConfig.endpointTemplate).toBe('/api/products');

    const bindingPlan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    expect(bindingPlan.gridPlan.gridListFetches).toHaveLength(1);
  });

  it('builds grid connect actions from wizard-selected columns', () => {
    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
    state = gridInsert.state;

    const gridNode = state.document.nodes[gridInsert.nodeId]!;
    expect(gridNode.props.columns).toBe(DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON);

    const dataSource = {
      id: 'contact-messages',
      name: 'Contact messages',
      endpoint: '/api/contact/messages',
      primaryKey: 'id',
      fields: ['id', 'topic_label', 'title', 'note', 'created_at'],
    };

    const actions = buildGridBindingWizardActions(gridNode, dataSource, {
      columns: [
        { key: 'id', label: 'ID', sort: true },
        { key: 'title', label: 'Title', sort: true },
      ],
    });
    for (const action of actions) {
      state = designerReducer(state, action as Parameters<typeof designerReducer>[1]);
    }

    const columns = parseDesignerDataGridColumns(state.document.nodes[gridInsert.nodeId]!.props.columns);
    expect(columns.map((column) => column.key)).toEqual([
      'id',
      'title',
    ]);
  });

  it('builds grid connect actions that auto-generate columns from API fields', () => {
    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
    state = gridInsert.state;

    const gridNode = state.document.nodes[gridInsert.nodeId]!;
    const dataSource = {
      id: 'contact-messages',
      name: 'Contact messages',
      endpoint: '/api/contact/messages',
      primaryKey: 'id',
      fields: ['id', 'topic_label', 'title', 'note', 'created_at'],
    };

    const actions = buildGridBindingWizardActions(gridNode, dataSource);
    for (const action of actions) {
      state = designerReducer(state, action as Parameters<typeof designerReducer>[1]);
    }

    const columns = parseDesignerDataGridColumns(state.document.nodes[gridInsert.nodeId]!.props.columns);
    expect(columns.map((column) => column.key)).toEqual([
      'id',
      'topic_label',
      'title',
      'note',
      'created_at',
    ]);
  });
});
