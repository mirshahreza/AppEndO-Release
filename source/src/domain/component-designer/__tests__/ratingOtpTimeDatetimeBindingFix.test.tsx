/**
 * @vitest-environment jsdom
 * form.rating / form.otp-input / form.time-input / form.datetime-input — Rating's value was
 * display-only (no way to pick a rating) and had no onChange target; OTP's value field was 100%
 * dead (never read anywhere); Time/DateTime already worked in canvas but baked `value` as a
 * static literal and emitted no onChange at all in exported/published code. Fixed in
 * DesignerRuntimeUniversalWidgets.tsx / designerUniversalRuntime.tsx / tsxUniversalPalette.ts /
 * bindingEngine.ts.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DesignerUniversalOtpInput, DesignerUniversalRating } from '../DesignerRuntimeUniversalWidgets';
import {
  createEventBindingDefinition,
  createPropertyBindingDefinition,
  eventBindingKeyForEvent,
  propertyBindingKeyForProp,
  resolveNodeEventBindingTargets,
} from '../bindingEngine';
import { generateDesignerTsx } from '../codegen';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

afterEach(() => cleanup());

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

describe('DesignerUniversalRating', () => {
  it('clicking a star fires onChange with its 1-based value', () => {
    const onChange = vi.fn();
    render(<DesignerUniversalRating defaultValue={2} max={5} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Rate 4 of 5'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as { target: { value: string } }).target.value).toBe('4');
  });
});

describe('DesignerUniversalOtpInput', () => {
  it('typing a digit fires onChange with the combined value', () => {
    const onChange = vi.fn();
    render(<DesignerUniversalOtpInput length={4} defaultValue="12" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Digit 3 of 4'), { target: { value: '9' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as { target: { value: string } }).target.value).toBe('129');
  });

  // Bug found: `digits` was recomputed fresh from the (never-changing) `defaultValue` prop on
  // every render, so each keystroke's onChange closure captured the same stale array — typing a
  // SECOND digit always discarded the first instead of combining with it.
  it('preserves earlier digits when typing into multiple boxes in sequence', () => {
    const onChange = vi.fn();
    render(<DesignerUniversalOtpInput length={4} defaultValue="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Digit 1 of 4'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Digit 2 of 4'), { target: { value: '5' } });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect((onChange.mock.calls[0][0] as { target: { value: string } }).target.value).toBe('1');
    expect((onChange.mock.calls[1][0] as { target: { value: string } }).target.value).toBe('15');
  });
});

describe.each(['form.rating', 'form.otp-input', 'form.time-input', 'form.datetime-input'] as const)(
  '%s binding + export',
  (itemId) => {
    it('registers onChange as an event-binding target', () => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state);
      expect(resolveNodeEventBindingTargets(state.document.nodes[nodeId]!)).toContain('onChange');
    });

    it('exports TSX with a bound value attribute and a real onChange handler', () => {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state);
      state = designerReducer(state, {
        type: 'set-node-binding',
        nodeId,
        bindingKey: propertyBindingKeyForProp('value'),
        definition: createPropertyBindingDefinition('value', 'record.value'),
      });
      state = designerReducer(state, {
        type: 'set-node-binding',
        nodeId,
        bindingKey: eventBindingKeyForEvent('onChange'),
        definition: createEventBindingDefinition('onChange', '/api/v1/value', 'POST'),
      });

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toMatch(/\sdefaultValue=\{[^}]*record[^}]*\}/);
      expect(tsx).toMatch(/onChange=\{handleonChange_/);
    });
  },
);

describe('dead Inspector field cleanup (parity audit item P3.20)', () => {
  const fieldKeysFor = (state: DesignerState, nodeId: string): Set<string> =>
    new Set(resolveInspectorFieldSections(state.document.nodes[nodeId]).flatMap((s) => s.fields.map((f) => f.key)));

  it('form.rating: keeps Max (real), drops the dead Length field', () => {
    const state = insertItem(createInitialDesignerState(), 'form.rating');
    const keys = fieldKeysFor(state, lastChildId(state));
    expect(keys.has('max')).toBe(true);
    expect(keys.has('length')).toBe(false);
  });

  it('form.otp-input: keeps Length (real), drops the dead Max field', () => {
    const state = insertItem(createInitialDesignerState(), 'form.otp-input');
    const keys = fieldKeysFor(state, lastChildId(state));
    expect(keys.has('length')).toBe(true);
    expect(keys.has('max')).toBe(false);
  });

  it.each(['form.time-input', 'form.datetime-input'] as const)(
    '%s: keeps Max (real, phase 40 min/max enrichment), drops the dead Length field',
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const keys = fieldKeysFor(state, lastChildId(state));
      expect(keys.has('max')).toBe(true);
      expect(keys.has('length')).toBe(false);
      expect(keys.has('label')).toBe(true);
      expect(keys.has('value')).toBe(true);
    },
  );
});
