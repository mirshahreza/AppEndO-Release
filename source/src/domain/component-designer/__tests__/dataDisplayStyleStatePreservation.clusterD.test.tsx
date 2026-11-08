/**
 * @vitest-environment jsdom
 * Cluster D — heroui-data-display: verify the "Style panel edit resets internal widget
 * state" bug class (previously found + fixed for heroui.data-grid/app-table-grid, see
 * T1-16) does NOT also affect heroui.listbox selection, heroui.accordion-item expansion,
 * or heroui.pagination page state. These are re-verified here rather than assumed, per
 * audit instructions — all three pass against the current code (no bug found), which is
 * itself the useful finding: they use the same "local useState, same component instance
 * across re-renders" pattern already proven safe for Tabs/Carousel/Repeater/TreeView.
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerAction, DesignerState } from '../types';

type PreviewHarnessApi = {
  dispatch: React.Dispatch<DesignerAction>;
  getState: () => DesignerState;
};

const StatefulPreviewHarness: React.FC<{
  initialState: DesignerState;
  apiRef: React.MutableRefObject<PreviewHarnessApi | null>;
}> = ({ initialState, apiRef }) => {
  const [state, dispatch] = React.useReducer(designerReducer, initialState);
  apiRef.current = { dispatch, getState: () => state };
  return (
    <>
      {renderDesignerDocumentPreview(state.document, {
        bindingDefinitions: state.bindingDefinitions,
        interactive: true,
      })}
    </>
  );
};

const renderStatefulPreview = (initialState: DesignerState) => {
  const apiRef: React.MutableRefObject<PreviewHarnessApi | null> = { current: null };
  render(<StatefulPreviewHarness initialState={initialState} apiRef={apiRef} />);
  if (!apiRef.current) {
    throw new Error('Preview harness failed to initialize');
  }
  return apiRef.current;
};

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

describe('Cluster D — heroui-data-display internal state survives visual Style edits', () => {
  afterEach(() => cleanup());

  it('heroui.listbox keeps selected option after a Style className change', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.listbox');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'items',
      value: JSON.stringify([
        { id: 'alpha', textValue: 'Alpha option' },
        { id: 'beta', textValue: 'Beta option' },
      ]),
    });

    const harness = renderStatefulPreview(state);

    fireEvent.click(await screen.findByRole('option', { name: 'Beta option' }));
    expect(screen.getByRole('option', { name: 'Beta option' })).toHaveAttribute('aria-selected', 'true');

    harness.dispatch({
      type: 'set-node-prop',
      nodeId,
      key: 'className',
      value: 'space-y-1 rounded-md border-2 border-indigo-400 bg-white p-2',
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });

    expect(screen.getByRole('option', { name: 'Beta option' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Alpha option' })).toHaveAttribute('aria-selected', 'false');
  });

  it('heroui.accordion-item keeps expanded/collapsed state after a Style className change', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.accordion-item');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'FAQ Section' });
    state = insertItem(state, 'html.text', nodeId);
    const textId = lastChildId(state, nodeId);
    state = designerReducer(state, { type: 'set-node-prop', nodeId: textId, key: 'text', value: 'Panel body content' });

    const harness = renderStatefulPreview(state);

    const trigger = await screen.findByRole('button', { name: /FAQ Section/i });
    // Collapse it (interactive preview starts uncontrolled/open depending on default state).
    fireEvent.click(trigger);
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });
    const wasVisibleAfterFirstClick = screen.queryByText('Panel body content') !== null;

    harness.dispatch({
      type: 'set-node-prop',
      nodeId,
      key: 'className',
      value: 'rounded-lg border-2 border-indigo-400 bg-white p-3',
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });

    const stillVisibleAfterStyleEdit = screen.queryByText('Panel body content') !== null;
    expect(stillVisibleAfterStyleEdit).toBe(wasVisibleAfterFirstClick);
  });

  it('heroui.pagination keeps current page after a Style className change', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.pagination');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'total', value: 5 });

    const harness = renderStatefulPreview(state);

    const nextButton = await screen.findByText(/Page 1/).then(
      () => document.querySelector('[data-slot="pagination-next"]') as HTMLElement,
    );
    expect(nextButton).toBeTruthy();
    fireEvent.click(nextButton);
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });
    expect(screen.getByText(/Page 2/)).toBeInTheDocument();

    harness.dispatch({
      type: 'set-node-prop',
      nodeId,
      key: 'className',
      value: 'inline-flex items-center gap-2 rounded-md border-2 border-indigo-400 bg-white px-2 py-1',
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });

    expect(screen.getByText(/Page 2/)).toBeInTheDocument();
  });
});
