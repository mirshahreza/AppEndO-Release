import { createInitialDesignerState, designerReducer } from '../state';
import {
  createPropertyBindingDefinition,
  createEventBindingDefinition,
  eventBindingKeyForEvent,
  propertyBindingKeyForProp,
  createDynamicActionsEventBindingDefinition,
} from '../bindingEngine';
import {
  REGION_DATA_SOURCE_BINDING_KEY,
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
} from '../bindingRegionEngine';
import {
  GRID_LIST_RESOURCE_BINDING_KEY,
  createGridListResourceBindingDefinition,
} from '../bindingGridEngine';
import {
  GRID_DETAIL_FLOW_BINDING_KEY,
  createGridDetailFlowBindingDefinition,
} from '../bindingGridDetailEngine';
import {
  CHART_DATA_RESOURCE_BINDING_KEY,
  buildDefaultChartFieldMapping,
  createChartDataResourceBindingDefinition,
  serializeDesignerChartFieldMapping,
} from '../bindingChartEngine';
import {
  VIZ_DATA_RESOURCE_BINDING_KEY,
  buildVizBindingWizardActions,
  createVizDataResourceBindingDefinition,
} from '../bindingVizEngine';
import {
  CONTENT_DATA_RESOURCE_BINDING_KEY,
  buildContentBindingConnectActions,
  buildContentDualModeEnableActions,
  createContentDataResourceBindingDefinition,
} from '../bindingContentEngine';
import {
  createDynamicAction,
  defaultSetValueStorePathForNode,
} from '../bindingDynamicActionsEngine';
import { createStoreReadBindingDefinition, storeBindingKeyForPath } from '../bindingStoreEngine';
import { createDefaultBindingDefinitions } from '../bindingRegistry';
import { serializeDesignerDataGridColumns } from '../designerDataGridColumns';
import type { DesignerState } from '../types';
import type { BindingParityFixture } from './types';
import { PALETTE_ITEMS_BY_BINDING_CAPABILITY } from './paletteItemsByCapability';

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const seedUsersDataSource = (state: DesignerState) =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'users',
    dataSource: {
      id: 'users',
      name: 'Users',
      endpoint: '/api/users',
      primaryKey: 'id',
      fields: ['id', 'firstName', 'email', 'status'],
      kind: 'record',
      operations: {
        list: { method: 'GET', endpoint: '/api/users' },
        detail: { method: 'GET', endpoint: '/api/users/:id' },
        create: { method: 'POST', endpoint: '/api/users' },
        update: { method: 'PUT', endpoint: '/api/users/:id' },
      },
    },
  });

const seedProductsDataSource = (state: DesignerState) =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'products',
    dataSource: {
      id: 'products',
      name: 'Products',
      endpoint: '/api/products',
      primaryKey: 'id',
      fields: ['id', 'name', 'qty', 'month', 'revenue', 'cost'],
      operations: {
        list: { method: 'GET', endpoint: '/api/products' },
      },
    },
  });

const seedKanbanDataSource = (state: DesignerState) =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'tasks',
    dataSource: {
      id: 'tasks',
      name: 'Tasks',
      endpoint: '/api/tasks',
      primaryKey: 'id',
      fields: ['id', 'title', 'status'],
      operations: {
        list: { method: 'GET', endpoint: '/api/tasks' },
      },
    },
  });

const seedPostsDataSource = (state: DesignerState) =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'posts',
    dataSource: {
      id: 'posts',
      name: 'Posts',
      endpoint: '/api/posts',
      primaryKey: 'id',
      fields: ['id', 'title', 'label', 'value'],
      operations: {
        list: { method: 'GET', endpoint: '/api/posts' },
      },
    },
  });

