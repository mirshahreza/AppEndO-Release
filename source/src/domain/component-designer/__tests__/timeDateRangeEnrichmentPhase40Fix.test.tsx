/**
 * Bug found (gap-analysis #9/#10 / phase 40): form.time-input and form.datetime-input only exposed
 * label+value (2 fields) vs ~24 on heroui.date-picker; form.date-range lacked presets and timeZone.
 * Fixed in inspectorPaletteFields.ts, DesignerRuntimeUniversalWidgets.tsx, designerUniversalRuntime.tsx,
 * tsxUniversalPalette.ts, DesignerDateRangeField.tsx, runtimePhase2Palette.tsx, tsxPhase2Palette.ts,
 * dateRangePresetsEngine.ts, runtimeNodeProps.ts.
 */
/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import {
  computeDesignerDateRangePreset,
  formatIsoDay,
} from '../dateRangePresetsEngine';
import { validateDesignerFieldNode } from '../previewFieldValidation';
import { DesignerDateRangeField } from '../DesignerDateRangeField';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: state.document.rootNodeId });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId];
  return parent.children[parent.children.length - 1] as string;
};

const setProp = (state: DesignerState, nodeId: string, key: string, value: unknown): DesignerState =>
  designerReducer(state, { type: 'set-node-prop', nodeId, key, value });

const collectInspectorFieldKeys = (state: DesignerState, nodeId: string): string[] =>
  resolveInspectorFieldSections(state.document.nodes[nodeId]!).flatMap((section) => section.fields.map((field) => field.key));

afterEach(() => cleanup());

describe('40 — Time/DateTime/Date-Range enrichment', () => {
  it('exposes min/max/step/hourCycle/isRequired/isInvalid fields for time-input and datetime-input', () => {
    let timeState = insertItem(createInitialDesignerState(), 'form.time-input');
    const timeId = lastChildId(timeState);
    const timeKeys = collectInspectorFieldKeys(timeState, timeId);
    expect(timeKeys).toEqual(expect.arrayContaining(['min', 'max', 'step', 'hourCycle', 'isRequired', 'isDisabled', 'isInvalid', 'errorMessage', 'granularity']));

    let datetimeState = insertItem(createInitialDesignerState(), 'form.datetime-input');
    const datetimeId = lastChildId(datetimeState);
    const datetimeKeys = collectInspectorFieldKeys(datetimeState, datetimeId);
    expect(datetimeKeys).toEqual(expect.arrayContaining(['min', 'max', 'timeZone', 'hourCycle', 'isRequired', 'isInvalid']));
  });

  it('isRequired on time-input produces validation error when value is empty', () => {
    const message = validateDesignerFieldNode(
      { _designerPaletteItemId: 'form.time-input', isRequired: true },
      '',
    );
    expect(message).toBe('This field is required.');
  });

  it('time-input runtime applies min/max/step and shows required validation on blur', () => {
    let state = insertItem(createInitialDesignerState(), 'form.time-input');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'value', '');
    state = setProp(state, nodeId, 'isRequired', true);
    state = setProp(state, nodeId, 'min', '09:00');
    state = setProp(state, nodeId, 'max', '17:00');
    state = setProp(state, nodeId, 'step', '300');

    const fieldErrors: Record<string, string> = {};
    render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          onPreviewFieldValidation: (id, message) => {
            if (message) {
              fieldErrors[id] = message;
            } else {
              delete fieldErrors[id];
            }
          },
        })}
      </>,
    );

    const input = document.querySelector('input[type="time"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.min).toBe('09:00');
    expect(input.max).toBe('17:00');
    expect(input.step).toBe('300');
    expect(input.required).toBe(true);

    fireEvent.blur(input);
    expect(fieldErrors[nodeId]).toBe('This field is required.');
  });

  it('export emits enriched time-input constraint attributes', () => {
    let state = insertItem(createInitialDesignerState(), 'form.time-input');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'min', '08:00');
    state = setProp(state, nodeId, 'max', '18:00');
    state = setProp(state, nodeId, 'step', '900');
    state = setProp(state, nodeId, 'hourCycle', 'h12');
    state = setProp(state, nodeId, 'isRequired', true);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('time-input enriched export', tsx);
    expect(tsx).toContain('DesignerUniversalTimeInput');
    expect(tsx).toMatch(/min="08:00"/);
    expect(tsx).toMatch(/max="18:00"/);
    expect(tsx).toMatch(/step=\{900\}/);
    expect(tsx).toMatch(/hourCycle="h12"/);
    expect(tsx).toContain('isRequired');
  });

  it('date-range exposes presets and timeZone in Inspector', () => {
    let state = insertItem(createInitialDesignerState(), 'form.date-range');
    const nodeId = lastChildId(state);
    const keys = collectInspectorFieldKeys(state, nodeId);
    expect(keys).toEqual(expect.arrayContaining(['presets', 'timeZone']));
  });

  it('computeDesignerDateRangePreset last7Days returns a 7-day inclusive window ending today', () => {
    const reference = new Date(2026, 6, 29);
    const range = computeDesignerDateRangePreset('last7Days', reference);
    expect(range).toEqual({
      start: '2026-07-23',
      end: formatIsoDay(reference),
    });
  });

  it('clicking Last 7 days preset sets the correct start/end range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 29, 12, 0, 0));

    const presetsJson = JSON.stringify([
      { id: '1', label: 'Last 7 days', rangeFn: 'last7Days' },
    ]);
    const changes: Array<{ start: string; end: string }> = [];

    render(
      <DesignerDateRangeField
        presetsJson={presetsJson}
        onChange={(start, end) => {
          changes.push({ start, end });
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    expect(changes.at(-1)).toEqual({ start: '2026-07-23', end: '2026-07-29' });

    vi.useRealTimers();
  });

  it('date-range export uses DesignerDateRangeField with presetsJson', () => {
    const presetsJson = JSON.stringify([{ id: '1', label: 'Today', rangeFn: 'today' }]);
    let state = insertItem(createInitialDesignerState(), 'form.date-range');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'presets', presetsJson);
    state = setProp(state, nodeId, 'timeZone', 'UTC');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('date-range presets export', tsx);
    expect(tsx).toContain('DesignerDateRangeField');
    expect(tsx).toContain('presetsJson=');
    expect(tsx).toContain('timeZone={"UTC"}');
  });

  it('legacy time-input without new props keeps prior default export shape', () => {
    let state = insertItem(createInitialDesignerState(), 'form.time-input');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('time-input legacy export', tsx);
    expect(tsx).toContain('defaultValue="09:30"');
    expect(tsx).not.toMatch(/\smin=/);
    expect(tsx).not.toMatch(/\smax=/);
  });
});
