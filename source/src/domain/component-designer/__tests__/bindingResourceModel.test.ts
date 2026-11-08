import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  buildDefaultFieldMappings,
  buildDefaultRestOperations,
  buildFormBindingWizardActions,
  buildDataSourceFromEndpoint,
  buildDataSourceFieldsSyncKey,
  dataSourceToResource,
  inferResourceIdFromEndpoint,
  inferResourceNameFromEndpoint,
  mergeResourceFieldsFromMappings,
  resolveFormWizardRecordFieldOptions,
  suggestColumnForNode,
  applyResponseDataPath,
  coerceApiRecordValue,
  normalizeHydrationResolvedValue,
  unwrapStandardApiPayload,
} from '../bindingResourceModel';
import {
  createRegionDataSourceBindingDefinition,
  REGION_DATA_SOURCE_BINDING_KEY,
} from '../bindingRegionEngine';
import { propertyBindingKeyForProp } from '../bindingEngine';

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

describe('bindingResourceModel', () => {
  it('infers resource id and name from endpoint path', () => {
    expect(inferResourceIdFromEndpoint('/api/users')).toBe('users');
    expect(inferResourceNameFromEndpoint('/api/users')).toBe('Users');
    expect(inferResourceIdFromEndpoint('/api/v1/order-items')).toBe('order-items');
  });

  it('builds sync keys that change when discovered fields change', () => {
    const base = {
      id: 'roles',
      name: 'Roles',
      endpoint: '/api/roles',
      fields: ['id', 'name'],
      primaryKey: 'id',
    };
    const same = buildDataSourceFieldsSyncKey('roles', base);
    const differentFields = buildDataSourceFieldsSyncKey('roles', {
      ...base,
      fields: ['id', 'name', 'description'],
    });
    expect(same).not.toBe(differentFields);
    expect(buildDataSourceFieldsSyncKey('roles', base)).toBe(same);
  });

  it('builds data source from endpoint with defaults', () => {
    const dataSource = buildDataSourceFromEndpoint('/api/customers', {
      fields: ['id', 'email'],
    });
    expect(dataSource.id).toBe('customers');
    expect(dataSource.name).toBe('Customers');
    expect(dataSource.primaryKey).toBe('id');
    expect(dataSource.fields).toEqual(['id', 'email']);
    expect(dataSource.operations.list?.endpoint).toBe('/api/customers');
  });

  it('derives the collection base when a route includes a trailing param', () => {
    const dataSource = buildDataSourceFromEndpoint('/api/users/:id', { method: 'GET' });
    expect(dataSource.id).toBe('users');
    expect(dataSource.endpoint).toBe('/api/users');
    expect(dataSource.operations.list?.endpoint).toBe('/api/users');
    // GET on a param route is recorded as the detail operation with the exact path.
    expect(dataSource.operations.detail).toEqual({ method: 'GET', endpoint: '/api/users/:id' });
  });

  it('records the picked HTTP method onto the matching REST operation', () => {
    const created = buildDataSourceFromEndpoint('/api/orders', { method: 'POST' });
    expect(created.endpoint).toBe('/api/orders');
    expect(created.operations.create).toEqual({ method: 'POST', endpoint: '/api/orders' });

    const updated = buildDataSourceFromEndpoint('/api/orders/:id', { method: 'PATCH' });
    expect(updated.operations.update).toEqual({ method: 'PATCH', endpoint: '/api/orders/:id' });
  });

  it('merges mapped columns into empty resource fields', () => {
    const merged = mergeResourceFieldsFromMappings({
      id: 'users',
      name: 'Users',
      endpoint: '/api/users',
      primaryKey: 'id',
      fields: [],
    }, ['email', 'name']);

    expect(merged.fields).toEqual(['id', 'email', 'name']);
  });

  it('unwraps standard list API payloads for preview and codegen', () => {
    const rows = [{ id: 1, name: 'Alpha' }];
    expect(unwrapStandardApiPayload({ success: true, data: rows, count: 1 })).toEqual(rows);
    expect(unwrapStandardApiPayload(rows)).toEqual(rows);
    expect(unwrapStandardApiPayload({ items: rows })).toEqual(rows);
  });

  it('unwraps standard detail API payloads to the data object', () => {
    const record = { id: 7, title: 'Hello' };
    expect(applyResponseDataPath({ success: true, data: record }, undefined)).toEqual(record);
    expect(applyResponseDataPath({ success: true, data: record }, { arrayPath: 'data' })).toEqual(record);
  });

  it('coerces single-item detail arrays into a record for region bindings', () => {
    const record = {
      topic_label: 'Support',
      title: 'Login issue',
      note: 'Cannot sign in after browser update.',
    };
    const payload = { success: true, data: [record], count: 1 };

    expect(applyResponseDataPath(payload, { arrayPath: 'data' })).toEqual([record]);
    expect(coerceApiRecordValue(applyResponseDataPath(payload, { arrayPath: 'data' }))).toEqual(record);
    expect(normalizeHydrationResolvedValue(applyResponseDataPath(payload, { arrayPath: 'data' }), 'record')).toEqual(record);
    expect(normalizeHydrationResolvedValue(applyResponseDataPath(payload, { arrayPath: 'data' }), 'rows')).toEqual([record]);
  });

  it('builds REST operation presets from base endpoint', () => {
    const operations = buildDefaultRestOperations('/api/customers', 'id');
    expect(operations.list).toEqual({ method: 'GET', endpoint: '/api/customers' });
    expect(operations.create).toEqual({ method: 'POST', endpoint: '/api/customers' });
    expect(operations.detail?.endpoint).toBe('/api/customers/:id');
    expect(operations.update?.method).toBe('PUT');
  });

  it('maps data source to resource view model', () => {
    const resource = dataSourceToResource({
      id: 'customers',
      name: 'Customers',
      endpoint: '/api/customers',
      primaryKey: 'id',
      fields: ['id', 'email'],
    });
    expect(resource.kind).toBe('record');
    expect(resource.operations.create?.method).toBe('POST');
  });

  it('suggests column from node label/name', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;
    const inputInsert = insertNode(state, 'heroui.input-text', formInsert.nodeId);
    state = designerReducer(inputInsert.state, {
      type: 'set-node-prop',
      nodeId: inputInsert.nodeId,
      key: 'name',
      value: 'email',
    });

    const node = state.document.nodes[inputInsert.nodeId]!;
    expect(suggestColumnForNode(node, 'value', ['id', 'email', 'name'])).toBe('email');
    expect(suggestColumnForNode(node, 'value', [])).toBe('email');
  });

  it('builds wizard record-field options from input Name props when resource fields are empty', () => {
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
        primaryKey: 'id',
        fields: [],
      },
    });

    const titleInput = insertNode(state, 'heroui.input-text', formInsert.nodeId);
    state = designerReducer(titleInput.state, {
      type: 'set-node-prop',
      nodeId: titleInput.nodeId,
      key: 'label',
      value: 'Title',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: titleInput.nodeId,
      key: 'name',
      value: 'title',
    });

    const shortNameInput = insertNode(state, 'heroui.input-text', formInsert.nodeId);
    state = designerReducer(shortNameInput.state, {
      type: 'set-node-prop',
      nodeId: shortNameInput.nodeId,
      key: 'label',
      value: 'Short Name',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: shortNameInput.nodeId,
      key: 'name',
      value: 'short_name',
    });

    const mappings = buildDefaultFieldMappings(state.document, formInsert.nodeId, state.bindingDefinitions);
    expect(mappings).toHaveLength(2);
    expect(mappings[0]?.column).toBe('title');
    expect(mappings[0]?.enabled).toBe(true);
    expect(mappings[1]?.column).toBe('short_name');
    expect(mappings[1]?.enabled).toBe(true);

    const options = resolveFormWizardRecordFieldOptions([], mappings, []);
    expect(options).toEqual(['short_name', 'title']);
  });

  it('auto-maps bindable inputs in a form region', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'customers',
      dataSource: {
        id: 'customers',
        name: 'Customers',
        endpoint: '/api/customers',
        primaryKey: 'id',
        fields: ['id', 'email', 'name'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formInsert.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('customers'),
    });

    const inputInsert = insertNode(state, 'heroui.input-text', formInsert.nodeId);
    state = designerReducer(inputInsert.state, {
      type: 'set-node-prop',
      nodeId: inputInsert.nodeId,
      key: 'label',
      value: 'Email',
    });

    const mappings = buildDefaultFieldMappings(state.document, formInsert.nodeId, state.bindingDefinitions);
    expect(mappings).toHaveLength(1);
    expect(mappings[0]?.column).toBe('email');
    expect(mappings[0]?.enabled).toBe(true);
  });

  it('suggests field mappings from a wizard-selected resource before the region is bound', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;

    state = designerReducer(state, {
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

    const inputInsert = insertNode(state, 'heroui.input-text', formInsert.nodeId);
    state = designerReducer(inputInsert.state, {
      type: 'set-node-prop',
      nodeId: inputInsert.nodeId,
      key: 'label',
      value: 'Email',
    });

    const mappings = buildDefaultFieldMappings(
      state.document,
      formInsert.nodeId,
      state.bindingDefinitions,
      { dataSourceId: 'customers' },
    );

    expect(mappings).toHaveLength(1);
    expect(mappings[0]?.column).toBe('email');
    expect(mappings[0]?.enabled).toBe(true);
  });

  it('emits region + column + submit bindings from wizard config', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;

    state = designerReducer(state, {
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

    const inputInsert = insertNode(state, 'heroui.input-text', formInsert.nodeId);

    const actions = buildFormBindingWizardActions(state.document, state.bindingDefinitions, {
      scenario: 'createEdit',
      regionNodeId: formInsert.nodeId,
      dataSourceId: 'customers',
      fieldMappings: [
        { nodeId: inputInsert.nodeId, fieldKey: 'value', column: 'email', enabled: true },
      ],
      successBehavior: 'refresh',
      submitEventTarget: 'onSubmit',
    });

    expect(actions.some((action) => action.type === 'set-node-binding' && action.bindingKey === REGION_DATA_SOURCE_BINDING_KEY)).toBe(true);
    expect(actions.some((action) => action.type === 'set-node-binding' && action.bindingKey === propertyBindingKeyForProp('value'))).toBe(true);
    expect(actions.some((action) => action.type === 'set-node-binding' && action.bindingKey === 'event:onSubmit')).toBe(true);
  });
});
