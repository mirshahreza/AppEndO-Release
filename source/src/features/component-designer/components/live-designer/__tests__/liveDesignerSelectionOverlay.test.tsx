// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createInitialDesignerState, designerReducer } from '../../../../../domain/component-designer/state';
import { LiveDesignerSelectionOverlay } from '../LiveDesignerSelectionOverlay';
import type { LiveDesignerInteractionMode } from '../liveDesignerInteractionMode';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function asDomRect(rect: { top: number; left: number; width: number; height: number }): DOMRect {
  return {
    x: rect.left,
    y: rect.top,
    top: rect.top,
    left: rect.left,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    toJSON: () => ({}),
  } as DOMRect;
}

function stubDesignerRects() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function stubRect(this: HTMLElement) {
    if (this.getAttribute('data-designer-node-id') === 'root') {
      return asDomRect({ top: 8, left: 8, width: 120, height: 48 });
    }
    return asDomRect({ top: 0, left: 0, width: 240, height: 160 });
  });
}

function renderOverlay(interactionMode: LiveDesignerInteractionMode) {
  stubDesignerRects();
  const document = createInitialDesignerState('probe').document;
  render(
    <div data-testid="overlay-surface" style={{ position: 'relative', width: 240, height: 160 }}>
      <div data-designer-node-id="root" data-designer-node-type="root" style={{ width: 120, height: 48 }}>
        root
      </div>
      <LiveDesignerSelectionOverlay
        selectedNodeId="root"
        rootNodeId="root"
        document={document}
        interactionMode={interactionMode}
        onHoverNodeIdChange={vi.fn()}
        onSelectNodeId={vi.fn()}
        onContextAction={vi.fn()}
        onMoveNode={vi.fn()}
      />
    </div>,
  );
}

describe('LiveDesignerSelectionOverlay interaction mode', () => {
  it('draws the selected outline in inspect mode', () => {
    renderOverlay('inspect');
    expect(screen.getByTestId('live-designer-selected-outline')).toBeInTheDocument();
  });

  it('hides the selected outline in interact mode', () => {
    renderOverlay('interact');
    expect(screen.queryByTestId('live-designer-selected-outline')).toBeNull();
  });

  it('draws an outline for every selected canvas object', () => {
    stubDesignerRects();
    let state = createInitialDesignerState('probe');
    const rootId = state.document.rootNodeId;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    const [first, second] = state.document.nodes[rootId].children;

    render(
      <div data-testid="overlay-surface" style={{ position: 'relative', width: 240, height: 160 }}>
        <div data-designer-node-id={first} data-designer-node-type="text" style={{ width: 40, height: 20 }}>
          first
        </div>
        <div data-designer-node-id={second} data-designer-node-type="text" style={{ width: 40, height: 20 }}>
          second
        </div>
        <LiveDesignerSelectionOverlay
          selectedNodeId={second}
          selectedNodeIds={[first, second]}
          rootNodeId={rootId}
          document={state.document}
          interactionMode="inspect"
          onHoverNodeIdChange={vi.fn()}
          onSelectNodeId={vi.fn()}
          onContextAction={vi.fn()}
          onMoveNode={vi.fn()}
        />
      </div>,
    );

    const outlines = screen.getAllByTestId('live-designer-selected-outline');
    expect(outlines).toHaveLength(2);
    expect(outlines.map((node) => node.getAttribute('data-node-id'))).toEqual([first, second]);
  });
});
