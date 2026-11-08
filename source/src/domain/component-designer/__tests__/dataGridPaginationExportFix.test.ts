import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { createEventBindingDefinition, eventBindingKeyForEvent } from '../bindingEngine';
import type { DesignerState } from '../types';

/**
 * Bug found: `heroui.data-grid`'s exported pagination footer had NO working controls at all —
 * `<Pagination.Previous />`/`<Pagination.Next />` had no `onPress`, a bound `onPageChange` was
 * attached to the `<Pagination>` root (a prop the real component doesn't have, so it never
 * fired), and the active-page link was hardcoded to the literal "1" regardless of the grid's
 * real page. Reuses the exact fix already proven correct for the standalone `heroui.pagination`
 * element.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('heroui.data-grid pagination export fix', () => {
  it('wires real onPress on Previous/Next instead of leaving them inert', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.data-grid');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'page', value: 3 });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'total', value: 50 });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: eventBindingKeyForEvent('onPageChange'),
      definition: createEventBindingDefinition('onPageChange', '/api/v1/page', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('data-grid pagination', tsx);

    expect(tsx).toMatch(/Pagination\.Previous onPress=\{\(\) => handleonPageChange_\w+\(Math\.max\(1, 3 - 1\)\)\} isDisabled=\{3 <= 1\}/);
    expect(tsx).toMatch(/Pagination\.Next onPress=\{\(\) => handleonPageChange_\w+\(Math\.min\(50, 3 \+ 1\)\)\} isDisabled=\{3 >= 50\}/);
    expect(tsx).not.toMatch(/<Pagination[^>]*onPageChange=\{/);
  });

  it('shows the real current page instead of a hardcoded "1"', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.data-grid');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'page', value: 4 });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('data-grid active page', tsx);
    expect(tsx).toContain('<Pagination.Link isActive>4</Pagination.Link>');
  });

  it('leaves Previous/Next without onPress when no onPageChange is bound (no crash, honest no-op)', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.data-grid');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('data-grid no page binding', tsx);
    expect(tsx).toContain('<Pagination.Previous />');
    expect(tsx).toContain('<Pagination.Next />');
  });
});