const buildRegionFixture = (): BindingParityFixture => {
  let state = createInitialDesignerState();
  state = insert(state, 'html.form');
  const formId = lastChild(state);
  state = seedUsersDataSource(state);
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: formId,
    bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
    definition: createRegionDataSourceBindingDefinition('users'),
  });
  state = insert(state, 'heroui.input-text', formId);
  const inputId = lastChild(state, formId);
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: inputId,
    bindingKey: propertyBindingKeyForProp('value'),
    definition: createRegionColumnBindingDefinition('value', 'firstName'),
  });

  return {
    capability: 'Region',
    id: 'region-form-column',
    description: 'Data region form with column-bound input value',
    state,
    nodeId: inputId,
    targetProp: 'value',
    mockApiPayload: { id: 42, firstName: 'Elena', email: 'elena@example.com', status: 'active' },
    paletteItems: PALETTE_ITEMS_BY_BINDING_CAPABILITY.Region,
  };
};

const buildGridFixture = (): BindingParityFixture => {
  let state = createInitialDesignerState();
  state = insert(state, 'heroui.data-grid');
  const gridId = lastChild(state);
  state = seedProductsDataSource(state);
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: gridId,
    key: 'columns',
    value: serializeDesignerDataGridColumns([
      { key: 'name', label: 'Name', sort: true },
      { key: 'qty', label: 'Qty', sort: true },
    ]),
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: gridId,
    bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
    definition: createGridListResourceBindingDefinition('products'),
  });

  return {
    capability: 'Grid',
    id: 'grid-list-resource',
    description: 'Data grid bound to list resource rows',
    state,
    nodeId: gridId,
    targetProp: 'rows',
    mockApiPayload: {
      items: [
        { id: 1, name: 'Widget A', qty: 10 },
        { id: 2, name: 'Widget B', qty: 5 },
      ],
    },
    paletteItems: PALETTE_ITEMS_BY_BINDING_CAPABILITY.Grid,
  };
};

const buildGridDetailFixture = (): BindingParityFixture => {
  let state = createInitialDesignerState();
  state = insert(state, 'heroui.data-grid');
  const gridId = lastChild(state);
  state = insert(state, 'heroui.modal');
  const modalId = lastChild(state);
  state = insert(state, 'html.form', modalId);
  const formId = lastChild(state, modalId);

  state = seedUsersDataSource(state);
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: gridId,
    bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
    definition: createGridListResourceBindingDefinition('users'),
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: gridId,
    bindingKey: GRID_DETAIL_FLOW_BINDING_KEY,
    definition: createGridDetailFlowBindingDefinition({
      primaryKeyField: 'id',
      selectionStorePath: 'selection.userId',
      detailDataSourceRef: 'users',
      detailModalNodeId: modalId,
      detailRegionNodeId: formId,
      rowActionId: 'details',
      rowActionLabel: 'Details',
    }),
  });

  return {
    capability: 'GridDetail',
    id: 'grid-detail-row-action',
    description: 'Grid list + detail modal flow store patches on row action',
    state,
    nodeId: gridId,
    mockApiPayload: { id: 7, firstName: 'Sam', email: 'sam@example.com' },
    paletteItems: PALETTE_ITEMS_BY_BINDING_CAPABILITY.GridDetail,
  };
};

const buildChartFixture = (): BindingParityFixture => {
  let state = createInitialDesignerState();
  state = insert(state, 'viz.chart-bar');
  const chartId = lastChild(state);
  state = seedProductsDataSource(state);

  const mapping = buildDefaultChartFieldMapping(['month', 'revenue', 'cost']);
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: chartId,
    key: 'chartFieldMapping',
    value: serializeDesignerChartFieldMapping(mapping),
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: chartId,
    bindingKey: CHART_DATA_RESOURCE_BINDING_KEY,
    definition: createChartDataResourceBindingDefinition('products'),
  });

  return {
    capability: 'Chart',
    id: 'chart-bar-resource',
    description: 'Bar chart data transform from list resource rows',
    state,
    nodeId: chartId,
    targetProp: 'data',
    mockApiPayload: [
      { month: 'Jan', revenue: 100, cost: 40 },
      { month: 'Feb', revenue: 150, cost: 55 },
    ],
    paletteItems: PALETTE_ITEMS_BY_BINDING_CAPABILITY.Chart,
  };
};

