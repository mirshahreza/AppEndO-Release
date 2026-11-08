/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import {
  createGridListResourceBindingDefinition,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from '../bindingGridEngine';
import { serializeDesignerGridToolbarConfig, USERS_GRID_TOOLBAR_PRESET } from '../designerGridToolbarConfig';
import { DesignerRuntimeAppTableGrid } from '../DesignerRuntimeAppTableGrid';
import type { DesignerNode } from '../types';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';
import { APP_TABLE_GRID_PALETTE_ITEM_ID } from '../designerDataGridColumns';
import { renderHeroUiStructuralNode } from '../runtimeRenderer';

afterEach(() => {
  cleanup();
});

const insertBoundAppTableGrid = (toolbar = USERS_GRID_TOOLBAR_PRESET) => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'heroui.app-table-grid',
    parentId: state.document.rootNodeId,
  });
  const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

  state = {
    ...state,
    document: {
      ...state.document,
      nodes: {
        ...state.document.nodes,
        [gridNodeId]: {
          ...state.document.nodes[gridNodeId]!,
          binding: {
            [GRID_LIST_RESOURCE_BINDING_KEY]: createGridListResourceBindingDefinition('usersList'),
          },
          props: {
            ...state.document.nodes[gridNodeId]!.props,
            gridQueryMode: 'server',
            toolbarConfig: serializeDesignerGridToolbarConfig(toolbar),
          },
        },
      },
    },
    bindingDefinitions: {
      ...state.bindingDefinitions,
      dataSources: {
        ...state.bindingDefinitions.dataSources,
        usersList: {
          id: 'usersList',
          label: 'Users',
          method: 'GET',
          path: '/api/users',
          fields: ['id', 'email', 'roles'],
        },
      },
    },
  };

  return { state, gridNodeId };
};

describe('toolbar server query store sync stability', () => {
  it('does not exceed update depth when interactive preview syncs server query', async () => {
    const { state, gridNodeId } = insertBoundAppTableGrid();
    let storeUpdates = 0;

    const PreviewHost: React.FC = () => {
      const [store, setStore] = React.useState<Record<string, unknown>>({
        gridQuery: { page: 1, pageSize: 15, sortBy: 'email', sortDir: 'asc' },
        gridToolbar: { search: '', roleNames: '' },
      });

      return (
        <>
          {renderDesignerDocumentPreview(state.document, {
            bindingDefinitions: state.bindingDefinitions,
            hydrationData: {
              [`gridList_${gridNodeId}`]: [{ id: 1, email: 'a@b.com', roles: ['USER'] }],
            },
            designerStore: store,
            onStoreChange: (updater) => {
              storeUpdates += 1;
              setStore((current) => (typeof updater === 'function' ? updater(current) : updater));
            },
            interactive: true,
          })}
        </>
      );
    };

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<PreviewHost />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    });

    const depthExceeded = consoleError.mock.calls.some((call) =>
      call.some((arg) => String(arg).includes('Maximum update depth')),
    );
    consoleError.mockRestore();

    expect(depthExceeded).toBe(false);
    expect(storeUpdates).toBeLessThan(20);
    expect(document.querySelector('[data-designer-component="heroui.app-table-grid"]')).toBeTruthy();
  });

  it('DesignerRuntimeAppTableGrid with toolbar+serverQuery does not loop in runtime', async () => {
    const { state, gridNodeId } = insertBoundAppTableGrid();
    const node = state.document.nodes[gridNodeId]! as DesignerNode;
    let patchCount = 0;

    const Host: React.FC = () => {
      const [store, setStore] = React.useState<Record<string, unknown>>({
        gridQuery: { page: 1, pageSize: 15, sortBy: '', sortDir: '' },
        gridToolbar: { search: '', roleNames: '' },
      });
      const [, setTick] = React.useState(0);

      return (
        <DesignerRuntimeAppTableGrid
          node={{
            ...node,
            props: {
              ...node.props,
              [DESIGNER_PALETTE_ITEM_ID_PROP]: APP_TABLE_GRID_PALETTE_ITEM_ID,
            },
          }}
          options={{
            mode: 'runtime',
            designerStore: store,
            designerDocument: state.document,
            bindingDefinitions: state.bindingDefinitions,
            gridListBound: true,
            gridRows: [{ id: 1, email: 'a@b.com', roles: ['USER'] }],
            previewEvents: {
              document: state.document,
              bindingDefinitions: state.bindingDefinitions,
              bindingContext: { store, data: {} },
              designerStore: store,
              isSubmitting: false,
              mutationCallbacks: {},
              patchStore: (path, value) => {
                patchCount += 1;
                setStore((current) => {
                  const segments = path.split('.');
                  const next = { ...current };
                  let cursor: Record<string, unknown> = next;
                  for (let i = 0; i < segments.length - 1; i += 1) {
                    const key = segments[i]!;
                    const existing = cursor[key];
                    const branch = existing && typeof existing === 'object' && !Array.isArray(existing)
                      ? { ...(existing as Record<string, unknown>) }
                      : {};
                    cursor[key] = branch;
                    cursor = branch;
                  }
                  cursor[segments[segments.length - 1]!] = value;
                  return next;
                });
                setTick((n) => n + 1);
              },
              patchStoreState: (updater) => {
                patchCount += 1;
                setStore(updater);
                setTick((n) => n + 1);
              },
            },
          }}
        />
      );
    };

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Host />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    });

    const depthExceeded = consoleError.mock.calls.some((call) =>
      call.some((arg) => String(arg).includes('Maximum update depth')),
    );
    consoleError.mockRestore();

    expect(depthExceeded).toBe(false);
    expect(patchCount).toBeLessThan(30);
  });

  it('design mode enable-only toolbar does not crash or loop', async () => {
    const { state, gridNodeId } = insertBoundAppTableGrid({ enabled: true });
    const node = state.document.nodes[gridNodeId]!;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <>
        {renderHeroUiStructuralNode(node, {
          mode: 'design',
          designerDocument: state.document,
          bindingDefinitions: state.bindingDefinitions,
          gridListBound: true,
          gridRows: [{ id: 1, email: 'a@b.com' }],
        })}
      </>,
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });

    const depthExceeded = consoleError.mock.calls.some((call) =>
      call.some((arg) => String(arg).includes('Maximum update depth')),
    );
    consoleError.mockRestore();

    expect(depthExceeded).toBe(false);
    expect(document.querySelector('[data-designer-component="heroui.app-table-grid"]')).toBeTruthy();
  });
});
