/**
 * @vitest-environment jsdom
 * Bug found (parity audit item 2, systemic): Property Binding on scalar Universal widget props
 * (title/message/label/value/max/etc) was always dead in the live/interactive preview —
 * `resolveUniversalPropsFromNode` read straight off `node.props`, never consulting
 * `options.previewBindings`. Export was already correct. Fixed by threading `options` through
 * and using `previewBindings.resolveTextProp`/`resolveNumberProp` (falling back to the static
 * value exactly as before when unbound).
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: state.document.rootNodeId });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId];
  return parent.children[parent.children.length - 1] as string;
};

const bindStoreProp = (state: DesignerState, nodeId: string, prop: string, storePath: string): DesignerState => {
  const binding = createStoreReadBindingDefinition(prop, storePath);
  return designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: binding.bindingKey,
    definition: binding.definition,
  });
};

describe('Universal widgets preview binding fix', () => {
  it('feedback.alert: a Store-bound title renders the live value in interactive preview, not the static literal', () => {
    let state = insertItem(createInitialDesignerState(), 'feedback.alert');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Static title' });
    state = bindStoreProp(state, nodeId, 'title', 'notice.title');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          designerStore: { notice: { title: 'Live bound title' } },
        })}
      </>,
    );

    expect(container.textContent).toContain('Live bound title');
    expect(container.textContent).not.toContain('Static title');
  });

  it('feedback.alert: still shows the static title when unbound (honest no-op)', () => {
    let state = insertItem(createInitialDesignerState(), 'feedback.alert');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Static title' });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document, { interactive: true })}</>);
    expect(container.textContent).toContain('Static title');
  });

  it('content.stat-trend: a Store-bound numeric value renders live in interactive preview', () => {
    let state = insertItem(createInitialDesignerState(), 'content.stat-trend');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'value', value: '10' });
    state = bindStoreProp(state, nodeId, 'value', 'stats.total');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          designerStore: { stats: { total: '4200' } },
        })}
      </>,
    );

    expect(container.textContent).toContain('4200');
    expect(container.textContent).not.toContain('>10<');
  });

  it('form.rating: a Store-bound "max" (star count) renders live in interactive preview', () => {
    let state = insertItem(createInitialDesignerState(), 'form.rating');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'max', value: 5 });
    state = bindStoreProp(state, nodeId, 'max', 'rating.maxStars');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          designerStore: { rating: { maxStars: 3 } },
        })}
      </>,
    );

    const stars = container.querySelectorAll('button[aria-label^="Rate"]');
    expect(stars).toHaveLength(3);
  });
});
