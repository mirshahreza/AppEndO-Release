/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CultureProvider } from '../../../core/culture/CultureContext';
import {
  createGridListResourceBindingDefinition,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from '../bindingGridEngine';
import { normalizeDesignerGridToolbarConfig } from '../designerGridToolbarConfig';
import { DesignerDocumentPreview } from '../designerRuntimePreview';
import { __resetHydrationCacheForTests } from '../designerPreviewHydrationCache';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';
import * as appFeedbackToast from '../../../shared/ui/appFeedbackToast';

/**
 * Independent verification of parity audit item 0 (section ب) / phase 10 task:
 * The audit originally claimed the separate Preview page
 * (`ComponentDesignerOutlinePreviewPage` → `DesignerDocumentPreview`) never refetched
 * on toolbar search because `refreshDataSource` was "not implemented". A later probe
 * suggested `designerRuntimePreview.tsx` already hydrates reactively via
 * `dynamicHydrationStoreKey` + `fetchDesignerHydrationData`. This permanent test locks
 * the real behavior: typing in the grid toolbar search must trigger a second fetch
 * with the correct query param (Preview path uses `resolveHydrationTargetUrl`, NOT
 * Export's `resolveBindingUrl` — independent of audit item 28 / phase 1).
 */

afterEach(() => {
  cleanup();
});

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const buildBoundUsersGridState = () => {
  let state = insert(createInitialDesignerState(), 'heroui.app-table-grid');
  const gridNodeId = lastChild(state);
  state = designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'users',
    dataSource: {
      id: 'users',
      name: 'Users',
      endpoint: '/api/users',
      fields: ['id', 'name', 'email'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/users' } },
    },
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: gridNodeId,
    bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
    definition: createGridListResourceBindingDefinition('users'),
  });
  const toolbarConfig = normalizeDesignerGridToolbarConfig({
    enabled: true,
    search: {
      enabled: true,
      placeholder: 'Search users…',
      storePath: 'gridToolbar.search',
      apiParam: 'search',
      debounceMs: 50,
    },
    refresh: { enabled: true },
    serverQuery: { enabled: true },
  } as never);
  state = designerReducer(state, { type: 'set-grid-toolbar-config', nodeId: gridNodeId, config: toolbarConfig });
  return { state, gridNodeId };
};

describe('DesignerDocumentPreview hydration refresh (parity audit item 0b verification)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetHydrationCacheForTests();
  });

  it('toolbar search typing triggers a second fetch with the search query param', async () => {
    const { state } = buildBoundUsersGridState();
    const requestedUrls: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({
        success: true,
        data: [{ id: 1, name: 'Alice', email: 'a@example.com' }],
      }), { status: 200 });
    });

    render(
      <CultureProvider cultureId="us">
        <DesignerDocumentPreview
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          interactive
        />
      </CultureProvider>,
    );

    await waitFor(() => {
      expect(requestedUrls.length).toBeGreaterThanOrEqual(1);
    });

    const initialFetchCount = requestedUrls.length;
    expect(requestedUrls.some((url) => url.includes('/api/users'))).toBe(true);
    expect(requestedUrls.every((url) => !url.includes('search=alice'))).toBe(true);

    const searchInput = await screen.findByRole('textbox', { name: /search users/i });
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    });

    await waitFor(() => {
      expect(requestedUrls.length).toBeGreaterThan(initialFetchCount);
      expect(requestedUrls.some((url) => url.includes('search=alice'))).toBe(true);
    }, { timeout: 3000 });
  });

  it('toolbar refresh keeps visible rows and does not show the grid error state', async () => {
    const { state } = buildBoundUsersGridState();
    const gridNodeId = lastChild(state);
    state.document.nodes[gridNodeId]!.props.errorContent = 'Could not load records.';
    let fetchCount = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      fetchCount += 1;
      const url = String(input);
      if (fetchCount === 1) {
        return new Response(JSON.stringify({
          success: true,
          data: [{ id: 1, name: 'Alice', email: 'a@example.com' }],
        }), { status: 200 });
      }

      expect(url).toContain('/api/users');
      expect(url).toContain('noCache=1');
      return new Response(JSON.stringify({
        success: true,
        data: [{ id: 1, name: 'Alice', email: 'a@example.com' }],
      }), { status: 200 });
    });

    render(
      <CultureProvider cultureId="us">
        <DesignerDocumentPreview
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          interactive
        />
      </CultureProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(fetchCount).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Alice')).toBeTruthy();
      expect(screen.queryByText('Could not load records.')).toBeNull();
    });
  });

  it('toolbar refresh surfaces API failures without replacing existing rows', async () => {
    const { state } = buildBoundUsersGridState();
    let fetchCount = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return new Response(JSON.stringify({
          success: true,
          data: [{ id: 1, name: 'Alice', email: 'a@example.com' }],
        }), { status: 200 });
      }

      return new Response(JSON.stringify({ message: 'Server unavailable' }), { status: 503 });
    });

    const toastSpy = vi.spyOn(appFeedbackToast, 'showAppFeedbackToast').mockImplementation(() => undefined);

    render(
      <CultureProvider cultureId="us">
        <DesignerDocumentPreview
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          interactive
        />
      </CultureProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(fetchCount).toBeGreaterThanOrEqual(2);
      expect(toastSpy).toHaveBeenCalled();
      expect(screen.getByText('Alice')).toBeTruthy();
      expect(screen.queryByText('Could not load records.')).toBeNull();
    });

    toastSpy.mockRestore();
  });

  it('collects grid list hydration targets with search queryParams wired from toolbar config', () => {
    const { state, gridNodeId } = buildBoundUsersGridState();
    const binding = state.document.nodes[gridNodeId]!.binding[GRID_LIST_RESOURCE_BINDING_KEY];
    expect(binding?.queryParams?.search).toBe('gridToolbar.search');
  });
});
