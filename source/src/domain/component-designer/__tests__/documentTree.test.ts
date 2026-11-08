import { describe, expect, it } from 'vitest';
import { normalizeDesignerDocument, resolveSiblingInsertIndex } from '../documentTree';
import { createInitialDesignerState, designerReducer } from '../state';

describe('component designer document tree helpers', () => {
  it('resolves sibling insert indices from children order', () => {
    const parent = {
      id: 'parent',
      type: 'container',
      parentId: 'root',
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: ['a', 'b', 'c'],
    };

    expect(resolveSiblingInsertIndex(parent, 'a', 'before')).toBe(0);
    expect(resolveSiblingInsertIndex(parent, 'a', 'after')).toBe(1);
    expect(resolveSiblingInsertIndex(parent, 'c', 'after')).toBe(3);
  });

  it('normalizes mismatched parent-child relationships from parentId links', () => {
    const initial = createInitialDesignerState();
    const document = structuredClone(initial.document);

    document.nodes['child-a'] = {
      id: 'child-a',
      type: 'text',
      parentId: document.rootNodeId,
      order: 1,
      props: { text: 'A' },
      layout: {},
      binding: {},
      children: [],
    };
    document.nodes['child-b'] = {
      id: 'child-b',
      type: 'text',
      parentId: document.rootNodeId,
      order: 0,
      props: { text: 'B' },
      layout: {},
      binding: {},
      children: [],
    };
    document.nodes[document.rootNodeId] = {
      ...document.nodes[document.rootNodeId],
      children: ['child-b', 'child-a'],
    };

    const normalized = normalizeDesignerDocument(document);

    expect(normalized.nodes[normalized.rootNodeId].children).toEqual(['child-b', 'child-a']);
    expect(normalized.nodes['child-a'].order).toBe(1);
    expect(normalized.nodes['child-b'].order).toBe(0);
  });

  it('repairs orphan parent references by attaching nodes to root', () => {
    const initial = createInitialDesignerState();
    const document = structuredClone(initial.document);

    document.nodes['orphan'] = {
      id: 'orphan',
      type: 'text',
      parentId: 'missing-parent',
      order: 0,
      props: { text: 'Orphan' },
      layout: {},
      binding: {},
      children: [],
    };

    const normalized = normalizeDesignerDocument(document);

    expect(normalized.nodes['orphan'].parentId).toBe(normalized.rootNodeId);
    expect(normalized.nodes[normalized.rootNodeId].children).toContain('orphan');
  });
});

describe('component designer move-node reordering', () => {
  it('moves a node down within the same parent', () => {
    const initial = createInitialDesignerState();
    const withFirst = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });
    const withSecond = designerReducer(withFirst, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: withFirst.document.rootNodeId,
    });
    const withThird = designerReducer(withSecond, {
      type: 'insert-palette-item',
      itemId: 'html.link',
      parentId: withSecond.document.rootNodeId,
    });

    const [firstId, secondId, thirdId] = withThird.document.nodes[withThird.document.rootNodeId].children;
    const reordered = designerReducer(withThird, {
      type: 'move-node',
      nodeId: firstId,
      targetParentId: withThird.document.rootNodeId,
      index: 3,
    });

    expect(reordered.document.nodes[reordered.document.rootNodeId].children).toEqual([secondId, thirdId, firstId]);
  });
});
