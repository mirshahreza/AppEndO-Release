/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderHeroUiRealNode, renderHeroUiStructuralNode } from '../runtimeRenderer';

const PHASE_1_PARITY_IDS = [
  'heroui.breadcrumbs',
  'heroui.pagination',
  'heroui.checkbox-group',
  'heroui.radio-group',
  'heroui.tags-input',
] as const;

const canvasChild = <div data-testid="canvas-child">Canvas slot</div>;

describe('designer parity design-mode canvas render', () => {
  it.each(PHASE_1_PARITY_IDS)('renders %s in design mode with canvas children', (itemId) => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId,
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
    const node = state.document.nodes[nodeId];

    expect(() => {
      const { container } = render(
        <>
          {renderHeroUiStructuralNode(node, {
            mode: 'design',
            style: {},
            children: canvasChild,
          })}
        </>,
      );
      expect(container.querySelector('[data-designer-component]')).toBeTruthy();
    }).not.toThrow();
  });

  it('renders heroui.tooltip-trigger in design mode', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.tooltip-trigger',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
    const node = state.document.nodes[nodeId];

    expect(() => {
      const { container } = render(
        <>{renderHeroUiRealNode(node, { mode: 'design', style: {} })}</>,
      );
      expect(container.querySelector('[data-designer-component]')).toBeTruthy();
    }).not.toThrow();
  });
});
