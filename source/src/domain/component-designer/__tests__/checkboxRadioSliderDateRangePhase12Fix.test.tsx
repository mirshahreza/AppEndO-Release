/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit items 53–60, 93): Checkbox/Radio group size+color were dead library
 * props; Slider min/max used wrong names (need minValue/maxValue, scoped so number-input stays
 * intact), size was inert, and Canvas/Preview locked the thumb by spreading value alongside
 * defaultValue; form.date-range lacked live validation, end≥start check, Preview binding for
 * startValue/endValue, and Inspector exposure of minValue/maxValue/granularity/isReadOnly;
 * Switch size existed on the real component but was hidden from Inspector.
 * Fixed in propRegistry.ts, runtimeNodeProps.ts, tsxPropMapper.ts, inspectorPaletteFields.ts,
 * DesignerRuntimeParityPalette.tsx, tsxParityPalette.ts, runtimeRenderer.tsx, tsxNodeRenderer.ts,
 * runtimePhase2Palette.tsx, tsxPhase2Palette.ts.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import { resolveDateRangeProps, resolveRuntimeComponentProps, validateDateRangeOrdering } from '../runtimeNodeProps';
import { toJsxAttributeName } from '../propRegistry';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: state.document.rootNodeId });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId];
  return parent.children[parent.children.length - 1] as string;
};

const setProp = (state: DesignerState, nodeId: string, key: string, value: unknown): DesignerState =>
  designerReducer(state, { type: 'set-node-prop', nodeId, key, value });

const bindStoreProp = (state: DesignerState, nodeId: string, prop: string, storePath: string): DesignerState => {
  const binding = createStoreReadBindingDefinition(prop, storePath);
  return designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: binding.bindingKey,
    definition: binding.definition,
  });
};

const collectInspectorFieldKeys = (state: DesignerState, nodeId: string): string[] => {
  const node = state.document.nodes[nodeId];
  return resolveInspectorFieldSections(node).flatMap((section) => section.fields.map((field) => field.key));
};

afterEach(() => cleanup());

