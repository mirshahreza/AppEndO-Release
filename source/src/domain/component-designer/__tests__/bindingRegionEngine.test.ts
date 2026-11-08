import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { getPaletteItemById } from '../catalog';
import {
  collectDocumentRegionPlan,
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  createRegionSubmitEventBindingDefinition,
  findAncestorDataRegion,
  getNodeRegionDataSourceRef,
  isRegionDetailReadOnlyForm,
  regionColumnToExpression,
  resolveAncestorRegionDataVar,
  resolveRegionDataVarName,
  resolveRegionDmlMethodExpression,
  resolveRegionDmlUrlExpression,
  resolveRegionDmlUrlExpressionForPlan,
  resolveRegionSubmitPlanForEvent,
  REGION_DATA_SOURCE_BINDING_KEY,
} from '../bindingRegionEngine';
import { collectDocumentBindingPlan, eventBindingKeyForEvent, propertyBindingKeyForProp } from '../bindingEngine';
import { createTsxBindingRenderContext, renderBindingComponentPreamble, resolveNodePropertyBindingExpression } from '../bindingCodegen';

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

describe('bindingRegionEngine', () => {
  it('collects one region fetch per shared data source', () => {
    let state = createInitialDesignerState();
    const formItem = getPaletteItemById('html.form');
    expect(formItem).toBeTruthy();

    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;
    const formId = formInsert.nodeId;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users', { loadOperation: 'list' }),
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users/1',
        fields: ['FIRST_NAME', 'EMAIL'],
      },
    });

    const inputInsert = insertNode(state, 'heroui.input-text', formId);
    state = inputInsert.state;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputInsert.nodeId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createRegionColumnBindingDefinition('value', 'FIRST_NAME'),
    });

    const plan = collectDocumentRegionPlan(state.document, state.bindingDefinitions);

    expect(plan.regionFetches).toHaveLength(1);
    expect(plan.regionFetches[0]?.dataVar).toBe('regionData_users');
    expect(plan.regionFetches[0]?.dataSource.endpoint).toBe('/api/users/1');
    expect(plan.regionColumnBindings).toHaveLength(1);
    expect(plan.regionColumnBindings[0]?.column).toBe('FIRST_NAME');
    expect(getNodeRegionDataSourceRef(state.document.nodes[formId]!)).toBe('users');
    expect(findAncestorDataRegion(state.document, inputInsert.nodeId)?.dataSourceRef).toBe('users');
  });

  it('generates region column defaultValue expressions in TSX codegen', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formInsert.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users'),
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users/1',
        fields: ['FIRST_NAME'],
      },
    });

    const inputInsert = insertNode(state, 'heroui.input-text', formInsert.nodeId);
    state = inputInsert.state;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputInsert.nodeId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createRegionColumnBindingDefinition('value', 'FIRST_NAME'),
    });

    const context = createTsxBindingRenderContext(state.document, state.bindingDefinitions);
    const expression = resolveNodePropertyBindingExpression(inputInsert.nodeId, 'value', context);

    expect(expression).toBe(regionColumnToExpression('regionData_users', 'FIRST_NAME'));
  });

  it('resolves automatic region submit plan for button inside data region', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;
    const formId = formInsert.nodeId;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users'),
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        primaryKey: 'ID',
        fields: ['ID', 'FIRST_NAME', 'EMAIL'],
      },
    });

    const inputInsert = insertNode(state, 'heroui.input-text', formId);
    state = inputInsert.state;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputInsert.nodeId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createRegionColumnBindingDefinition('value', 'FIRST_NAME'),
    });

    const buttonInsert = insertNode(state, 'heroui.button-solid', formId);
    state = buttonInsert.state;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonInsert.nodeId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createRegionSubmitEventBindingDefinition('onClick'),
    });

    const plan = resolveRegionSubmitPlanForEvent(state.document, buttonInsert.nodeId, state.bindingDefinitions);
    expect(plan?.endpoint).toBe('/api/users');
    expect(plan?.primaryKey).toBe('ID');
    expect(plan?.fieldMappings).toEqual([
      {
        nodeId: inputInsert.nodeId,
        column: 'FIRST_NAME',
        formFieldName: inputInsert.nodeId,
      },
    ]);

    const bindingPlan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    const clickBinding = bindingPlan.eventBindings.find(
      (binding) => binding.nodeId === buttonInsert.nodeId && binding.targetEvent === 'onClick',
    );
    expect(clickBinding?.regionSubmitPlan?.fieldMappings).toHaveLength(1);

    const preamble = renderBindingComponentPreamble(state.document, state.bindingDefinitions);
    const preambleText = preamble.join('\n');
    expect(preambleText).toContain(`payload[${JSON.stringify('FIRST_NAME')}] = formData.get(${JSON.stringify(inputInsert.nodeId)})`);
    expect(preambleText).toContain(resolveRegionDmlMethodExpression('regionData_users', 'ID'));
    // The data source here has no explicit `operations`, so dataSourceToResource synthesizes a
    // REST-conventional default update endpoint (`/api/users/:ID`) rather than the bare base
    // endpoint (`/api/users`) — this is what resolveRegionDmlUrlExpressionForPlan now correctly
    // uses (see its bug-fix comment), matching the already-correct live Preview behavior.
    expect(preambleText).toContain(resolveRegionDmlUrlExpression('regionData_users', '/api/users/:ID', 'ID'));
    expect(preambleText).toContain('const method =');
    expect(preambleText).toContain('const url =');
    expect(preambleText).toContain('collectRegionFormDataFromContainer(regionRoot');
    expect(preambleText).toContain('[data-designer-node-id=');
  });

  it('resolves ancestor region data vars with per-region suffix when needed', () => {
    let state = createInitialDesignerState();
    const formA = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formA.state;
    const formB = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formB.state;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formA.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users'),
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formB.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users'),
    });

    const inputA = insertNode(state, 'heroui.input-text', formA.nodeId);
    state = inputA.state;
    const inputB = insertNode(state, 'heroui.input-text', formB.nodeId);
    state = inputB.state;

    const ancestorA = findAncestorDataRegion(state.document, inputA.nodeId);
    const ancestorB = findAncestorDataRegion(state.document, inputB.nodeId);
    expect(ancestorA).toBeTruthy();
    expect(ancestorB).toBeTruthy();

    expect(resolveAncestorRegionDataVar(state.document, ancestorA!)).toBe(
      resolveRegionDataVarName('users', formA.nodeId, 2),
    );
    expect(resolveAncestorRegionDataVar(state.document, ancestorB!)).toBe(
      resolveRegionDataVarName('users', formB.nodeId, 2),
    );
  });

  it('treats detail regions without submit as read-only and create/edit regions as editable', () => {
    let state = createInitialDesignerState();
    const detailForm = insertNode(state, 'html.form', state.document.rootNodeId);
    state = detailForm.state;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: detailForm.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users', { loadOperation: 'detail', urlParams: { id: 'selection.id' } }),
    });
    const detailInput = insertNode(state, 'heroui.input-text', detailForm.nodeId);
    state = detailInput.state;

    const createForm = insertNode(state, 'html.form', state.document.rootNodeId);
    state = createForm.state;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: createForm.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users'),
    });
    const createInput = insertNode(state, 'heroui.input-text', createForm.nodeId);
    state = createInput.state;
    const saveButton = insertNode(state, 'heroui.button-solid', createForm.nodeId);
    state = saveButton.state;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: saveButton.nodeId,
      bindingKey: 'event:onClick',
      definition: createRegionSubmitEventBindingDefinition('onClick'),
    });

    expect(isRegionDetailReadOnlyForm(state.document, detailInput.nodeId)).toBe(true);
    expect(isRegionDetailReadOnlyForm(state.document, createInput.nodeId)).toBe(false);
  });

  it('treats detail regions as editable when Save lives in modal footer (not under the form)', () => {
    let state = createInitialDesignerState();
    const modalInsert = insertNode(state, 'heroui.modal', state.document.rootNodeId);
    state = modalInsert.state;
    const detailForm = insertNode(state, 'html.form', modalInsert.nodeId);
    state = detailForm.state;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: detailForm.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users', {
        loadOperation: 'detail',
        urlParams: { id: 'selection.id' },
      }),
    });
    const detailInput = insertNode(state, 'heroui.input-text', detailForm.nodeId);
    state = detailInput.state;
    const footerInsert = insertNode(state, 'layout.flex-row', modalInsert.nodeId);
    state = footerInsert.state;
    const saveButton = insertNode(state, 'heroui.button-solid', footerInsert.nodeId);
    state = saveButton.state;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: saveButton.nodeId,
      bindingKey: 'event:onClick',
      definition: createRegionSubmitEventBindingDefinition('onClick'),
    });

    expect(isRegionDetailReadOnlyForm(state.document, detailInput.nodeId)).toBe(false);
  });

  it('skips region fetch for create-only collection data sources', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formInsert.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('sum-two-numbers'),
    });

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'sum-two-numbers',
      dataSource: {
        id: 'sum-two-numbers',
        name: 'sum-two-numbers',
        endpoint: '/api/math/sum-two-numbers',
        fields: ['a', 'b', 'sum'],
        kind: 'collection',
        operations: {
          create: { method: 'POST', endpoint: '/api/math/sum-two-numbers' },
        },
      },
    });

    const plan = collectDocumentRegionPlan(state.document, state.bindingDefinitions);
    expect(plan.regionFetches).toHaveLength(0);
  });
});

