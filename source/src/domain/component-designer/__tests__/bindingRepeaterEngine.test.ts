import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  buildRepeaterBindingWizardActions,
  collectDocumentRepeaterPlan,
  createRepeaterListResourceBindingDefinition,
  REPEATER_LIST_RESOURCE_BINDING_KEY,
  resolveRepeaterListDataVarName,
} from '../bindingRepeaterEngine';
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

describe('bindingRepeaterEngine', () => {
  it('collects repeater list fetch plan when logic.repeater is bound to a resource', () => {
    let state = createInitialDesignerState();
    const repeaterInsert = insertNode(state, 'logic.repeater', state.document.rootNodeId);
    state = repeaterInsert.state;

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
      nodeId: repeaterInsert.nodeId,
      bindingKey: REPEATER_LIST_RESOURCE_BINDING_KEY,
      definition: createRepeaterListResourceBindingDefinition('products'),
    });

    const repeaterPlan = collectDocumentRepeaterPlan(state.document, state.bindingDefinitions);
    expect(repeaterPlan.repeaterListFetches).toHaveLength(1);
    expect(repeaterPlan.repeaterListFetches[0]?.nodeId).toBe(repeaterInsert.nodeId);
    expect(repeaterPlan.repeaterListFetches[0]?.dataVar).toBe(resolveRepeaterListDataVarName(repeaterInsert.nodeId));
    expect(repeaterPlan.repeaterListFetches[0]?.fetchConfig.endpointTemplate).toBe('/api/products');

    const bindingPlan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    expect(bindingPlan.repeaterPlan.repeaterListFetches).toHaveLength(1);
  });

  it('buildRepeaterBindingWizardActions sets binding and dataPath', () => {
    let state = createInitialDesignerState();
    const repeaterInsert = insertNode(state, 'logic.repeater', state.document.rootNodeId);
    state = repeaterInsert.state;
    const node = state.document.nodes[repeaterInsert.nodeId]!;

    const dataSource = {
      id: 'orders',
      name: 'Orders',
      endpoint: '/api/orders',
      fields: ['id', 'total'],
    };

    const actions = buildRepeaterBindingWizardActions(node, dataSource);
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({
      type: 'set-node-binding',
      bindingKey: REPEATER_LIST_RESOURCE_BINDING_KEY,
    });
    expect(actions[1]).toMatchObject({
      type: 'set-node-prop',
      key: 'dataPath',
      value: resolveRepeaterListDataVarName(repeaterInsert.nodeId),
    });
  });
});