const buildVizFixture = (): BindingParityFixture => {
  let state = createInitialDesignerState();
  state = insert(state, 'viz.kanban');
  const kanbanId = lastChild(state);
  state = seedKanbanDataSource(state);

  const kanbanNode = state.document.nodes[kanbanId]!;
  for (const action of buildVizBindingWizardActions(kanbanNode, state.bindingDefinitions.dataSources.tasks!)) {
    state = designerReducer(state, action);
  }
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: kanbanId,
    bindingKey: VIZ_DATA_RESOURCE_BINDING_KEY,
    definition: createVizDataResourceBindingDefinition('tasks'),
  });

  return {
    capability: 'Viz',
    id: 'viz-kanban-resource',
    description: 'Kanban board transform from list resource rows',
    state,
    nodeId: kanbanId,
    targetProp: 'data',
    mockApiPayload: [
      { id: '1', title: 'Draft spec', status: 'todo' },
      { id: '2', title: 'Ship feature', status: 'done' },
    ],
    paletteItems: PALETTE_ITEMS_BY_BINDING_CAPABILITY.Viz,
  };
};

const buildStoreFixture = (): BindingParityFixture => {
  let state = createInitialDesignerState();
  state = insert(state, 'heroui.select');
  const selectId = lastChild(state);
  state = insert(state, 'heroui.data-grid');
  const gridId = lastChild(state);

  state = {
    ...state,
    bindingDefinitions: {
      ...createDefaultBindingDefinitions(),
      storeSegments: {
        selection: { id: 'selection', initialValue: { countryId: 'us' } },
        filters: { id: 'filters', initialValue: { countryId: 'us' } },
      },
    },
  };

  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: selectId,
    bindingKey: eventBindingKeyForEvent('onChange'),
    definition: {
      sourceType: 'store',
      bindingRole: 'event',
      targetEvent: 'onChange',
      storeWritePath: 'selection.countryId',
    },
  });

  const storeRead = createStoreReadBindingDefinition('rows', 'filters.countryId');
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: gridId,
    bindingKey: storeBindingKeyForPath('filters.countryId'),
    definition: storeRead.definition,
  });

  return {
    capability: 'Store',
    id: 'store-read-write',
    description: 'Store segment read expression for grid rows filter',
    state,
    nodeId: gridId,
    targetProp: 'rows',
    mockApiPayload: { filters: { countryId: 'de' } },
    paletteItems: PALETTE_ITEMS_BY_BINDING_CAPABILITY.Store,
  };
};

const buildContentFixture = (): BindingParityFixture => {
  let state = createInitialDesignerState();
  state = insert(state, 'content.stepper');
  const stepperId = lastChild(state);
  state = seedPostsDataSource(state);

  for (const action of buildContentDualModeEnableActions(stepperId)) {
    state = designerReducer(state, action);
  }
  for (const action of buildContentBindingConnectActions(
    state.document.nodes[stepperId]!,
    state.bindingDefinitions.dataSources.posts!,
  )) {
    state = designerReducer(state, action);
  }
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: stepperId,
    bindingKey: CONTENT_DATA_RESOURCE_BINDING_KEY,
    definition: createContentDataResourceBindingDefinition('posts'),
  });

  return {
    capability: 'Content',
    id: 'content-stepper-csv',
    description: 'Dual-mode stepper steps CSV from bound list rows',
    state,
    nodeId: stepperId,
    targetProp: 'steps',
    mockApiPayload: [
      { id: 1, title: 'Plan', label: 'Plan' },
      { id: 2, title: 'Build', label: 'Build' },
      { id: 3, title: 'Ship', label: 'Ship' },
    ],
    paletteItems: PALETTE_ITEMS_BY_BINDING_CAPABILITY.Content,
  };
};

const buildDynamicActionsFixture = (): BindingParityFixture => {
  let state = createInitialDesignerState();
  state = insert(state, 'heroui.button-solid');
  const buttonId = lastChild(state);
  state = insert(state, 'layout.stack-compact');
  const panelId = lastChild(state);
  state = seedUsersDataSource(state);

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

  return {
    capability: 'DynamicActions',
    id: 'dynamic-actions-click',
    description: 'Button onClick trueActions: setValue + showHide store patches',
    state,
    nodeId: buttonId,
    mockApiPayload: null,
    paletteItems: PALETTE_ITEMS_BY_BINDING_CAPABILITY.DynamicActions,
  };
};