describe('resolveRegionDmlUrlExpressionForPlan (Export codegen URL selection)', () => {
  // Bug found while building a full document end-to-end: this used `plan.endpoint` (the base
  // collection endpoint, e.g. /api/users) for the UPDATE branch instead of `plan.updateEndpoint`
  // (e.g. /api/users/:id/profile, or a Phase-24 named-operation override like
  // /api/users/:id/change-password) — any form whose real update endpoint differs from the base
  // endpoint silently exported the wrong submit URL. The live Preview path
  // (bindingMutationRuntime.ts, `plan.updateEndpoint ?? plan.endpoint`) already did this
  // correctly; Export just didn't match it.
  it('uses updateEndpoint (not the base endpoint) for the update branch when they differ', () => {
    const expr = resolveRegionDmlUrlExpressionForPlan('regionData_users', {
      endpoint: '/api/users',
      createEndpoint: '/api/users',
      updateEndpoint: '/api/users/:id/change-password',
      primaryKey: 'id',
    });
    expect(expr).toContain(resolveRegionDmlUrlExpression('regionData_users', '/api/users/:id/change-password', 'id'));
    expect(expr).not.toContain(resolveRegionDmlUrlExpression('regionData_users', '/api/users', 'id'));
  });

  it('falls back to the base endpoint when updateEndpoint is not set', () => {
    const expr = resolveRegionDmlUrlExpressionForPlan('regionData_users', {
      endpoint: '/api/users',
      createEndpoint: '/api/users',
      updateEndpoint: '',
      primaryKey: 'id',
    });
    expect(expr).toContain(resolveRegionDmlUrlExpression('regionData_users', '/api/users', 'id'));
  });
});
