import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  resolveOutlineComponentLabel,
  resolveOutlineNodeDetail,
  resolveOutlineNodeDisplay,
  resolveOutlinePrimaryLabel,
} from '../outlineNodeDisplay';
import { createGridListResourceBindingDefinition, GRID_LIST_RESOURCE_BINDING_KEY } from '../bindingGridEngine';
import { createRegionDataSourceBindingDefinition, REGION_DATA_SOURCE_BINDING_KEY } from '../bindingRegionEngine';

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

describe('outlineNodeDisplay', () => {
  it('uses palette label as component name for toolbox items', () => {
    let state = createInitialDesignerState();
    const inserted = insertNode(state, 'heroui.input-text', state.document.rootNodeId);
    const node = inserted.state.document.nodes[inserted.nodeId]!;

    expect(resolveOutlineComponentLabel(node)).toBe('Text Input');
  });

  it('shows input label in detail and palette name as component', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;
    const inputInsert = insertNode(state, 'heroui.input-text', formInsert.nodeId);
    state = designerReducer(inputInsert.state, {
      type: 'set-node-prop',
      nodeId: inputInsert.nodeId,
      key: 'label',
      value: 'Title',
    });

    const node = state.document.nodes[inputInsert.nodeId]!;
    expect(resolveOutlineNodeDisplay(node, state.bindingDefinitions)).toEqual({
      componentLabel: 'Text Input',
      detail: 'Title',
    });
    expect(resolveOutlinePrimaryLabel(node, state.bindingDefinitions)).toBe('Title');
  });

  it('shows grid column count and connected resource in detail', () => {
    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
    state = gridInsert.state;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'base-info',
      dataSource: {
        id: 'base-info',
        name: 'Base Info',
        endpoint: '/api/base-info',
        fields: ['title'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridInsert.nodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('base-info'),
    });

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridInsert.nodeId,
      key: 'columns',
      value: JSON.stringify([
        { key: 'title', label: 'Title', sort: true },
        { key: 'short_name', label: 'Short Name', sort: true },
      ]),
    });

    const node = state.document.nodes[gridInsert.nodeId]!;
    expect(resolveOutlineNodeDetail(node, state.bindingDefinitions)).toBe('2 columns · Base Info');
    expect(resolveOutlineComponentLabel(node)).toBe('Data Grid');
  });

  it('shows form data source in detail when region is connected', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'base-info',
      dataSource: {
        id: 'base-info',
        name: 'Base Info',
        endpoint: '/api/base-info',
        fields: ['title'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formInsert.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('base-info'),
    });

    const node = state.document.nodes[formInsert.nodeId]!;
    expect(resolveOutlineNodeDetail(node, state.bindingDefinitions)).toBe('Base Info');
    expect(resolveOutlineComponentLabel(node)).toBe('Form');
  });
});