const buildMutationFixture = (): BindingParityFixture => {
  let state = createInitialDesignerState();
  state = insert(state, 'html.form');
  const formId = lastChild(state);
  state = insert(state, 'heroui.input-text', formId);
  const inputId = lastChild(state, formId);
  state = insert(state, 'heroui.button-solid', formId);
  const buttonId = lastChild(state, formId);

  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: buttonId,
    key: 'type',
    value: 'submit',
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: formId,
    bindingKey: eventBindingKeyForEvent('onSubmit'),
    definition: createEventBindingDefinition('onSubmit', '/api/users', 'POST', {
      email: inputId,
      name: inputId,
    }),
  });

  return {
    capability: 'Mutation',
    id: 'form-submit-mutation',
    description: 'Form onSubmit mutation payload from field mappings',
    state,
    nodeId: formId,
    mockApiPayload: { email: 'user@example.com', name: 'User Name' },
    paletteItems: PALETTE_ITEMS_BY_BINDING_CAPABILITY.Mutation,
  };
};

const buildEntityPickerFixture = (): BindingParityFixture => {
  let state = createInitialDesignerState();
  state = insert(state, 'heroui.entity-picker');
  const pickerId = lastChild(state);
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: pickerId,
    key: 'entityRef',
    value: 'users',
  });
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: pickerId,
    key: 'searchParam',
    value: 'search',
  });

  return {
    capability: 'EntityPicker',
    id: 'entity-picker-search',
    description: 'Entity picker option normalization from search API payload',
    state,
    nodeId: pickerId,
    targetProp: 'items',
    mockApiPayload: {
      items: [
        { id: 'u1', name: 'Alice' },
        { id: 'u2', label: 'Bob' },
        { value: 'u3', textValue: 'Carol' },
      ],
    },
    paletteItems: PALETTE_ITEMS_BY_BINDING_CAPABILITY.EntityPicker,
  };
};

const buildLovFixture = (): BindingParityFixture => {
  let state = createInitialDesignerState();
  state = insert(state, 'heroui.select');
  const selectId = lastChild(state);

  state = {
    ...state,
    bindingDefinitions: {
      ...createDefaultBindingDefinitions(),
      lovs: {
        'parity-topics': {
          id: 'parity-topics',
          name: 'Parity Topics',
          endpoint: '/api/lov/parity-topics',
          returnValue: 'code',
          displayValue: 'title',
        },
      },
    },
  };

  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: selectId,
    bindingKey: propertyBindingKeyForProp('items'),
    definition: createPropertyBindingDefinition('items', 'lovData_parity_topics', {
      fetchEndpoint: '/api/lov/parity-topics',
      lovRef: 'parity-topics',
    }),
  });

  return {
    capability: 'LOV',
    id: 'lov-select-items',
    description: 'LOV-bound select items from API payload',
    state,
    nodeId: selectId,
    targetProp: 'items',
    mockApiPayload: {
      items: [
        { code: 'alpha', title: 'Alpha' },
        { code: 'beta', title: 'Beta' },
      ],
    },
    paletteItems: PALETTE_ITEMS_BY_BINDING_CAPABILITY.LOV,
  };
};

const FIXTURE_BUILDERS: Array<() => BindingParityFixture> = [
  buildRegionFixture,
  buildGridFixture,
  buildGridDetailFixture,
  buildChartFixture,
  buildVizFixture,
  buildStoreFixture,
  buildContentFixture,
  buildDynamicActionsFixture,
  buildMutationFixture,
  buildEntityPickerFixture,
  buildLovFixture,
];

/** All 11 binding parity fixtures (one per capability). */
export const buildAllBindingParityFixtures = (): BindingParityFixture[] =>
  FIXTURE_BUILDERS.map((build) => build());

export const buildBindingParityFixture = (capability: BindingParityFixture['capability']): BindingParityFixture => {
  const fixture = buildAllBindingParityFixtures().find((entry) => entry.capability === capability);
  if (!fixture) {
    throw new Error(`Missing binding parity fixture for capability: ${capability}`);
  }
  return fixture;
};
