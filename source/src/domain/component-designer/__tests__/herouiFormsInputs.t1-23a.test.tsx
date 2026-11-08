/**
 * @vitest-environment jsdom
 * Phase T1-23a — HeroUI Forms & Inputs audit (part 1 of 2).
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getBindingCapabilityRow } from '../bindingCapabilityMatrix';
import { generateDesignerTsx } from '../codegen';
import {
  createEventBindingDefinition,
  createPropertyBindingDefinition,
  eventBindingKeyForEvent,
  propertyBindingKeyForProp,
} from '../bindingEngine';
import { buildPayloadFromFormData } from '../bindingMutationRuntime';
import { createDefaultBindingDefinitions } from '../bindingRegistry';
import { DesignerRuntimeAutocomplete } from '../DesignerRuntimeAutocomplete';
import { DesignerRuntimeSelect } from '../DesignerRuntimeSelect';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';
import type { RuntimeRenderOptions } from '../runtimeTypes';

vi.mock('react-imask', () => ({
  useIMask: (_options: unknown, config?: { defaultValue?: string }) => ({
    ref: { current: null },
    maskRef: {
      current: {
        value: config?.defaultValue ?? '',
        unmaskedValue: config?.defaultValue ?? '',
        updateOptions: () => {},
      },
    },
    setValue: () => {},
  }),
}));

const FORM_INPUT_IDS = [
  'heroui.field-container',
  'heroui.input-text',
  'heroui.textarea',
  'heroui.number-input',
  'heroui.select',
  'heroui.autocomplete',
  'heroui.entity-picker',
  'form.date-range',
  'form.code-editor',
  'form.html-editor',
  'form.markdown-editor',
  'form.mask-input',
  'form.calculator',
] as const;

const LOV_ENDPOINT = '/api/lov/t1-23a-topics';

const LOV_ITEM_IDS = ['heroui.select', 'heroui.autocomplete'] as const;

const REGION_BINDING_IDS = [
  'heroui.input-text',
  'heroui.textarea',
  'heroui.number-input',
  'form.date-range',
  'form.code-editor',
  'form.html-editor',
  'form.markdown-editor',
  'form.mask-input',
  'form.calculator',
] as const;

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState, parentId: string): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
};

const createLovBindingDefinitions = () => ({
  ...createDefaultBindingDefinitions(),
  lovs: {
    't1-23a-topics': {
      id: 't1-23a-topics',
      name: 'T1-23a Topics',
      endpoint: LOV_ENDPOINT,
      returnValue: 'code',
      displayValue: 'title',
    },
  },
});

const bindItemsLov = (state: DesignerState, nodeId: string) =>
  designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('items'),
    definition: createPropertyBindingDefinition('items', 'lovData_t1_23a', {
      fetchEndpoint: LOV_ENDPOINT,
      lovRef: 't1-23a-topics',
    }),
  });

const mockPendingLovFetch = (payload: unknown) => {
  let resolveResponse!: (value: Response) => void;
  const responsePromise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : String(input);
    if (!url.includes(LOV_ENDPOINT)) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    return responsePromise;
  });

  return () => {
    resolveResponse(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  };
};

describe('T1-23a HeroUI Forms & Inputs audit (part 1)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it.each(FORM_INPUT_IDS.filter((id) => id !== 'heroui.field-container'))(
    'renders %s in canvas preview without throwing',
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
    },
  );

  it('renders field-container with child input without throwing', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.field-container');
    const containerId = lastChildId(state, state.document.rootNodeId);
    state = insertItem(state, 'heroui.input-text', containerId);
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it.each(FORM_INPUT_IDS.filter((id) => id !== 'heroui.field-container'))(
    'exports TSX for %s',
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('export const GeneratedComponent');
    },
  );

  it.each(REGION_BINDING_IDS)('lists Region capability for %s', (itemId) => {
    const row = getBindingCapabilityRow(itemId);
    expect(row?.supportedCapabilities).toContain('Region');
  });

  it.each(LOV_ITEM_IDS)('lists LOV capability for %s', (itemId) => {
    const row = getBindingCapabilityRow(itemId);
    expect(row?.supportedCapabilities).toContain('LOV');
  });

  it('lists EntityPicker capability for heroui.entity-picker', () => {
    const row = getBindingCapabilityRow('heroui.entity-picker');
    expect(row?.supportedCapabilities).toEqual(['EntityPicker']);
    expect(row?.bindingStatus).toBe('parity-tested');
  });

  it('has no binding obligations for heroui.field-container', () => {
    const row = getBindingCapabilityRow('heroui.field-container');
    expect(row?.bindingStatus).toBe('none');
    expect(row?.supportedCapabilities).toEqual([]);
  });

  it('reflects field-container legend from label in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.field-container');
    const containerId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: containerId,
      key: 'label',
      value: 'Contact details',
    });
    state = insertItem(state, 'heroui.input-text', containerId);

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const legend = container.querySelector('legend');
    expect(legend?.textContent).toBe('Contact details');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<fieldset');
    expect(tsx).toContain('Contact details');
  });

  it('reflects input-text placeholder and type in canvas and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.input-text');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Email',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'placeholder',
      value: 'you@example.com',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'type',
      value: 'email',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const input = container.querySelector('input');
    expect(input?.getAttribute('placeholder')).toBe('you@example.com');
    expect(input?.getAttribute('type')).toBe('email');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('you@example.com');
    expect(tsx).toMatch(/type="email"|type={'email'}/);
    expect(tsx).toMatch(/label="Email"|label={'Email'}/);
  });

  it('reflects textarea minRows in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.textarea');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'minRows',
      value: 6,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'placeholder',
      value: 'Describe the issue',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const textarea = container.querySelector('textarea');
    expect(textarea?.getAttribute('rows')).toBe('6');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('Describe the issue');
    expect(tsx).toMatch(/rows=\{6\}|rows={6}/);
  });

  it('reflects number-input min, max, and step in export TSX', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.number-input');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'min',
      value: '0',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'max',
      value: '100',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'step',
      value: '5',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('min={0}');
    expect(tsx).toContain('max={100}');
    expect(tsx).toContain('step={5}');
  });

  it('reflects select static items in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.select');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'items',
      value: JSON.stringify([
        { id: 'alpha', textValue: 'Alpha item' },
        { id: 'beta', textValue: 'Beta item' },
      ]),
    });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);
    fireEvent.click(screen.getByRole('button', { name: /Select…/ }));
    expect(screen.getByRole('option', { name: 'Alpha item' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Beta item' })).toBeTruthy();
  });

  it.each(LOV_ITEM_IDS)('loads LOV options from API for %s', async (itemId) => {
    let state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = bindItemsLov(state, nodeId);
    const bindingDefinitions = createLovBindingDefinitions();
    const node = state.document.nodes[nodeId]!;
    const runtimeOptions: RuntimeRenderOptions = {
      mode: 'runtime',
      bindingDefinitions,
    };

    const release = mockPendingLovFetch({
      items: [
        { code: '104.1', title: 'Support' },
        { code: '104.2', title: 'Sales' },
      ],
    });

    if (itemId === 'heroui.select') {
      render(<DesignerRuntimeSelect node={node} options={runtimeOptions} />);
    } else {
      render(<DesignerRuntimeAutocomplete node={node} options={runtimeOptions} />);
    }

    release();

    await waitFor(() => {
      expect(screen.queryByText('Loading options…')).toBeNull();
    });

    if (itemId === 'heroui.select') {
      fireEvent.click(screen.getByRole('button', { name: /Select…/ }));
    }

    await waitFor(() => {
      expect(screen.getAllByText('Support').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sales').length).toBeGreaterThan(0);
    });
  });

  it.each(LOV_ITEM_IDS)('emits mapDesignerLovItems in export when LOV is bound on %s', (itemId) => {
    let state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = bindItemsLov(state, nodeId);
    const bindingDefinitions = createLovBindingDefinitions();

    const tsx = generateDesignerTsx(state.document, bindingDefinitions);
    expect(tsx).toContain('mapDesignerLovItems');

    // Bug found: the bound-attribute loop in buildNodeJsxAttributesWithBindings appended a
    // second, raw (unmapped) `items=` attribute onto the SAME opening tag regardless of the
    // per-widget codegen's own hand-written `items={mapDesignerLovItems(...)}` attribute, since
    // resolveBoundAttributeForNodeProp's items-exclusion originally only covered
    // 'heroui.select'. heroui.select never emits an items= attribute on its own tag (its
    // options render as children), so it was unaffected; heroui.autocomplete's root tag does
    // emit one (plus a legitimate second `items=` on its nested <ListBox>, which is a
    // different tag and not a duplicate), so its root tag alone must carry exactly one.
    const rootTagMatch = itemId === 'heroui.select'
      ? tsx.match(/<UiSelect\b[^>]*>/)
      : tsx.match(/<UiAutocomplete\b[^>]*>/);
    expect(rootTagMatch).not.toBeNull();
    const itemsAttrOnRootTag = (rootTagMatch![0].match(/ items=\{/g) ?? []).length;
    expect(itemsAttrOnRootTag).toBe(itemId === 'heroui.select' ? 0 : 1);
  });

  it('reflects autocomplete static items in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.autocomplete');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'items',
      value: JSON.stringify([{ id: 'a1', textValue: 'Alpha option' }]),
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Topic',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Topic');
  });

  it('includes entity picker runtime helpers in standalone export (T1-18 fix)', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.entity-picker');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain('useEntityPickerOptions');
    expect(tsx).toContain('normalizeEntityPickerItems');
    // The real search endpoint still reaches the generated hook call, just not as a literal
    // `entityRef=` JSX attribute (parity audit item 27 — never a real Autocomplete prop).
    expect(tsx).toContain('useEntityPickerOptions("/api/entities"');
    expect(tsx).not.toMatch(/<Autocomplete\b[^>]*\sentityRef=/);
  });

  it('reflects entity-picker label and entityRef in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.entity-picker');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Assignee',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'entityRef',
      value: '/api/users',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Assignee');
    expect(container.querySelector('[data-designer-component="heroui.entity-picker"]')).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    // The real search endpoint still reaches the generated hook call, just not as a literal
    // `entityRef=` JSX attribute (parity audit item 27 — never a real Autocomplete prop).
    expect(tsx).toContain('useEntityPickerOptions("/api/users"');
    expect(tsx).not.toMatch(/<Autocomplete\b[^>]*\sentityRef=/);
  });

  it('reflects form.date-range label in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'form.date-range');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Reporting period',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Reporting period');
    expect(container.querySelector('[data-designer-component="form.date-range"]')).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerDateRangeField');
    expect(tsx).toContain('Reporting period');
  });

  it('reflects form.code-editor language in export', () => {
    let state = insertItem(createInitialDesignerState(), 'form.code-editor');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'language',
      value: 'json',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Payload JSON',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerCodeEditorField');
    expect(tsx).toMatch(/language="json"|language={'json'}/);
  });

  it('reflects form.html-editor showToolbar=false in export', () => {
    let state = insertItem(createInitialDesignerState(), 'form.html-editor');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'showToolbar',
      value: false,
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerHtmlEditorField');
    expect(tsx).toMatch(/showToolbar=\{false\}|showToolbar={false}/);
  });

  it('reflects form.mask-input mask preset in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'form.mask-input');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'maskPreset',
      value: 'mobile-ir',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('[data-designer-component="form.mask-input"]')).toBeTruthy();
    expect(container.textContent).toContain('Masked Input');
  });

  it('reflects form.calculator label in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'form.calculator');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Invoice total',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Invoice total');
    expect(container.querySelector('[data-designer-component="form.calculator"]')).toBeTruthy();
  });

  it('builds mutation payload from form controls with name attributes', () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'html.form');
    const formId = lastChildId(state, state.document.rootNodeId);

    state = insertItem(state, 'heroui.input-text', formId);
    const emailId = lastChildId(state, formId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: emailId,
      key: 'name',
      value: 'email',
    });

    state = insertItem(state, 'heroui.textarea', formId);
    const notesId = lastChildId(state, formId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: notesId,
      key: 'name',
      value: 'notes',
    });

    state = insertItem(state, 'heroui.select', formId);
    const topicId = lastChildId(state, formId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: topicId,
      key: 'name',
      value: 'topicCode',
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: eventBindingKeyForEvent('onSubmit'),
      definition: createEventBindingDefinition('onSubmit', '/api/tickets', 'POST', {
        email: emailId,
        notes: notesId,
        topic: topicId,
      }),
    });

    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('notes', 'Need help');
    formData.set('topicCode', '104.1');

    const payload = buildPayloadFromFormData(formData, {
      email: 'email',
      notes: 'notes',
      topic: 'topicCode',
    });

    expect(payload).toEqual({
      email: 'user@example.com',
      notes: 'Need help',
      topic: '104.1',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('/api/tickets');
    expect(tsx).toContain('designerFetch');
  });
});
