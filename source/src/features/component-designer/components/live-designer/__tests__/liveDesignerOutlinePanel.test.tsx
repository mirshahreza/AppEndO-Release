// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  createInitialDesignerState,
  designerReducer,
} from '../../../../../domain/component-designer/state';
import { LiveDesignerOutlinePanel } from '../LiveDesignerOutlinePanel';
import {
  endLiveDesignerExternalDrag,
  getLiveDesignerExternalDrag,
} from '../liveDesignerDragSession';

afterEach(() => {
  endLiveDesignerExternalDrag();
  cleanup();
});

function buildDocument() {
  let state = createInitialDesignerState('outline-drag');
  const rootId = state.document.rootNodeId;
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'html.container',
    parentId: rootId,
  });
  const containerId = state.document.nodes[rootId].children[0]!;
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'html.text',
    parentId: containerId,
  });
  return {
    document: state.document,
    bindingDefinitions: state.bindingDefinitions,
    rootId,
    containerId,
  };
}

describe('LiveDesignerOutlinePanel drag', () => {
  it('lets non-root rows drag and starts an external node drag', () => {
    const { document, bindingDefinitions, rootId, containerId } = buildDocument();
    render(
      <LiveDesignerOutlinePanel
        document={document}
        bindingDefinitions={bindingDefinitions}
        selectedNodeId={containerId}
        onSelectNode={() => undefined}
        onOpenProperties={() => undefined}
        onMoveNode={() => true}
        onInsertPaletteItem={() => undefined}
        onClose={() => undefined}
        width={280}
      />,
    );

    const rows = screen.getByTestId('live-designer-outline-list').querySelectorAll('[data-outline-node-id]');
    const rootRow = Array.from(rows).find((row) => row.getAttribute('data-outline-node-id') === rootId);
    const containerRow = Array.from(rows).find((row) => row.getAttribute('data-outline-node-id') === containerId);
    const rootButton = rootRow?.querySelector('button[class*="flex-1"]');
    const containerButton = containerRow?.querySelector('button[class*="flex-1"]');

    expect(rootButton).toHaveAttribute('draggable', 'false');
    expect(containerButton).toHaveAttribute('draggable', 'true');
    expect(screen.getByTestId('live-designer-dock-panel-title')).toHaveTextContent('Outline');
    expect(screen.getByTestId('live-designer-dock-panel-title').parentElement?.querySelectorAll('p')).toHaveLength(1);
    expect(screen.getByPlaceholderText('outline…')).toBeInTheDocument();
    expect(rootRow?.contains(screen.getByRole('button', { name: 'Expand all' }))).toBe(true);
    expect(rootRow?.contains(screen.getByRole('button', { name: 'Collapse all' }))).toBe(true);

    const dataTransfer = {
      setData: vi.fn(),
      setDragImage: vi.fn(),
      effectAllowed: 'none',
    };
    fireEvent.dragStart(containerButton!, { dataTransfer });
    expect(getLiveDesignerExternalDrag()).toEqual({
      kind: 'node',
      nodeId: containerId,
      label: expect.any(String),
    });
    expect(dataTransfer.effectAllowed).toBe('move');
  });
});
