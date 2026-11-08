/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item P3.16): binding `page`/`total` on `heroui.pagination` had ZERO
 * effect in either the live preview or the exported `.tsx` — both always read the STATIC
 * `node.props.page`/`node.props.total` literal, ignoring any Property Binding entirely. The
 * separate `onPageChange` mechanism was always correct and is unaffected by this fix.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
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

describe('heroui.pagination page/total binding fix', () => {
  afterEach(() => {
    cleanup();
  });

  it('export: uses the real bound expression for page/total instead of the static literal, with no duplicate attribute', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.pagination');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'page', value: 1 });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'total', value: 10 });
    state = bindStoreProp(state, nodeId, 'total', 'pagination.totalCount');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('pagination bound total', tsx);

    // No dead attribute directly on the real <Pagination> element.
    expect(tsx).not.toMatch(/<Pagination\b[^>]*\stotal=\{/);
    // The real bound store path reaches the Summary/Link/Previous/Next math.
    expect(tsx).toContain('designerStore?.pagination?.totalCount');
    expect(tsx).toContain('Math.max(1, Number(designerStore?.pagination?.totalCount) || 10)');
  });

  it('export: is an honest no-op (static literal, unchanged) when neither page nor total is bound', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.pagination');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'page', value: 3 });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'total', value: 7 });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('pagination static', tsx);
    expect(tsx).toContain('Page 3 · 7 total');
    expect(tsx).toContain('<Pagination.Link isActive>3</Pagination.Link>');
  });

  it('preview: a Store-bound total is reflected live in the rendered Summary text', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.pagination');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'page', value: 1 });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'total', value: 10 });
    state = bindStoreProp(state, nodeId, 'total', 'pagination.totalCount');

    render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          bindingDefinitions: state.bindingDefinitions,
          designerStore: { pagination: { totalCount: 42 } },
        })}
      </>,
    );

    const shell = document.querySelector('[data-designer-component="heroui.pagination"]');
    expect(shell).not.toBeNull();
    expect(within(shell as HTMLElement).getByText('Page 1 · 42 total')).toBeTruthy();
  });
});
