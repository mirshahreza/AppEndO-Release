/**
 * Bug found (parity audit item 88): form wizard success options (refresh/toast/reset/close) were
 * mutually exclusive (`if/else if`). Users could not toast AND refresh AND close. Close with no
 * overlay ancestor was a silent no-op. Fixed in bindingResourceModel.ts: combinable
 * `successBehaviors` array in canonical order, plus console.warn when close has no overlay.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { buildFormBindingWizardActions, findAncestorOverlayNodeId } from '../bindingResourceModel';

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

describe('form wizard combinable success behaviors (item 88)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('combines toast + refresh + reset into one ordered trueActions chain', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = withCustomersDataSource(formInsert.state);

    const actions = buildFormBindingWizardActions(state.document, state.bindingDefinitions, {
      scenario: 'createEdit',
      regionNodeId: formInsert.nodeId,
      dataSourceId: 'customers',
      fieldMappings: [],
      successBehaviors: ['refresh', 'toast', 'reset'],
      submitEventTarget: 'onSubmit',
    });

    const submit = findSubmitDefinition(actions);
    const trueActions = submit && submit.type === 'set-node-binding' ? submit.definition.trueActions : undefined;
    expect(trueActions?.map((action) => action.type)).toEqual(['showToast', 'refreshDataSource', 'resetForm']);
    expect(submit && submit.type === 'set-node-binding' ? submit.definition.invalidateQueries : undefined)
      .toEqual(['region:customers']);
  });

  it('warns when close is selected without a Modal/Drawer ancestor', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = withCustomersDataSource(formInsert.state);

    expect(findAncestorOverlayNodeId(state.document, formInsert.nodeId)).toBeUndefined();

    const actions = buildFormBindingWizardActions(state.document, state.bindingDefinitions, {
      scenario: 'createEdit',
      regionNodeId: formInsert.nodeId,
      dataSourceId: 'customers',
      fieldMappings: [],
      successBehaviors: ['close'],
      submitEventTarget: 'onSubmit',
    });

    const submit = findSubmitDefinition(actions);
    const trueActions = submit && submit.type === 'set-node-binding' ? submit.definition.trueActions : undefined;
    expect(trueActions ?? []).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Close dialog'));
  });

  it('still supports legacy single successBehavior', () => {
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
    const trueActions = submit && submit.type === 'set-node-binding' ? submit.definition.trueActions : undefined;
    expect(trueActions).toHaveLength(1);
    expect(trueActions?.[0]?.type).toBe('showToast');
  });
});
