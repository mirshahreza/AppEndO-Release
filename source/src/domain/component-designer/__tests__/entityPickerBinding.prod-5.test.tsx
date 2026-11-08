/**
 * @vitest-environment jsdom
 *
 * Phase PROD-5 — Entity Picker binding parity (Engine vs compiled Export codegen).
 * Reproduces the T1-18 finding: standalone entity-picker export referenced
 * useEntityPickerOptions without emitting runtime helpers.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { bindingCodegenRequiresRuntimeHelpers } from '../bindingCodegen';
import { buildAllBindingParityFixtures } from '../bindingParity/fixtures';
import {
  evaluateEngineEntityPickerNormalizer,
  evaluateExportEntityPickerNormalizer,
  exportTsxIncludesEntityPickerRuntimeHelpers,
} from '../bindingParity/entityPickerCodegenEval';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createInitialDesignerState, designerReducer } from '../state';

const createStandaloneEntityPickerState = () => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'heroui.entity-picker',
    parentId: state.document.rootNodeId,
  });
  const nodeId = state.selectedNodeId!;
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId,
    key: 'entityRef',
    value: 'users',
  });
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId,
    key: 'searchParam',
    value: 'search',
  });
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId,
    key: 'label',
    value: 'Assignee',
  });
  return { state, nodeId };
};

const entityPickerFixture = () =>
  buildAllBindingParityFixtures().find((fixture) => fixture.capability === 'EntityPicker')!;

describe('PROD-5 — Entity Picker binding parity (Engine vs Export codegen)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('requires runtime helpers for a standalone entity-picker document (no other bindings)', () => {
    const { state } = createStandaloneEntityPickerState();

    expect(bindingCodegenRequiresRuntimeHelpers(state.document, state.bindingDefinitions)).toBe(true);
  });

  it('reproduces the export gap: hook usage without helper definitions would ReferenceError at runtime', () => {
    const { state } = createStandaloneEntityPickerState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain('useEntityPickerOptions');
    expect(exportTsxIncludesEntityPickerRuntimeHelpers(tsx)).toBe(true);

    const helperDefIndex = tsx.indexOf('function useEntityPickerOptions');
    const hookUseIndex = tsx.lastIndexOf('useEntityPickerOptions(');
    expect(helperDefIndex).toBeGreaterThan(-1);
    expect(helperDefIndex).toBeLessThan(hookUseIndex);
  });

  it('matches engine and compiled-export normalizers for the entity-picker parity fixture payload', () => {
    const fixture = entityPickerFixture();
    const tsx = generateDesignerTsx(fixture.state.document, fixture.state.bindingDefinitions);

    const engineData = evaluateEngineEntityPickerNormalizer(fixture.mockApiPayload);
    const codegenData = evaluateExportEntityPickerNormalizer(tsx, fixture.mockApiPayload);

    expect(codegenData).toEqual(engineData);
    expect(codegenData).toEqual([
      { id: 'u1', textValue: 'Alice' },
      { id: 'u2', textValue: 'Bob' },
      { id: 'u3', textValue: 'Carol' },
    ]);
  });

  it('normalizes nested API payload shapes identically in engine and export codegen', () => {
    const { state } = createStandaloneEntityPickerState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    const payloads = [
      { items: [{ id: 'a', name: 'Alpha' }] },
      { results: [{ value: 'b', label: 'Beta' }] },
      { data: [{ id: 'c', textValue: 'Gamma' }] },
      [{ id: 'd', name: 'Delta' }],
    ];

    for (const payload of payloads) {
      const engineData = evaluateEngineEntityPickerNormalizer(payload);
      const codegenData = evaluateExportEntityPickerNormalizer(tsx, payload);
      expect(codegenData).toEqual(engineData);
    }
  });

  it('renders entity picker in canvas preview DOM with configured label', async () => {
    const { state } = createStandaloneEntityPickerState();

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);

    await waitFor(() => {
      expect(container.querySelector('[data-designer-component="heroui.entity-picker"]')).toBeTruthy();
      expect(container.textContent).toContain('Assignee');
    });
  });
});
