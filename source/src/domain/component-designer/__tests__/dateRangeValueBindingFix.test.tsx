/**
 * @vitest-environment jsdom
 * form.date-range — value binding was entirely decorative (the `value` prop was never read at
 * all) and onChange passed a react-aria RangeValue straight into code that blindly reads
 * event.target.value. Fixed via two bindable ISO date fields (startValue/endValue) combined into
 * a real {start,end} RangeValue, with an onChange adapter mirroring adaptSelectionChangeAttr.
 */
import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { resolveDateRangeProps } from '../runtimeNodeProps';
import { createEventBindingDefinition, eventBindingKeyForEvent, createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import { generateDesignerTsx } from '../codegen';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId];
  return parent.children[parent.children.length - 1] as string;
};

describe('resolveDateRangeProps (canvas)', () => {
  it('combines startValue/endValue into a real {start,end} defaultValue', () => {
    let state = insertItem(createInitialDesignerState(), 'form.date-range');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'startValue', value: '2026-01-15' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'endValue', value: '2026-01-20' });

    const props = resolveDateRangeProps(state.document.nodes[nodeId]!);
    const value = props.defaultValue as { start: { toString(): string }; end: { toString(): string } };
    expect(value.start.toString()).toBe('2026-01-15');
    expect(value.end.toString()).toBe('2026-01-20');
  });

  it('leaves defaultValue unset when start/end are not both provided', () => {
    let state = insertItem(createInitialDesignerState(), 'form.date-range');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'startValue', value: '2026-01-15' });

    const props = resolveDateRangeProps(state.document.nodes[nodeId]!);
    expect(props.defaultValue).toBeUndefined();
  });
});

describe('form.date-range export codegen', () => {
  it('emits DesignerDateRangeField with start/end props and a real onChange adapter', () => {
    let state = insertItem(createInitialDesignerState(), 'form.date-range');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'startValue', value: '2026-01-15' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'endValue', value: '2026-01-20' });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: eventBindingKeyForEvent('onChange'),
      definition: createEventBindingDefinition('onChange', '/api/v1/date-range', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerDateRangeField');
    expect(tsx).toContain('startValue="2026-01-15"');
    expect(tsx).toContain('endValue="2026-01-20"');
    expect(tsx).toMatch(/onChange=\{\(start, end\) => handle/);
    expect(tsx).not.toMatch(/onChange=\{handleonChange_[^(]*\}[^(]/);
  });

  it('binds startValue/endValue through the generic property-binding mechanism', () => {
    let state = insertItem(createInitialDesignerState(), 'form.date-range');
    const nodeId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('startValue'),
      definition: createPropertyBindingDefinition('startValue', 'record.startDate'),
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('endValue'),
      definition: createPropertyBindingDefinition('endValue', 'record.endDate'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerDateRangeField');
    expect(tsx).toContain('startValue={String(');
    expect(tsx).toContain('endValue={String(');
  });

  it('does not import parseDate inline when date-range uses DesignerDateRangeField wrapper', () => {
    const state = insertItem(createInitialDesignerState(), 'form.date-range');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).not.toContain('@internationalized/date');
    expect(tsx).toContain('DesignerDateRangeField');
  });
});
