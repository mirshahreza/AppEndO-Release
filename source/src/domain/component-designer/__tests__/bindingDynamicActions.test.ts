import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import {
  collectDocumentBindingPlan,
  createDynamicActionsEventBindingDefinition,
  eventBindingKeyForEvent,
} from '../bindingEngine';
import {
  createDynamicAction,
  defaultSetValueStorePathForNode,
  visibilityConditionForNode,
  visibilityStorePathForNode,
} from '../bindingDynamicActionsEngine';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderBindingComponentPreamble } from '../bindingCodegen';

describe('bindingDynamicActionsEngine', () => {
  it('generates refresh, set value, and show/hide handlers from trueActions AST', () => {
    let state = createInitialDesignerState();

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: state.document.rootNodeId,
    });
    const buttonId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'layout.stack',
      parentId: state.document.rootNodeId,
    });
    const panelId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['ID', 'NAME'],
      },
    });

    const refreshAction = createDynamicAction('refreshDataSource');
    refreshAction.dataSourceRef = 'users';
    const setValueAction = createDynamicAction('setValue');
    setValueAction.targetNodeId = buttonId;
    setValueAction.storePath = defaultSetValueStorePathForNode(buttonId);
    setValueAction.staticValue = 'clicked';
    const showHideAction = createDynamicAction('showHide');
    showHideAction.targetNodeId = panelId;
    showHideAction.showHideEffect = 'show';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [
        refreshAction,
        setValueAction,
        showHideAction,
      ]),
    });

    expect(state.document.nodes[panelId]?.layout.visibleCondition).toBeUndefined();

    const plan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    const clickBinding = plan.eventBindings.find((binding) => binding.nodeId === buttonId);
    expect(clickBinding?.trueActions).toHaveLength(3);

    const preamble = renderBindingComponentPreamble(state.document, state.bindingDefinitions);
    const preambleText = preamble.join('\n');
    expect(preambleText).toContain('refresh_regionData_users');
    expect(preambleText).toContain(`patchDesignerStore(${JSON.stringify(defaultSetValueStorePathForNode(buttonId))}, "clicked")`);
    expect(preambleText).toContain(`patchDesignerStore(${JSON.stringify(visibilityStorePathForNode(panelId))}, true)`);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('useDesignerStore');
    expect(tsx).toContain('useDataFetch');
    expect(tsx).toContain(visibilityConditionForNode(panelId));
  });
});
