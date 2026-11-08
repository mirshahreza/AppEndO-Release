import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { createEventBindingDefinition, eventBindingKeyForEvent } from '../bindingEngine';
import type { DesignerState } from '../types';

/**
 * Bug found (discovered while testing the Data Grid pagination fix, pre-existing and unrelated
 * to it): `renderGridEventHandlerLines`'s generated handler signature duplicated the parameter
 * name — `eventType` already included its own "paramName: Type" pair, and the signature line
 * wrapped it in a SECOND "paramName: " prefix, producing invalid TypeScript like
 * `async (nextPage: nextPage: number) => {` / `async (descriptor: sortDescriptor: {...}) => {`.
 * This broke compilation for ANY grid/data-grid/app-table-grid with a real (non-dynamic-action)
 * mutation bound to onPageChange or onSortChange.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe.each(['heroui.data-grid', 'heroui.table'] as const)('%s onPageChange/onSortChange handler signatures', (itemId) => {
  it('generates a syntactically valid onPageChange handler for a real bound mutation', () => {
    let state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: eventBindingKeyForEvent('onPageChange'),
      definition: createEventBindingDefinition('onPageChange', '/api/v1/page', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax(`${itemId} onPageChange`, tsx);
    expect(tsx).toMatch(/React\.useCallback\(async \(nextPage: number\) => \{/);
    expect(tsx).not.toMatch(/nextPage: nextPage:/);
  });

  it('generates a syntactically valid onSortChange handler for a real bound mutation', () => {
    let state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: eventBindingKeyForEvent('onSortChange'),
      definition: createEventBindingDefinition('onSortChange', '/api/v1/sort', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax(`${itemId} onSortChange`, tsx);
    expect(tsx).toMatch(/React\.useCallback\(async \(descriptor: \{ column\?: string; direction\?: string \} \| null\) => \{/);
    expect(tsx).not.toMatch(/descriptor: sortDescriptor:/);
  });
});
