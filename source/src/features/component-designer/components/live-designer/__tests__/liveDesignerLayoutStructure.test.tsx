// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  createInitialDesignerState,
  designerReducer,
} from '../../../../../domain/component-designer/state';
import type { DesignerAction } from '../../../../../domain/component-designer/types';
import { LiveDesignerPropertiesPanel } from '../LiveDesignerPropertiesPanel';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('LiveDesignerPropertiesPanel layout structure', () => {
  it('adds a split-pane column from Properties', () => {
    let state = createInitialDesignerState('live-properties-structure');
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'layout.split-pane',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, { type: 'select-node', nodeId });
    let latest = state;

    const Harness: React.FC = () => {
      const [current, setCurrent] = React.useState(state);
      latest = current;
      const dispatch = React.useCallback((action: DesignerAction) => {
        setCurrent((prev) => designerReducer(prev, action));
      }, []);
      const node = current.document.nodes[nodeId] ?? null;
      return (
        <div style={{ height: 640 }}>
          <LiveDesignerPropertiesPanel
            node={node}
            document={current.document}
            bindingDefinitions={current.bindingDefinitions}
            dispatch={dispatch}
            onClose={() => undefined}
            width={320}
          />
        </div>
      );
    };

    render(<Harness />);
    expect(screen.getByTestId('inspector-layout-structure')).toBeInTheDocument();
    expect(latest.document.nodes[nodeId].children).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
    expect(latest.document.nodes[nodeId].children).toHaveLength(3);
  });
});
