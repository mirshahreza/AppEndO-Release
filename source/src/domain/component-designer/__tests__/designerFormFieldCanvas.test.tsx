/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderHeroUiRealNode } from '../runtimeRenderer';

vi.mock('react-imask', () => ({
  useIMask: (_options: unknown, config?: { defaultValue?: string }) => ({
    ref: { current: null },
    maskRef: {
      current: {
        value: config?.defaultValue ?? '',
        unmaskedValue: config?.defaultValue ?? '',
        updateOptions: () => {},
      },
    },
    setValue: () => {},
  }),
}));

vi.mock('@heroui/react', async () => {
  const { componentDesignerHeroUiMock } = await import('../../../test-support/componentDesignerHeroUiMock');
  return componentDesignerHeroUiMock;
});

describe('designer form field canvas rendering', () => {
  it('renders calculator markup on the design canvas', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'form.calculator',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
    const node = state.document.nodes[nodeId];

    const markup = renderToStaticMarkup(
      renderHeroUiRealNode(node, { mode: 'design', style: undefined, bindingDefinitions: state.bindingDefinitions }),
    );

    expect(markup).toContain('data-designer-component="form.calculator"');
    expect(markup).toContain('data-designer-calculator-keypad="true"');
    expect(markup).toContain('Amount');
  });

  it('renders mask input markup on the design canvas', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'form.mask-input',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
    const node = state.document.nodes[nodeId];

    const markup = renderToStaticMarkup(
      renderHeroUiRealNode(node, { mode: 'design', style: undefined, bindingDefinitions: state.bindingDefinitions }),
    );

    expect(markup).toContain('data-designer-component="form.mask-input"');
    expect(markup).toContain('Masked Input');
    expect(markup).toContain('placeholder="09_________"');
  });

  it('renders date picker markup on the design canvas', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.date-picker',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
    const node = state.document.nodes[nodeId];

    const markup = renderToStaticMarkup(
      renderHeroUiRealNode(node, { mode: 'design', style: undefined, bindingDefinitions: state.bindingDefinitions }),
    );

    expect(markup).toContain('data-designer-component="heroui.date-picker"');
    expect(markup).toContain('Date');
  });
});
