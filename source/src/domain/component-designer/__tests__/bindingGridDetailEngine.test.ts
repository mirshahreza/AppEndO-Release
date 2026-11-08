import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  GRID_DETAIL_FLOW_BINDING_KEY,
  buildGridDetailWizardActions,
  collectDocumentGridDetailFlows,
  createGridDetailFlowBindingDefinition,
  ensureGridDetailActionColumn,
  findFormRegionInside,
  parseGridDetailFlowConfig,
  validateDetailDataSourceForGridFlow,
} from '../bindingGridDetailEngine';
import { createGridListResourceBindingDefinition, GRID_LIST_RESOURCE_BINDING_KEY } from '../bindingGridEngine';
import { generateDesignerTsx } from '../codegen';
import { parseDesignerDataGridColumns, serializeDesignerDataGridColumns } from '../designerDataGridColumns';

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

describe('bindingGridDetailEngine', () => {
  it('parses grid detail flow binding and ensures action column', () => {
    const columns = ensureGridDetailActionColumn(
      [{ key: 'title', label: 'Title', sort: true }],
      'Details',
    );
    expect(columns.some((column) => column.kind === 'action')).toBe(true);

    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
    state = gridInsert.state;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridInsert.nodeId,
      bindingKey: GRID_DETAIL_FLOW_BINDING_KEY,
      definition: createGridDetailFlowBindingDefinition({
        primaryKeyField: 'id',
        selectionStorePath: 'selection.id',
        detailDataSourceRef: 'contact-messages',
        detailModalNodeId: 'modal-1',
        detailRegionNodeId: 'form-1',
        rowActionId: 'details',
        rowActionLabel: 'Details',
      }),
    });

    const config = parseGridDetailFlowConfig(state.document.nodes[gridInsert.nodeId]!);
    expect(config?.detailDataSourceRef).toBe('contact-messages');
  });

  it('collects detail flow plan and generates row action handler in TSX', () => {
    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
    state = gridInsert.state;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'contact-messages',
      dataSource: {
        id: 'contact-messages',
        name: 'Contact messages',
        endpoint: '/api/contact/messages',
        primaryKey: 'id',
        fields: ['id', 'title', 'note'],
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
        detailModalNodeId: 'modal-1',
        detailRegionNodeId: 'form-1',
        rowActionId: 'details',
        rowActionLabel: 'Details',
      }),
    });

    const flows = collectDocumentGridDetailFlows(state.document, state.bindingDefinitions);
    expect(flows).toHaveLength(1);
    expect(flows[0]?.handlerName).toContain('handleGridRowAction_');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain(flows[0]!.handlerName);
    expect(tsx).toContain('selection.id');
    expect(tsx).toContain('ui.visibility.modal-1');
  });

  it('builds wizard actions that add action column and store segment', () => {
    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
    const modalInsert = insertNode(gridInsert.state, 'heroui.modal', state.document.rootNodeId);
    const formInsert = insertNode(modalInsert.state, 'html.form', modalInsert.nodeId);
    state = formInsert.state;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridInsert.nodeId,
      key: 'columns',
      value: serializeDesignerDataGridColumns([{ key: 'title', label: 'Title', sort: true }]),
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridInsert.nodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('messages'),
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'messages',
      dataSource: {
        id: 'messages',
        name: 'Messages',
        endpoint: '/api/contact/messages',
        primaryKey: 'id',
        fields: ['id', 'title', 'note', 'topic_label'],
        operations: {
          detail: { method: 'GET', endpoint: '/api/contact/messages/:id' },
        },
      },
    });

    const actions = buildGridDetailWizardActions(state.document, state.bindingDefinitions, {
      gridNodeId: gridInsert.nodeId,
      detailDataSourceId: 'messages',
      detailDataSource: state.bindingDefinitions.dataSources.messages!,
      detailModalNodeId: modalInsert.nodeId,
      detailRegionNodeId: formInsert.nodeId,
      primaryKeyField: 'id',
      rowActionLabel: 'Details',
      detailDisplayColumns: ['title', 'note'],
    });

    for (const action of actions) {
      state = designerReducer(state, action as Parameters<typeof designerReducer>[1]);
    }

    const columns = parseDesignerDataGridColumns(state.document.nodes[gridInsert.nodeId]!.props.columns);
    expect(columns.some((column) => column.kind === 'action')).toBe(true);
    expect(state.bindingDefinitions.storeSegments.selection).toBeDefined();
    expect(parseGridDetailFlowConfig(state.document.nodes[gridInsert.nodeId]!)).not.toBeNull();
  });

  it('auto-provisions a detail form inside the modal when none exists', () => {
    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
    const modalInsert = insertNode(gridInsert.state, 'heroui.modal', state.document.rootNodeId);
    state = modalInsert.state;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridInsert.nodeId,
      key: 'columns',
      value: serializeDesignerDataGridColumns([{ key: 'title', label: 'Title', sort: true }]),
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridInsert.nodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('messages'),
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'messages',
      dataSource: {
        id: 'messages',
        name: 'Messages',
        endpoint: '/api/contact/messages',
        primaryKey: 'id',
        fields: ['id', 'title', 'note', 'topic_label'],
        operations: {
          detail: { method: 'GET', endpoint: '/api/contact/messages/:id' },
        },
      },
    });

    const actions = buildGridDetailWizardActions(state.document, state.bindingDefinitions, {
      gridNodeId: gridInsert.nodeId,
      detailDataSourceId: 'messages',
      detailDataSource: state.bindingDefinitions.dataSources.messages!,
      detailModalNodeId: modalInsert.nodeId,
      detailRegionNodeId: '',
      primaryKeyField: 'id',
      rowActionLabel: 'Details',
      detailDisplayColumns: ['title', 'note'],
    });

    expect(actions.some((action) => action.type === 'hydrate-document')).toBe(true);

    for (const action of actions) {
      state = designerReducer(state, action as Parameters<typeof designerReducer>[1]);
    }

    const formId = findFormRegionInside(state.document, modalInsert.nodeId);
    expect(formId).toBeTruthy();
    expect(parseGridDetailFlowConfig(state.document.nodes[gridInsert.nodeId]!)).not.toBeNull();
  });

  it('rejects list-only endpoints for detail flow validation', () => {
    const message = validateDetailDataSourceForGridFlow({
      id: 'base-contact-messages-v',
      name: 'Base Contact Messages V',
      endpoint: '/api/base-contact-messages-v',
      primaryKey: 'id',
      fields: ['id', 'title', 'note'],
      operations: {
        list: { method: 'GET', endpoint: '/api/base-contact-messages-v' },
      },
    });

    expect(message).toMatch(/GET-one route with :id/);
  });
});
