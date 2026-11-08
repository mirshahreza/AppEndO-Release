import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';

describe('component designer inspector attrs codegen', () => {
  it('emits global and tag-specific attributes in generated TSX', () => {
    const initial = createInitialDesignerState();
    const withLink = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.link',
      parentId: initial.document.rootNodeId,
    });
    const linkNodeId = withLink.document.nodes[withLink.document.rootNodeId].children[0];

    const enriched = designerReducer(withLink, {
      type: 'set-node-prop',
      nodeId: linkNodeId,
      key: 'id',
      value: 'docs-link',
    });

    const withReferrer = designerReducer(enriched, {
      type: 'set-node-prop',
      nodeId: linkNodeId,
      key: 'referrerPolicy',
      value: 'no-referrer',
    });

    const tsx = generateDesignerTsx(withReferrer.document, withReferrer.bindingDefinitions);

    expect(tsx).toContain('id="docs-link"');
    expect(tsx).toContain('referrerPolicy="no-referrer"');
    expect(tsx).toContain('href=');
  });

  it('stores palette item id on inserted nodes', () => {
    const initial = createInitialDesignerState();
    const withButton = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withButton.document.nodes[withButton.document.rootNodeId].children[0];
    const node = withButton.document.nodes[nodeId];

    expect(node.props._designerPaletteItemId).toBe('heroui.button-solid');
  });
});
