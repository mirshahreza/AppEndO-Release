import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  buildVizBindingWizardActions,
  collectDocumentVizPlan,
  getNodeVizDataResourceRef,
  isNonChartVizNode,
  resolveVizListDataVarName,
  VIZ_DATA_RESOURCE_BINDING_KEY,
} from '../bindingVizEngine';
import { collectDocumentBindingPlan } from '../bindingEngine';
import {
  transformApiRowsToKanbanBoard,
  transformApiRowsToSheetData,
  transformApiRowsToTimelineEvents,
  transformApiRowsToTreeNodes,
  buildDefaultVizFieldMapping,
  type DesignerVizTimelineFieldMapping,
  type DesignerVizTreeFieldMapping,
} from '../visualizationDataTransform';

const insertNode = (state: ReturnType<typeof createInitialDesignerState>, itemId: string, parentId: string) => {
  const next = designerReducer(state, { type: 'insert-palette-item', itemId, parentId });
  const parent = next.document.nodes[parentId];
  const childId = parent.children[parent.children.length - 1];
  return { state: next, nodeId: childId };
};

describe('visualizationDataTransform', () => {
  it('builds tree nodes from flat rows with parentId', () => {
    const mapping = buildDefaultVizFieldMapping('tree', ['id', 'label', 'parentId']) as DesignerVizTreeFieldMapping;
    mapping.parentIdField = 'parentId';
    const nodes = transformApiRowsToTreeNodes([
      { id: 'root', label: 'Root', parentId: '' },
      { id: 'child', label: 'Child', parentId: 'root' },
    ], mapping);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.children).toHaveLength(1);
  });

  it('transforms timeline and kanban rows', () => {
    const timeline = transformApiRowsToTimelineEvents([
      { title: 'Kickoff', start: '2026-01-01', end: '2026-01-02' },
    ], buildDefaultVizFieldMapping('timeline', ['title', 'start', 'end']) as DesignerVizTimelineFieldMapping);

    expect(timeline[0]?.title).toBe('Kickoff');

    const board = transformApiRowsToKanbanBoard([
      { id: '1', title: 'Task A', status: 'todo' },
      { id: '2', title: 'Task B', status: 'done' },
    ], {
      kind: 'kanban',
      cardIdField: 'id',
      cardTitleField: 'title',
      cardColumnField: 'status',
    });

    expect(board.columns.length).toBeGreaterThan(0);
  });

  it('transforms sheet rows', () => {
    const sheet = transformApiRowsToSheetData([
      { name: 'Coffee', qty: '10' },
    ], {
      kind: 'sheet',
      columns: [{ header: 'Product', field: 'name', type: 'text' }, { header: 'Qty', field: 'qty', type: 'number' }],
    });

    expect(sheet.columns).toEqual([
      { key: 'name', header: 'Product', type: 'text' },
      { key: 'qty', header: 'Qty', type: 'number' },
    ]);
    expect(sheet.rows[0]).toEqual({ name: 'Coffee', qty: '10' });
  });
});

describe('bindingVizEngine', () => {
  it('detects non-chart viz nodes and collects viz plan', () => {
    let state = createInitialDesignerState();
    const kanbanInsert = insertNode(state, 'viz.kanban', state.document.rootNodeId);
    state = kanbanInsert.state;

    const node = state.document.nodes[kanbanInsert.nodeId]!;
    expect(isNonChartVizNode(node)).toBe(true);
    expect(resolveVizListDataVarName(kanbanInsert.nodeId)).toMatch(/^vizData_/);

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'tasks',
      dataSource: {
        id: 'tasks',
        name: 'Tasks',
        endpoint: '/api/tasks',
        fields: ['id', 'title', 'status'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/tasks' } },
      },
    });

    for (const action of buildVizBindingWizardActions(node, state.bindingDefinitions.dataSources.tasks!)) {
      state = designerReducer(state, action);
    }

    expect(getNodeVizDataResourceRef(state.document.nodes[kanbanInsert.nodeId]!)).toBe('tasks');

    const vizPlan = collectDocumentVizPlan(state.document, state.bindingDefinitions);
    expect(vizPlan.vizListFetches).toHaveLength(1);
    expect(vizPlan.vizListFetches[0]?.widgetKind).toBe('kanban');

    const bindingPlan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    expect(bindingPlan.vizPlan.vizListFetches).toHaveLength(1);
    expect(VIZ_DATA_RESOURCE_BINDING_KEY).toBe('vizDataResource');
  });
});
