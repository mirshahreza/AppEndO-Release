import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 15): `text` is rendered as JSX CHILDREN (via
 * `renderTranslatableJsxTextContent`), not as a real JSX attribute, for `html.text`/
 * `html.heading`/`html.link`/`html.list-item` — the real `<p>`/`<h1-6>`/`<a>`/`<li>` elements
 * don't declare a `text` prop at all. But the generic bound-attribute loop
 * (`buildNodeJsxAttributesWithBindings`, tsxPropMapper.ts) appended `text={expr}` onto the tag
 * regardless, producing a duplicate, dead `text=` attribute whenever `text` was bound — the same
 * bug class already fixed for `items` on select/autocomplete/listbox/dropdown.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

/**
 * `html.list-item` only allows a `list` parent (`allowedParentTypes: ['list']`) — inserting it at
 * the root auto-wraps it in an `html.list` container, so the actual list-item leaf is one level
 * deeper than the root's own last child.
 */
const resolveTargetNodeId = (state: DesignerState, paletteId: string): string => {
  const rootLastChildId = lastChildId(state);
  if (paletteId !== 'html.list-item') {
    return rootLastChildId;
  }
  return lastChildId(state, rootLastChildId);
};

const bindTextProp = (state: DesignerState, nodeId: string): DesignerState =>
  designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('text'),
    definition: createPropertyBindingDefinition('text', 'greeting'),
  });

describe('html.text/heading/link/list-item duplicate text attribute export fix (parity audit item 15)', () => {
  const cases: Array<{ paletteId: string; tag: string }> = [
    { paletteId: 'html.text', tag: 'p' },
    { paletteId: 'html.heading', tag: 'h' },
    { paletteId: 'html.link', tag: 'a' },
    { paletteId: 'html.list-item', tag: 'li' },
  ];

  for (const { paletteId, tag } of cases) {
    it(`${paletteId}: bound text renders as children, never as a duplicate text= attribute`, () => {
      let state = insertItem(createInitialDesignerState(), paletteId);
      const nodeId = resolveTargetNodeId(state, paletteId);
      state = bindTextProp(state, nodeId);

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      assertValidTsxSyntax(`${paletteId} bound text`, tsx);

      expect(tsx).not.toMatch(/\stext=\{/);
      expect(tsx).toMatch(/dataContext\?\.greeting/);
      expect(tsx.toLowerCase()).toContain(`<${tag}`);
    });
  }
});
