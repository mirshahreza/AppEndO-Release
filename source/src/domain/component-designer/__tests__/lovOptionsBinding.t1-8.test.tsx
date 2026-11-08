/**
 * @vitest-environment jsdom
 *
 * Phase T1-8 — LOV / useDesignerOptionItems on segmented-control.
 * Preview wrapper is exercised directly (same ChoiceGroup pattern) so the hook's
 * own API fetch path runs; document-level previewBindings short-circuit is separate.
 *
 * viz.tree-select / viz.cascader / viz.tree-combobox used to share this exact LOV mechanism via
 * a flat "Options" field, but that field silently overrode their correct hierarchical `data`/Viz
 * API binding and could never represent parent/child nesting — removed. Their binding is now
 * covered by vizTreeSelectCascaderComboboxBinding.test.tsx (the Viz "Connect to API" wizard's
 * tree-kind field mapping instead).
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import { createDefaultBindingDefinitions } from '../bindingRegistry';
import { generateDesignerTsx } from '../codegen';
import { DesignerRuntimeSegmentedControl } from '../DesignerRuntimeUniversalWidgets';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import type { RuntimeRenderOptions } from '../runtimeTypes';

const LOV_ENDPOINT = '/api/lov/t1-8-topics';

const createLovBindingDefinitions = () => ({
  ...createDefaultBindingDefinitions(),
  lovs: {
    't1-8-topics': {
      id: 't1-8-topics',
      name: 'T1-8 Topics',
      endpoint: LOV_ENDPOINT,
      returnValue: 'code',
      displayValue: 'title',
    },
  },
});

const bindItemsLov = (state: ReturnType<typeof createInitialDesignerState>, nodeId: string) =>
  designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('items'),
    definition: createPropertyBindingDefinition('items', 'lovData_t1_8', {
      fetchEndpoint: LOV_ENDPOINT,
      lovRef: 't1-8-topics',
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

const runtimeOptions = (bindingDefinitions: ReturnType<typeof createLovBindingDefinitions>): RuntimeRenderOptions => ({
  mode: 'runtime',
  bindingDefinitions,
});

describe('T1-8 LOV options binding (segmented + tree pickers)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  describe.each([
    {
      itemId: 'content.segmented-control' as const,
      renderWidget: (node: ReturnType<typeof createInitialDesignerState>['document']['nodes'][string], options: RuntimeRenderOptions) => (
        <DesignerRuntimeSegmentedControl node={node} options={options} />
      ),
    },
  ])('$itemId', ({ itemId, renderWidget }) => {
    it('shows loading then LOV options from API', async () => {
      let state = createInitialDesignerState();
      state = designerReducer(state, {
        type: 'insert-palette-item',
        itemId,
        parentId: state.document.rootNodeId,
      });
      const nodeId = state.selectedNodeId!;
      state = bindItemsLov(state, nodeId);
      const bindingDefinitions = createLovBindingDefinitions();
      const node = state.document.nodes[nodeId]!;

      const release = mockPendingLovFetch({
        items: [
          { code: '104.1', title: 'Support' },
          { code: '104.2', title: 'Sales' },
        ],
      });

      render(renderWidget(node, runtimeOptions(bindingDefinitions)));

      expect(screen.getByText('Loading options…')).toBeTruthy();

      release();

      await waitFor(() => {
        expect(screen.queryByText('Loading options…')).toBeNull();
      });

      await waitFor(() => {
        expect(screen.getByText('Support')).toBeTruthy();
        expect(screen.getByText('Sales')).toBeTruthy();
      });
    });

    it('emits mapped optionItems / items in export when LOV is bound', () => {
      let state = createInitialDesignerState();
      state = designerReducer(state, {
        type: 'insert-palette-item',
        itemId,
        parentId: state.document.rootNodeId,
      });
      const nodeId = state.selectedNodeId!;
      state = bindItemsLov(state, nodeId);
      const bindingDefinitions = createLovBindingDefinitions();

      const tsx = generateDesignerTsx(state.document, bindingDefinitions);

      expect(tsx).toContain('mapDesignerLovItems');
      expect(tsx).toContain('DesignerUniversalSegmentedControl');
      expect(tsx).toMatch(/items=\{mapDesignerLovItems/);
    });
  });

  it('keeps static Day/Week/Month for segmented-control without LOV', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'content.segmented-control',
      parentId: state.document.rootNodeId,
    });

    const preview = renderDesignerDocumentPreview(state.document);
    render(<>{preview}</>);

    expect(screen.getByText('Day')).toBeTruthy();
    expect(screen.getByText('Week')).toBeTruthy();
    expect(screen.getByText('Month')).toBeTruthy();
  });
});
