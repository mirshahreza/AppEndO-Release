/**
 * Bug found (parity audit item 40): `logic.repeater`'s `itemAlias`/`indexAlias` were only
 * `.trim()`'d — values like `"my item"`, `"1x"`, or reserved words could reach Export and produce
 * invalid TSX. Fixed in `repeaterEngine.ts` (`sanitizeRepeaterAlias` / identifier check),
 * Inspector placeholders, and `validation.ts` (`invalid-repeater-alias` diagnostic). Also added
 * missing `ambiguous-repeater-alias` to the `DesignerDiagnostic` code union.
 */
import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { generateDesignerTsx } from '../codegen';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';
import {
  isValidRepeaterAliasIdentifier,
  resolveRepeaterNodeConfig,
  sanitizeRepeaterAlias,
} from '../repeaterEngine';
import { createInitialDesignerState, designerReducer } from '../state';
import { validateDesignerDocument } from '../validation';
import type { DesignerNode, DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const makeNode = (props: Record<string, unknown>): DesignerNode => ({
  id: 'repeater-1',
  type: 'component-container',
  parentId: 'root',
  order: 0,
  props: {
    [DESIGNER_PALETTE_ITEM_ID_PROP]: 'logic.repeater',
    ...props,
  },
  layout: {},
  binding: {},
  children: [],
});

describe('repeater alias identifier validation (parity audit item 40)', () => {
  it('sanitizeRepeaterAlias falls back for spaces, leading digits, and reserved words', () => {
    expect(sanitizeRepeaterAlias('my item', 'item')).toBe('item');
    expect(sanitizeRepeaterAlias('1x', 'item')).toBe('item');
    expect(sanitizeRepeaterAlias('class', 'item')).toBe('item');
    expect(sanitizeRepeaterAlias('for', 'index')).toBe('index');
    expect(sanitizeRepeaterAlias('row', 'item')).toBe('row');
    expect(sanitizeRepeaterAlias('_idx', 'index')).toBe('_idx');
    expect(isValidRepeaterAliasIdentifier('rowItem')).toBe(true);
    expect(isValidRepeaterAliasIdentifier('await')).toBe(false);
  });

  it('resolveRepeaterNodeConfig uses safe defaults for invalid aliases', () => {
    const config = resolveRepeaterNodeConfig(makeNode({
      itemAlias: 'my item',
      indexAlias: '1x',
    }));
    expect(config.itemAlias).toBe('item');
    expect(config.indexAlias).toBe('index');
  });

  it('validation warns on invalid aliases in Inspector diagnostics', () => {
    let state = insertItem(createInitialDesignerState(), 'logic.repeater');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'itemAlias', value: 'my item' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'indexAlias', value: 'class' });

    const diagnostics = validateDesignerDocument(state.document);
    expect(diagnostics.some((item) => item.code === 'invalid-repeater-alias' && item.field === 'itemAlias')).toBe(true);
    expect(diagnostics.some((item) => item.code === 'invalid-repeater-alias' && item.field === 'indexAlias')).toBe(true);
  });

  it('export still produces valid TSX when aliases are invalid (falls back to item/index)', async () => {
    let state = insertItem(createInitialDesignerState(), 'logic.repeater');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'itemAlias', value: 'my item' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'indexAlias', value: '1x' });
    state = insertItem(state, 'html.text', nodeId);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('repeater invalid aliases fallback', tsx);
    expect(tsx).toMatch(/\.map\(\(item,\s*index\)\s*=>/);
    expect(tsx).not.toContain('my item');
  });
});
