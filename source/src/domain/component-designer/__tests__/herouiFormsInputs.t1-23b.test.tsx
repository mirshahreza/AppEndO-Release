/**
 * @vitest-environment jsdom
 * Phase T1-23b — HeroUI Forms & Inputs audit (part 2 of 2).
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getBindingCapabilityRow } from '../bindingCapabilityMatrix';
import { generateDesignerTsx } from '../codegen';
import {
  createPropertyBindingDefinition,
  propertyBindingKeyForProp,
} from '../bindingEngine';
import { createDefaultBindingDefinitions } from '../bindingRegistry';
import { DesignerRuntimeCheckboxGroup, DesignerRuntimeRadioGroup } from '../DesignerRuntimeParityPalette';
import { DesignerDocumentPreview, renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';
import type { RuntimeRenderOptions } from '../runtimeTypes';

const FORM_INPUT_IDS_PART2 = [
  'heroui.checkbox-group',
  'heroui.radio-group',
  'heroui.switch',
  'heroui.slider',
  'heroui.date-picker',
  'heroui.tags-input',
  'heroui.color-control',
  'form.rating',
  'form.otp-input',
  'form.time-input',
  'form.datetime-input',
] as const;

const REGION_BINDING_IDS = [
  'heroui.checkbox-group',
  'heroui.radio-group',
  'heroui.switch',
  'heroui.slider',
  'heroui.date-picker',
  'heroui.tags-input',
  'heroui.color-control',
  'form.rating',
  'form.otp-input',
  'form.time-input',
  'form.datetime-input',
] as const;

const LOV_ITEM_IDS = ['heroui.checkbox-group', 'heroui.radio-group'] as const;

const LOV_ENDPOINT = '/api/lov/t1-23b-plans';

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
    't1-23b-plans': {
      id: 't1-23b-plans',
      name: 'T1-23b Plans',
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
    definition: createPropertyBindingDefinition('items', 'lovData_t1_23b', {
      fetchEndpoint: LOV_ENDPOINT,
      lovRef: 't1-23b-plans',
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

describe('T1-23b HeroUI Forms & Inputs audit (part 2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it.each(FORM_INPUT_IDS_PART2)('renders %s in canvas preview without throwing', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it.each(FORM_INPUT_IDS_PART2)('exports TSX for %s', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
  });

  it.each(REGION_BINDING_IDS)('lists Region capability for %s', (itemId) => {
    const row = getBindingCapabilityRow(itemId);
    expect(row?.supportedCapabilities).toContain('Region');
  });

  it.each(LOV_ITEM_IDS)('lists LOV capability for %s', (itemId) => {
    const row = getBindingCapabilityRow(itemId);
    expect(row?.supportedCapabilities).toContain('LOV');
  });

  it('reflects checkbox-group static items and selected values in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.checkbox-group');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'isSelected',
      value: 'option-1,option-3',
    });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(screen.getByText('Option 1', { selector: '[data-designer-component="heroui.checkbox-group"] *' })).toBeTruthy();
    expect(screen.getByText('Option 3', { selector: '[data-designer-component="heroui.checkbox-group"] *' })).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<CheckboxGroup');
    // No onChange is wired in this scenario — `defaultValue` (uncontrolled) is correct so the
    // exported checkboxes stay clickable; a real `value=` (controlled, with nothing to update
    // it) would freeze them. See formInputFreezeExportFix.test.ts for the dedicated regression.
    expect(tsx).toContain('defaultValue={["option-1","option-3"]}');
  });

  it('reflects radio-group selected option in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.radio-group');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'isSelected',
      value: 'option-2',
    });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(screen.getByText('Option 2', { selector: '[data-designer-component="heroui.radio-group"] *' })).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<RadioGroup');
    // No onChange is wired here — `defaultValue` (uncontrolled) is correct so the exported radio
    // group stays clickable. See formInputFreezeExportFix.test.ts for the dedicated regression.
    expect(tsx).toMatch(/defaultValue="option-2"|defaultValue={'option-2'}/);
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
        { code: 'basic', title: 'Basic plan' },
        { code: 'pro', title: 'Pro plan' },
      ],
    });

    if (itemId === 'heroui.checkbox-group') {
      render(<DesignerRuntimeCheckboxGroup node={node} options={runtimeOptions} />);
    } else {
      render(<DesignerRuntimeRadioGroup node={node} options={runtimeOptions} />);
    }

    release();

    await waitFor(() => {
      expect(screen.queryByText('Loading options…')).toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByText('Basic plan')).toBeTruthy();
      expect(screen.getByText('Pro plan')).toBeTruthy();
    });
  });

  it.each(LOV_ITEM_IDS)('emits mapDesignerLovItems in export when LOV is bound on %s', (itemId) => {
    let state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = bindItemsLov(state, nodeId);
    const bindingDefinitions = createLovBindingDefinitions();

    const tsx = generateDesignerTsx(state.document, bindingDefinitions);
    expect(tsx).toContain('mapDesignerLovItems');
  });

  it('reflects switch isSelected in interactive preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.switch');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'isSelected',
      value: true,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'name',
      value: 'notifications',
    });

    render(
      <DesignerDocumentPreview
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        interactive
      />,
    );

    const hidden = document.querySelector('input[name="notifications"]') as HTMLInputElement | null;
    expect(hidden?.value).toBe('true');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Switch');
  });

  it('reflects slider value in export TSX', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.slider');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'value',
      value: 72,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'min',
      value: 10,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'max',
      value: 100,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'step',
      value: 5,
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Slider');
    expect(tsx).toMatch(/defaultValue=\{72\}|defaultValue={72}/);
    // Bug found (parity audit item 54): real Slider props are minValue/maxValue, not min/max.
    expect(tsx).toMatch(/minValue=\{10\}|minValue={10}/);
    expect(tsx).toMatch(/maxValue=\{100\}|maxValue={100}/);
    expect(tsx).toMatch(/step=\{5\}|step={5}/);
  });

  it('renders slider at edge value 0 without throwing', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.slider');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'value',
      value: 0,
    });

    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it('reflects date-picker label and calendarSystem in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.date-picker');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Start date',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'calendarSystem',
      value: 'jalali',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'placeholder',
      value: 'Pick a day',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('[data-designer-component="heroui.date-picker"]')).toBeTruthy();
    expect(container.textContent).toContain('Start date');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerDatePickerField');
    expect(tsx).toMatch(/calendarSystem="jalali"|calendarSystem={'jalali'}/);
    expect(tsx).toContain('Pick a day');
  });

  it('renders date-picker with empty value without throwing', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.date-picker');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'value',
      value: '',
    });

    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it('parses tags-input JSON array value in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tags-input');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'value',
      value: '["alpha","beta"]',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Topics',
    });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(screen.getByText('alpha', { selector: '[data-designer-component="heroui.tags-input"] *' })).toBeTruthy();
    expect(screen.getByText('beta', { selector: '[data-designer-component="heroui.tags-input"] *' })).toBeTruthy();
  });

  it('shows tags-input placeholder when value is empty in design mode', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tags-input');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'value',
      value: '',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'placeholder',
      value: 'Type and press Enter',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Type and press Enter');
  });

  it('reflects tags-input value in export TSX', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tags-input');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'value',
      value: 'red,blue',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<TagGroup');
    expect(tsx).toContain('red');
    expect(tsx).toContain('blue');
  });

  it('reflects color-control label and value in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.color-control');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Brand color',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'value',
      value: '#EF4444',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Brand color');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerColorEditorField');
    expect(tsx).toContain('Brand color');
  });

  it('reflects form.rating label, value, and max in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'form.rating');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Satisfaction',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'value',
      value: 3,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'max',
      value: 5,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Satisfaction');
    expect(container.querySelector('[aria-label="Rating 3 of 5"]')).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalRating');
    // `value` renders as `defaultValue` — DesignerUniversalRating's real prop, renamed to match
    // the codegen's `isDefaultValueCandidate` convention (see ratingOtpTimeDatetimeBindingFix.test.tsx).
    expect(tsx).toMatch(/defaultValue=\{3\}/);
    expect(tsx).toMatch(/max=\{5\}|max={5}/);
  });

  it('reflects form.otp-input label and length in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'form.otp-input');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'SMS code',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'length',
      value: 4,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('SMS code');
    expect(container.querySelectorAll('.flex.h-10.w-9').length).toBe(4);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalOtpInput');
    expect(tsx).toMatch(/length=\{4\}|length={4}/);
  });

  it('reflects form.time-input label and value in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'form.time-input');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Meeting time',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'value',
      value: '14:45',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Meeting time');
    const input = container.querySelector('input[type="time"]') as HTMLInputElement | null;
    expect(input?.defaultValue).toBe('14:45');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalTimeInput');
    expect(tsx).toContain('14:45');
  });

  it('reflects form.datetime-input label and value in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'form.datetime-input');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'Appointment',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'value',
      value: '2026-12-25T18:00',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Appointment');
    const input = container.querySelector('input[type="datetime-local"]') as HTMLInputElement | null;
    expect(input?.defaultValue).toBe('2026-12-25T18:00');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalDateTimeInput');
    expect(tsx).toContain('2026-12-25T18:00');
  });
});
