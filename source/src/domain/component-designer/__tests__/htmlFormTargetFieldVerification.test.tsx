/**
 * @vitest-environment jsdom
 *
 * Parity audit item 11 claimed `html.form`'s Target field was dead in both the design canvas and
 * interactive Preview (only working in Export). Re-verification during the fix pass found this
 * already correct in current code: `canvasNodes.tsx`'s form branch and
 * `designerRuntimePreview.tsx`'s form branch both already read `node.props.target` and forward it
 * as a real `target` attribute on the rendered `<form>`. No code change was needed — this test
 * locks in the correct behavior (there was no prior regression test for it) so a future
 * regression is caught.
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { generateDesignerTsx } from '../codegen';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('html.form Target field (parity audit item 11)', () => {
  it('interactive Preview renders the configured target attribute on the real <form>', () => {
    let state = insertItem(createInitialDesignerState(), 'html.form');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'target', value: '_blank' });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('form')?.getAttribute('target')).toBe('_blank');
  });

  it('Export still renders the configured target attribute on the real <form>', () => {
    let state = insertItem(createInitialDesignerState(), 'html.form');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'target', value: '_blank' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toMatch(/<form\b[^>]*\starget="_blank"/);
  });
});
