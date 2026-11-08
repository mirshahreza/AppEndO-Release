import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { buildFormBindingWizardActions, findAncestorOverlayNodeId } from '../bindingResourceModel';
import { generateDesignerTsx } from '../codegen';
import { visibilityStorePathForNode } from '../bindingDynamicActionsEngine';

/**
 * Bug found: the Create/Edit form wizard's "Show success toast" / "Reset form fields" /
 * "Close dialog" success options were silent no-ops — only "Refresh data after save" actually
 * attached a trueAction. buildFormBindingWizardActions now wires each option to a concrete,
 * already-tested Dynamic Action (showToast / resetForm / showHide), matching the "refresh"
 * option's existing pattern.
 */

const insertNode = (state: ReturnType<typeof createInitialDesignerState>, itemId: string, parentId: string) => {
  const next = designerReducer(state, { type: 'insert-palette-item', itemId, parentId });
  const parent = next.document.nodes[parentId];
  const childId = parent.children[parent.children.length - 1];
  return { state: next, nodeId: childId };
};

const withCustomersDataSource = (state: ReturnType<typeof createInitialDesignerState>) =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'customers',
    dataSource: {
      id: 'customers',
      name: 'Customers',
      endpoint: '/api/customers',
      primaryKey: 'id',
      fields: ['id', 'email'],
    },
  });

const findSubmitDefinition = (
  actions: ReturnType<typeof buildFormBindingWizardActions>,
) => actions.find((action) => action.type === 'set-node-binding' && action.bindingKey === 'event:onSubmit');

describe('form wizard success behaviors', () => {
  it('wires "toast" to a showToast trueAction', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = withCustomersDataSource(formInsert.state);

    const actions = buildFormBindingWizardActions(state.document, state.bindingDefinitions, {
      scenario: 'createEdit',
      regionNodeId: formInsert.nodeId,
      dataSourceId: 'customers',
      fieldMappings: [],
      successBehavior: 'toast',
      submitEventTarget: 'onSubmit',
    });

    const submit = findSubmitDefinition(actions);
    expect(submit?.type).toBe('set-node-binding');
    const trueActions = submit && submit.type === 'set-node-binding' ? submit.definition.trueActions : undefined;
    expect(trueActions).toHaveLength(1);
    expect(trueActions?.[0]?.type).toBe('showToast');
  });

  it('wires "reset" to a resetForm trueAction targeting the region, and codegen emits a guarded .reset() call', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = withCustomersDataSource(formInsert.state);

    const actions = buildFormBindingWizardActions(state.document, state.bindingDefinitions, {
      scenario: 'createEdit',
      regionNodeId: formInsert.nodeId,
      dataSourceId: 'customers',
      fieldMappings: [],
      successBehavior: 'reset',
      submitEventTarget: 'onSubmit',
    });

    const submit = findSubmitDefinition(actions);
    const trueActions = submit && submit.type === 'set-node-binding' ? submit.definition.trueActions : undefined;
    expect(trueActions).toHaveLength(1);
    expect(trueActions?.[0]).toMatchObject({ type: 'resetForm', targetNodeId: formInsert.nodeId });

    for (const action of actions) {
      state = designerReducer(state, action);
    }
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('form wizard reset success', tsx);
    expect(tsx).toContain(`document.querySelector("[data-designer-node-id=\\"${formInsert.nodeId}\\"]")`);
    expect(tsx).toContain('as HTMLFormElement | null)?.reset?.();');
  });

  it('wires "close" to a showHide(hide) trueAction targeting the nearest ancestor Modal', () => {
    let state = createInitialDesignerState();
    const modalInsert = insertNode(state, 'heroui.modal', state.document.rootNodeId);
    state = modalInsert.state;
    const formInsert = insertNode(state, 'html.form', modalInsert.nodeId);
    state = withCustomersDataSource(formInsert.state);

    expect(findAncestorOverlayNodeId(state.document, formInsert.nodeId)).toBe(modalInsert.nodeId);

    const actions = buildFormBindingWizardActions(state.document, state.bindingDefinitions, {
      scenario: 'createEdit',
      regionNodeId: formInsert.nodeId,
      dataSourceId: 'customers',
      fieldMappings: [],
      successBehavior: 'close',
      submitEventTarget: 'onSubmit',
    });

    const submit = findSubmitDefinition(actions);
    const trueActions = submit && submit.type === 'set-node-binding' ? submit.definition.trueActions : undefined;
    expect(trueActions).toHaveLength(1);
    expect(trueActions?.[0]).toMatchObject({
      type: 'showHide',
      targetNodeId: modalInsert.nodeId,
      showHideEffect: 'hide',
    });

    for (const action of actions) {
      state = designerReducer(state, action);
    }
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('form wizard close success', tsx);
    expect(tsx).toContain(visibilityStorePathForNode(modalInsert.nodeId));
  });

  it('leaves the chain empty (no crash) when "close" has no ancestor Modal/Drawer', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = withCustomersDataSource(formInsert.state);

    expect(findAncestorOverlayNodeId(state.document, formInsert.nodeId)).toBeUndefined();

    const actions = buildFormBindingWizardActions(state.document, state.bindingDefinitions, {
      scenario: 'createEdit',
      regionNodeId: formInsert.nodeId,
      dataSourceId: 'customers',
      fieldMappings: [],
      successBehavior: 'close',
      submitEventTarget: 'onSubmit',
    });

    const submit = findSubmitDefinition(actions);
    const trueActions = submit && submit.type === 'set-node-binding' ? submit.definition.trueActions : undefined;
    expect(trueActions ?? []).toHaveLength(0);
  });
});

describe('mutation failure feedback in exported TSX', () => {
  it('toasts mutation failures instead of rendering an inline error banner', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = withCustomersDataSource(formInsert.state);

    const actions = buildFormBindingWizardActions(state.document, state.bindingDefinitions, {
      scenario: 'createEdit',
      regionNodeId: formInsert.nodeId,
      dataSourceId: 'customers',
      fieldMappings: [],
      successBehavior: 'none',
      submitEventTarget: 'onSubmit',
    });
    for (const action of actions) {
      state = designerReducer(state, action);
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('mutation failure toast', tsx);
    expect(tsx).toContain("toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' })");
    expect(tsx).toContain('<Toast.Provider');
    expect(tsx).not.toContain('{mutationError ? (');
    expect(tsx).not.toContain('border-rose-200 bg-rose-50');
  });

  it('does not reference mutationError for a document with no mutating bindings', () => {
    const state = insertNode(createInitialDesignerState(), 'heroui.button-solid', createInitialDesignerState().document.rootNodeId).state;
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('no mutation bindings', tsx);
    expect(tsx).not.toContain('mutationError');
  });
});
