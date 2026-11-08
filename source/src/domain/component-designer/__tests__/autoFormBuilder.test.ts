import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import {
  inferScenarioFromMethod,
  parseApiEndpointFromOpenApi,
  type ApiFormField,
} from '../apiFieldSchema';
import {
  buildControlProps,
  mapApiFieldToControl,
  suggestControlForField,
  valuePropForControl,
} from '../apiFieldToControl';
import {
  buildAutoFormDocument,
  buildAutoFormSeeds,
  documentHasDesignedContent,
  mergeAutoFormIntoDocument,
  resolveAutoFormInsertTarget,
  type AutoFormFieldConfig,
} from '../autoFormTemplateBuilder';
import { createInitialDesignerState, designerReducer } from '../state';
import { buildDataSourceFromEndpoint } from '../bindingResourceModel';
import {
  collectDocumentRegionPlan,
  getNodeRegionDataSourceRef,
  isDataRegionEligibleContainer,
  resolveRegionSubmitPlanForEvent,
} from '../bindingRegionEngine';
import { propertyBindingKeyForProp } from '../bindingEngine';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';
import type { DataSourceDefinition, DesignerNode } from '../types';

const SAMPLE_SPEC = {
  openapi: '3.1.2',
  paths: {
    '/api/orders/{id}': {
      put: {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'preview', in: 'query', required: false, schema: { type: 'boolean' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'status'],
                properties: {
                  title: { type: 'string' },
                  status: { type: 'string', enum: ['draft', 'paid'] },
                  due_date: { type: 'string', format: 'date' },
                  qty: { type: 'integer' },
                  active: { type: 'boolean' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
  },
};

describe('apiFieldSchema.parseApiEndpointFromOpenApi', () => {
  it('extracts body + parameter fields with enum / format / array hints', () => {
    const parsed = parseApiEndpointFromOpenApi(SAMPLE_SPEC, { method: 'PUT' });
    expect(parsed).not.toBeNull();
    expect(parsed!.method).toBe('PUT');
    expect(parsed!.scenario).toBe('edit');
    expect(parsed!.hasSchema).toBe(true);

    const byName = new Map(parsed!.fields.map((field) => [field.name, field]));
    expect(byName.get('status')?.enum).toEqual(['draft', 'paid']);
    expect(byName.get('status')?.required).toBe(true);
    expect(byName.get('due_date')?.format).toBe('date');
    expect(byName.get('qty')?.type).toBe('integer');
    expect(byName.get('active')?.type).toBe('boolean');
    expect(byName.get('tags')?.type).toBe('array');
    expect(byName.get('tags')?.itemType).toBe('string');
    expect(byName.get('id')?.location).toBe('path');
    expect(byName.get('preview')?.location).toBe('query');
  });

  it('infers scenarios from method + path shape', () => {
    expect(inferScenarioFromMethod('POST', '/api/orders')).toBe('create');
    expect(inferScenarioFromMethod('PUT', '/api/orders/{id}')).toBe('edit');
    expect(inferScenarioFromMethod('GET', '/api/orders/{id}')).toBe('detail');
    expect(inferScenarioFromMethod('GET', '/api/orders')).toBe('search');
  });

  it('returns null for specs with no operations', () => {
    expect(parseApiEndpointFromOpenApi({ paths: {} })).toBeNull();
    expect(parseApiEndpointFromOpenApi(null)).toBeNull();
  });
});

const field = (overrides: Partial<ApiFormField> & { name: string }): ApiFormField => ({
  type: 'string',
  location: 'body',
  required: false,
  ...overrides,
});

describe('apiFieldToControl', () => {
  it('suggests the right control per field type', () => {
    expect(suggestControlForField(field({ name: 'a', type: 'boolean' }))).toBe('heroui.switch');
    expect(suggestControlForField(field({ name: 'a', type: 'integer' }))).toBe('heroui.number-input');
    expect(suggestControlForField(field({ name: 'a', enum: ['x', 'y'] }))).toBe('heroui.select');
    expect(suggestControlForField(field({ name: 'a', format: 'date' }))).toBe('heroui.date-picker');
    expect(suggestControlForField(field({ name: 'a', type: 'array' }))).toBe('heroui.tags-input');
    expect(suggestControlForField(field({ name: 'a', type: 'array', enum: ['x'] }))).toBe('heroui.select');
    expect(suggestControlForField(field({ name: 'a' }))).toBe('heroui.input-text');
  });

  it('maps value props per control', () => {
    expect(valuePropForControl('heroui.switch')).toBe('isSelected');
    expect(valuePropForControl('heroui.select')).toBe('selectedKeys');
    expect(valuePropForControl('heroui.input-text')).toBe('value');
    expect(mapApiFieldToControl(field({ name: 'a', type: 'boolean' }))).toEqual({
      paletteItemId: 'heroui.switch',
      valueProp: 'isSelected',
    });
  });

  it('builds control props with enum items, required, and number step', () => {
    const selectProps = buildControlProps('heroui.select', {
      field: field({ name: 'status', enum: ['draft', 'paid'], required: true }),
      label: 'Status',
    });
    expect(selectProps.name).toBe('status');
    expect(selectProps.isRequired).toBe(true);
    expect(typeof selectProps.items).toBe('string');
    expect(JSON.parse(selectProps.items as string)).toEqual([
      { id: 'draft', textValue: 'Draft' },
      { id: 'paid', textValue: 'Paid' },
    ]);

    const numberProps = buildControlProps('heroui.number-input', {
      field: field({ name: 'qty', type: 'integer' }),
      label: 'Qty',
    });
    expect(numberProps.step).toBe('1');
    expect(numberProps.hint).toBe('Enter qty.');
    expect(selectProps.hint).toBe('Choose status from the available options.');
  });

  it('maps base_info code fields to select without static enum items', () => {
    const genderField = field({ name: 'gender_code', type: 'string', required: true });
    expect(mapApiFieldToControl(genderField)).toEqual({
      paletteItemId: 'heroui.select',
      valueProp: 'selectedKeys',
    });

    const selectProps = buildControlProps('heroui.select', {
      field: genderField,
      label: 'Gender',
    });
    expect(selectProps.items).toBeUndefined();
  });
});

const buildFieldConfigs = (fields: ApiFormField[]): AutoFormFieldConfig[] =>
  fields.map((entry) => {
    const control = mapApiFieldToControl(entry);
    return {
      field: entry,
      enabled: true,
      label: entry.name,
      controlPaletteItemId: control.paletteItemId,
    };
  });

const ORDER_FIELDS: ApiFormField[] = [
  field({ name: 'title', required: true }),
  field({ name: 'status', enum: ['draft', 'paid'] }),
  field({ name: 'qty', type: 'integer' }),
  field({ name: 'active', type: 'boolean' }),
];

const PROFILE_FIELDS: ApiFormField[] = [
  field({ name: 'gender_code', type: 'string', required: true }),
  field({ name: 'title', required: true }),
  field({ name: 'note', type: 'string' }),
];

const buildDataSource = (): DataSourceDefinition =>
  buildDataSourceFromEndpoint('/api/orders', {
    fields: ['id', 'title', 'status', 'qty', 'active'],
    primaryKey: 'id',
    method: 'POST',
  });

describe('autoFormTemplateBuilder.buildAutoFormSeeds', () => {
  it('produces a form root with region data source + submit bindings for create', () => {
    const seeds = buildAutoFormSeeds({
      title: 'New order',
      includeTitle: true,
      dataSource: buildDataSource(),
      scenario: 'create',
      fields: buildFieldConfigs(ORDER_FIELDS),
      submitLabel: 'Create',
      successBehavior: 'refresh',
      layout: 'single',
    });

    expect(seeds).toHaveLength(1);
    const form = seeds[0];
    expect(form.paletteItemId).toBe('html.form');
    expect(form.binding?.regionDataSource?.dataSourceRef).toBe('orders');
    // Submit lives on the Save button's onClick (an anchor never fires native <form onSubmit>).
    expect(form.binding?.['event:onSubmit']).toBeUndefined();

    // heading + fields container + submit button
    expect(form.children).toHaveLength(3);
    const submit = form.children?.[2];
    expect(submit?.paletteItemId).toBe('heroui.button-solid');
    expect(submit?.binding?.['event:onClick']?.regionSubmit).toBe(true);
    expect(submit?.binding?.['event:onClick']?.trueActions?.[0]?.type).toBe('refreshDataSource');

    const fieldsContainer = form.children?.[1];
    const statusSeed = fieldsContainer?.children?.find((seed) => seed.props?.name === 'status');
    expect(statusSeed?.paletteItemId).toBe('heroui.select');
    expect(statusSeed?.binding?.['prop:selectedKeys']?.column).toBe('status');

    const activeSeed = fieldsContainer?.children?.find((seed) => seed.props?.name === 'active');
    expect(activeSeed?.paletteItemId).toBe('heroui.switch');
    expect(activeSeed?.binding?.['prop:isSelected']?.column).toBe('active');
  });

  it('omits the submit button + onSubmit binding for detail/search scenarios', () => {
    const seeds = buildAutoFormSeeds({
      includeTitle: false,
      dataSource: buildDataSource(),
      scenario: 'detail',
      fields: buildFieldConfigs(ORDER_FIELDS),
      submitLabel: 'Submit',
      successBehavior: 'none',
      layout: 'single',
    });
    const form = seeds[0];
    expect(form.binding?.['event:onSubmit']).toBeUndefined();
    expect(form.binding?.regionDataSource?.loadOperation).toBe('detail');
    expect(form.children?.some((seed) => seed.paletteItemId === 'heroui.button-solid')).toBe(false);
  });

  it('skips disabled fields', () => {
    const configs = buildFieldConfigs(ORDER_FIELDS);
    configs[1].enabled = false;
    const seeds = buildAutoFormSeeds({
      includeTitle: false,
      dataSource: buildDataSource(),
      scenario: 'create',
      fields: configs,
      submitLabel: 'Create',
      successBehavior: 'none',
      layout: 'single',
    });
    const fieldsContainer = seeds[0].children?.[0];
    expect(fieldsContainer?.children?.some((seed) => seed.props?.name === 'status')).toBe(false);
    expect(fieldsContainer?.children?.some((seed) => seed.props?.name === 'title')).toBe(true);
  });
});

describe('autoFormTemplateBuilder.buildAutoFormDocument', () => {
  it('builds a hydratable document whose form is a connected data region', () => {
    const result = buildAutoFormDocument({
      title: 'New order',
      includeTitle: true,
      dataSource: buildDataSource(),
      scenario: 'create',
      fields: buildFieldConfigs(ORDER_FIELDS),
      submitLabel: 'Create',
      successBehavior: 'refresh',
      layout: 'single',
    });

    const formNode = Object.values(result.document.nodes).find(
      (node: DesignerNode) => node.props._designerPaletteItemId === 'html.form',
    );
    expect(formNode).toBeTruthy();
    expect(isDataRegionEligibleContainer(formNode!)).toBe(true);
    expect(getNodeRegionDataSourceRef(formNode!)).toBe('orders');
    expect(result.bindingDefinitions.dataSources.orders).toBeTruthy();
    expect(result.preferredSelectedNodeId).toBe(formNode!.id);

    // The baked column bindings should be discovered by the region engine.
    const plan = collectDocumentRegionPlan(result.document, result.bindingDefinitions);
    expect(plan.regionFetches).toHaveLength(0);
    const boundColumns = plan.regionColumnBindings.map((binding) => binding.column).sort();
    expect(boundColumns).toEqual(['active', 'qty', 'status', 'title']);

    // The submit plan should resolve from the form node's onSubmit binding.
    const submitPlan = resolveRegionSubmitPlanForEvent(
      result.document,
      formNode!.id,
      result.bindingDefinitions,
    );
    expect(submitPlan).not.toBeNull();
    expect(submitPlan!.dataSourceId).toBe('orders');
    expect(submitPlan!.fieldMappings.length).toBe(4);
  });

  it('generates syntactically valid TSX for create and detail forms', async () => {
    for (const scenario of ['create', 'detail'] as const) {
      const result = buildAutoFormDocument({
        title: 'Order',
        includeTitle: true,
        dataSource: buildDataSource(),
        scenario,
        fields: buildFieldConfigs(ORDER_FIELDS),
        submitLabel: 'Save',
        successBehavior: scenario === 'create' ? 'refresh' : 'none',
        layout: 'two-column',
      });
      const tsx = generateDesignerTsx(result.document, result.bindingDefinitions);
      expect(tsx).toContain('export const GeneratedComponent');
      expect(tsx).toContain('data-page-guide-hint');
      expect(tsx).toContain('Required. Enter title.');
      assertValidTsxSyntax(scenario, tsx);
    }
  });
});

describe('autoFormTemplateBuilder.mergeAutoFormIntoDocument', () => {
  const buildConfig = () => ({
    title: 'Message detail',
    includeTitle: false,
    dataSource: buildDataSource(),
    scenario: 'detail' as const,
    fields: buildFieldConfigs(ORDER_FIELDS.filter((field) => ['title', 'status'].includes(field.name))),
    submitLabel: 'Save',
    successBehavior: 'none' as const,
    layout: 'single' as const,
  });

  const insertNode = (
    state: ReturnType<typeof createInitialDesignerState>,
    itemId: string,
    parentId: string,
  ) => {
    const next = designerReducer(state, { type: 'insert-palette-item', itemId, parentId });
    const parent = next.document.nodes[parentId];
    const childId = parent.children[parent.children.length - 1];
    return { state: next, nodeId: childId };
  };

  it('resolves form and modal selection targets', () => {
    let state = createInitialDesignerState();
    const modalInsert = insertNode(state, 'heroui.modal', state.document.rootNodeId);
    const formInsert = insertNode(modalInsert.state, 'html.form', modalInsert.nodeId);
    state = formInsert.state;

    expect(documentHasDesignedContent(state.document)).toBe(true);
    expect(resolveAutoFormInsertTarget(state.document, formInsert.nodeId)).toEqual({
      mode: 'form-region',
      formNodeId: formInsert.nodeId,
    });
    expect(resolveAutoFormInsertTarget(state.document, modalInsert.nodeId)).toEqual({
      mode: 'form-region',
      formNodeId: formInsert.nodeId,
    });
  });

  it('resolves flex column selection to nested form region', () => {
    let state = createInitialDesignerState();
    const columnInsert = insertNode(state, 'layout.flex-column', state.document.rootNodeId);
    const formInsert = insertNode(columnInsert.state, 'html.form', columnInsert.nodeId);
    state = formInsert.state;

    expect(resolveAutoFormInsertTarget(state.document, columnInsert.nodeId)).toEqual({
      mode: 'form-region',
      formNodeId: formInsert.nodeId,
    });
  });

  it('merges generated fields into an existing form inside a modal without wiping siblings', () => {
    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
    const modalInsert = insertNode(gridInsert.state, 'heroui.modal', state.document.rootNodeId);
    const formInsert = insertNode(modalInsert.state, 'html.form', modalInsert.nodeId);
    state = formInsert.state;

    const merged = mergeAutoFormIntoDocument(
      state.document,
      state.bindingDefinitions,
      buildConfig(),
      { mode: 'form-region', formNodeId: formInsert.nodeId },
    );

    expect(merged.document.nodes[gridInsert.nodeId]).toBeDefined();
    expect(merged.document.nodes[modalInsert.nodeId]).toBeDefined();
    expect(getNodeRegionDataSourceRef(merged.document.nodes[formInsert.nodeId]!)).toBe('orders');

    const formChildren = merged.document.nodes[formInsert.nodeId]?.children ?? [];
    expect(formChildren.length).toBeGreaterThan(0);
    expect(merged.preferredSelectedNodeId).toBe(formInsert.nodeId);
  });

  it('scaffolds gender_code as select with base-info LOV binding', () => {
    const result = buildAutoFormDocument({
      title: 'Profile',
      includeTitle: false,
      dataSource: buildDataSource(),
      scenario: 'create',
      fields: buildFieldConfigs(PROFILE_FIELDS),
      submitLabel: 'Save',
      successBehavior: 'refresh',
      layout: 'single',
    });

    const genderControl = Object.values(result.document.nodes).find(
      (node) => node.props.name === 'gender_code',
    );
    expect(genderControl?.props._designerPaletteItemId ?? genderControl?.props[DESIGNER_PALETTE_ITEM_ID_PROP]).toBe('heroui.select');
    expect(result.bindingDefinitions.lovs.gender_codeOptions).toMatchObject({
      endpoint: '/api/base-info/options?root=100.1&lang=fa',
      displayValue: 'label',
      returnValue: 'id',
    });
    expect(genderControl?.binding[propertyBindingKeyForProp('items')]?.lovRef).toBe('gender_codeOptions');
  });
});
