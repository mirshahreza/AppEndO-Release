/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { generateDesignerTsx } from '../codegen';
import {
  createEventBindingDefinition,
  eventBindingKeyForEvent,
  resolveNodeEventBindingTargets,
} from '../bindingEngine';

describe('T1-3 Pagination onPageChange wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('exposes onPageChange as an Interaction binding target', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.pagination',
      parentId: state.document.rootNodeId,
    });
    const node = state.document.nodes[state.document.nodes[state.document.rootNodeId].children[0]!];

    expect(resolveNodeEventBindingTargets(node)).toEqual(['onPageChange']);
  });

  it('emits Previous/Next onPress wired to onPageChange in export TSX', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.pagination',
      parentId: state.document.rootNodeId,
    });
    const paginationId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: paginationId,
      key: 'page',
      value: 2,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: paginationId,
      key: 'total',
      value: 5,
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: paginationId,
      bindingKey: eventBindingKeyForEvent('onPageChange'),
      definition: createEventBindingDefinition('onPageChange', '/api/v1/pages', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Pagination');
    expect(tsx).toMatch(/const handleonPageChange_/);
    expect(tsx).not.toMatch(/<Pagination[^>]*onPageChange=\{/);
    expect(tsx).toContain('Pagination.Previous onPress={() => handleonPageChange_');
    expect(tsx).toContain('Math.max(1, 2 - 1)');
    expect(tsx).toContain('Pagination.Next onPress={() => handleonPageChange_');
    expect(tsx).toContain('Math.min(5, 2 + 1)');
  });

  it('clicks Next/Previous and fires onPageChange with the correct page number', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.pagination',
      parentId: state.document.rootNodeId,
    });
    const paginationId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: paginationId,
      key: 'page',
      value: 2,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: paginationId,
      key: 'total',
      value: 5,
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: paginationId,
      bindingKey: eventBindingKeyForEvent('onPageChange'),
      definition: createEventBindingDefinition('onPageChange', '', 'POST', undefined, {
        storeWritePath: 'pagination.page',
      }),
    });

    const storeWrites: Array<{ path: string; value: unknown }> = [];
    let designerStore: Record<string, unknown> = {};

    const PreviewHarness: React.FC = () => {
      const [store, setStore] = React.useState<Record<string, unknown>>({});
      designerStore = store;
      return (
        <>
          {renderDesignerDocumentPreview(state.document, {
            interactive: true,
            bindingDefinitions: state.bindingDefinitions,
            designerStore: store,
            onStoreChange: (updater) => {
              setStore((current) => {
                const next = typeof updater === 'function' ? updater(current) : updater;
                const nextPage = (next as { pagination?: { page?: unknown } }).pagination?.page;
                const prevPage = (current as { pagination?: { page?: unknown } }).pagination?.page;
                if (nextPage !== prevPage) {
                  storeWrites.push({ path: 'pagination.page', value: nextPage });
                }
                return next;
              });
            },
          })}
        </>
      );
    };

    render(<PreviewHarness />);

    const shell = document.querySelector('[data-designer-component="heroui.pagination"]');
    expect(shell).not.toBeNull();
    expect(within(shell as HTMLElement).getByText('Page 2 · 5 total')).toBeTruthy();

    const next = shell!.querySelector('[data-slot="pagination-next"]') as HTMLElement | null;
    expect(next).not.toBeNull();
    fireEvent.click(next!);

    await vi.waitFor(() => {
      expect(storeWrites.some((entry) => entry.value === 3)).toBe(true);
    });
    expect(within(shell as HTMLElement).getByText('Page 3 · 5 total')).toBeTruthy();
    expect((designerStore as { pagination?: { page?: unknown } }).pagination?.page).toBe(3);

    const previous = shell!.querySelector('[data-slot="pagination-previous"]') as HTMLElement | null;
    expect(previous).not.toBeNull();
    fireEvent.click(previous!);

    await vi.waitFor(() => {
      expect(storeWrites.some((entry) => entry.value === 2)).toBe(true);
    });
    expect(within(shell as HTMLElement).getByText('Page 2 · 5 total')).toBeTruthy();
    expect((designerStore as { pagination?: { page?: unknown } }).pagination?.page).toBe(2);
  });
});