describe('parity audit items 53–60 + 93 (Phase 12)', () => {
  it('item 53: checkbox-group/radio-group drop dead size/color from Inspector, Preview, and Export', () => {
    for (const paletteId of ['heroui.checkbox-group', 'heroui.radio-group'] as const) {
      let state = insertItem(createInitialDesignerState(), paletteId);
      const nodeId = lastChildId(state);
      const keys = collectInspectorFieldKeys(state, nodeId);
      expect(keys).not.toContain('size');
      expect(keys).not.toContain('color');

      state = setProp(state, nodeId, 'size', 'lg');
      state = setProp(state, nodeId, 'color', 'accent');
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      assertValidTsxSyntax(`${paletteId} legacy size/color`, tsx);
      expect(tsx).not.toMatch(/\ssize=/);
      expect(tsx).not.toMatch(/\scolor=/);

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<>{renderDesignerDocumentPreview(state.document)}</>);
      const leaked = consoleError.mock.calls.flat().join(' ');
      expect(leaked).not.toContain('React does not recognize the `size` prop');
      expect(leaked).not.toContain('React does not recognize the `color` prop');
      consoleError.mockRestore();
    }
  });

  it('item 54: slider min/max remap to minValue/maxValue only for heroui.slider (not number-input)', () => {
    expect(toJsxAttributeName('min', 'heroui.slider')).toBe('minValue');
    expect(toJsxAttributeName('max', 'heroui.slider')).toBe('maxValue');
    expect(toJsxAttributeName('min', 'heroui.number-input')).toBe('min');
    expect(toJsxAttributeName('max', 'heroui.number-input')).toBe('max');
    expect(toJsxAttributeName('min')).toBe('min');

    let state = insertItem(createInitialDesignerState(), 'heroui.slider');
    const sliderId = lastChildId(state);
    state = setProp(state, sliderId, 'min', 10);
    state = setProp(state, sliderId, 'max', 90);
    const sliderTsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('slider minValue/maxValue', sliderTsx);
    expect(sliderTsx).toMatch(/minValue=\{10\}/);
    expect(sliderTsx).toMatch(/maxValue=\{90\}/);
    expect(sliderTsx).not.toMatch(/\smin=\{10\}/);
    expect(sliderTsx).not.toMatch(/\smax=\{90\}/);

    const runtimeProps = resolveRuntimeComponentProps(state.document.nodes[sliderId]!, {
      libraryComponent: true,
      excludeKeys: new Set(['value', 'defaultValue', 'size']),
    });
    expect(runtimeProps.minValue).toBe(10);
    expect(runtimeProps.maxValue).toBe(90);
    expect(runtimeProps.min).toBeUndefined();
    expect(runtimeProps.max).toBeUndefined();

    let numberState = insertItem(createInitialDesignerState(), 'heroui.number-input');
    const numberId = lastChildId(numberState);
    numberState = setProp(numberState, numberId, 'min', '1');
    numberState = setProp(numberState, numberId, 'max', '99');
    const numberTsx = generateDesignerTsx(numberState.document, numberState.bindingDefinitions);
    expect(numberTsx).toMatch(/\smin=/);
    expect(numberTsx).toMatch(/\smax=/);
    expect(numberTsx).not.toMatch(/minValue=/);
  });

  it('item 55: slider size removed from Inspector and never emitted', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.slider');
    const nodeId = lastChildId(state);
    expect(collectInspectorFieldKeys(state, nodeId)).not.toContain('size');
    state = setProp(state, nodeId, 'size', 'lg');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('slider legacy size', tsx);
    expect(tsx).not.toMatch(/\ssize=/);
  });

  it('item 56: slider Preview stays uncontrolled — thumb value can change after interaction', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.slider');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'value', 25);
    state = setProp(state, nodeId, 'min', 0);
    state = setProp(state, nodeId, 'max', 100);
    state = setProp(state, nodeId, 'name', 'volume');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, { interactive: true })}
      </>,
    );

    const hidden = container.querySelector('input[name="volume"]') as HTMLInputElement | null;
    expect(hidden).toBeTruthy();
    expect(hidden?.value).toBe('25');

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyUp(slider, { key: 'ArrowRight' });

    expect(Number(hidden?.value)).toBeGreaterThan(25);
  });

  it('items 57/58: date-range exposes isRequired and validates end ≥ start', () => {
    expect(validateDateRangeOrdering('2026-01-20', '2026-01-15')).toBe(
      'End date must be on or after the start date.',
    );
    expect(validateDateRangeOrdering('2026-01-15', '2026-01-20')).toBeNull();

    let orderingState = insertItem(createInitialDesignerState(), 'form.date-range');
    const orderingId = lastChildId(orderingState);
    expect(collectInspectorFieldKeys(orderingState, orderingId)).toContain('isRequired');
    orderingState = setProp(orderingState, orderingId, 'startValue', '2026-01-20');
    orderingState = setProp(orderingState, orderingId, 'endValue', '2026-01-10');
    const onOrderingValidation = vi.fn();
    const { unmount: unmountOrdering } = render(
      <>
        {renderDesignerDocumentPreview(orderingState.document, {
          interactive: true,
          onPreviewFieldValidation: onOrderingValidation,
        })}
      </>,
    );
    const orderingTrigger = screen.getByRole('button', { name: /Calendar/i });
    fireEvent.focus(orderingTrigger);
    fireEvent.blur(orderingTrigger, { relatedTarget: document.body });
    expect(onOrderingValidation).toHaveBeenCalledWith(
      orderingId,
      'End date must be on or after the start date.',
    );
    unmountOrdering();

    let requiredState = insertItem(createInitialDesignerState(), 'form.date-range');
    const requiredId = lastChildId(requiredState);
    requiredState = setProp(requiredState, requiredId, 'isRequired', true);
    const onRequiredValidation = vi.fn();
    render(
      <>
        {renderDesignerDocumentPreview(requiredState.document, {
          interactive: true,
          onPreviewFieldValidation: onRequiredValidation,
        })}
      </>,
    );
    const requiredTrigger = screen.getByRole('button', { name: /Calendar/i });
    fireEvent.focus(requiredTrigger);
    fireEvent.blur(requiredTrigger, { relatedTarget: document.body });
    expect(onRequiredValidation).toHaveBeenCalledWith(requiredId, expect.any(String));
    expect(String(onRequiredValidation.mock.calls.at(-1)?.[1])).toMatch(/required/i);
  });

  it('item 59: date-range startValue/endValue Property Bindings resolve in interactive Preview', () => {
    let state = insertItem(createInitialDesignerState(), 'form.date-range');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'startValue', 'record.startDate');
    state = bindStoreProp(state, nodeId, 'endValue', 'record.endDate');

    const boundProps = resolveDateRangeProps(state.document.nodes[nodeId]!, {
      previewBindings: {
        resolveTextProp: (_node, targetProp, fallback) => {
          if (targetProp === 'startValue') return '2026-03-01';
          if (targetProp === 'endValue') return '2026-03-10';
          return fallback;
        },
      } as never,
    });
    const boundValue = boundProps.defaultValue as { start: { toString(): string }; end: { toString(): string } };
    expect(boundValue.start.toString()).toBe('2026-03-01');
    expect(boundValue.end.toString()).toBe('2026-03-10');

    // Static-only path (no previewBindings) still works for canvas design mode.
    let staticState = insertItem(createInitialDesignerState(), 'form.date-range');
    const staticId = lastChildId(staticState);
    staticState = setProp(staticState, staticId, 'startValue', '2026-01-15');
    staticState = setProp(staticState, staticId, 'endValue', '2026-01-20');
    const staticProps = resolveDateRangeProps(staticState.document.nodes[staticId]!);
    const staticValue = staticProps.defaultValue as { start: { toString(): string }; end: { toString(): string } };
    expect(staticValue.start.toString()).toBe('2026-01-15');
    expect(staticValue.end.toString()).toBe('2026-01-20');
  });

  it('item 60: date-range Inspector exposes minValue/maxValue/granularity/isReadOnly and Export emits them', () => {
    let state = insertItem(createInitialDesignerState(), 'form.date-range');
    const nodeId = lastChildId(state);
    const keys = collectInspectorFieldKeys(state, nodeId);
    expect(keys).toContain('minValue');
    expect(keys).toContain('maxValue');
    expect(keys).toContain('granularity');
    expect(keys).toContain('isReadOnly');

    state = setProp(state, nodeId, 'minValue', '2026-01-01');
    state = setProp(state, nodeId, 'maxValue', '2026-12-31');
    state = setProp(state, nodeId, 'granularity', 'day');
    state = setProp(state, nodeId, 'isReadOnly', true);
    state = setProp(state, nodeId, 'isRequired', true);

    const resolved = resolveDateRangeProps(state.document.nodes[nodeId]!);
    expect(resolved.isReadOnly).toBe(true);
    expect(resolved.isRequired).toBe(true);
    expect(resolved.granularity).toBe('day');
    expect(String(resolved.minValue)).toContain('2026-01-01');
    expect(String(resolved.maxValue)).toContain('2026-12-31');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('date-range constraints', tsx);
    expect(tsx).toContain('DesignerDateRangeField');
    expect(tsx).toContain('minValue={"2026-01-01"}');
    expect(tsx).toContain('maxValue={"2026-12-31"}');
    expect(tsx).toContain('granularity={"day"}');
    expect(tsx).toMatch(/\bisReadOnly\b/);
    expect(tsx).toMatch(/\bisRequired\b/);
  });

  it('item 93: switch Size is exposed and reaches Preview + Export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.switch');
    const nodeId = lastChildId(state);
    expect(collectInspectorFieldKeys(state, nodeId)).toContain('size');
    state = setProp(state, nodeId, 'size', 'lg');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('switch size', tsx);
    expect(tsx).toMatch(/\ssize="lg"/);
  });
});
