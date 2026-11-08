import { describe, expect, it } from 'vitest';
import { DESIGNER_PALETTE, canInsertPaletteItem, canInsertPaletteItemWithAutoWrap, canMoveNodeToParent, getPaletteItemById, isCompoundPaletteItemId } from '../catalog';
import { createInitialDesignerState, designerReducer } from '../state';
import { validateDesignerDocument } from '../validation';

describe('component designer validate endpoint logic', () => {
  it('returns no diagnostics for a valid document', () => {
    const initial = createInitialDesignerState();
    const withSection = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });

    const diagnostics = validateDesignerDocument(withSection.document);
    expect(diagnostics).toHaveLength(0);
  });

  it('returns no diagnostics when inserting date picker with default props', () => {
    const initial = createInitialDesignerState();
    const withDatePicker = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.date-picker',
      parentId: initial.document.rootNodeId,
    });

    const diagnostics = validateDesignerDocument(withDatePicker.document);
    expect(diagnostics.filter((item) => item.level === 'error')).toHaveLength(0);
  });

  it('returns root-missing diagnostic for a document without a valid root node', () => {
    const initial = createInitialDesignerState();
    const brokenDocument = {
      ...initial.document,
      nodes: {} as typeof initial.document.nodes,
    };

    const diagnostics = validateDesignerDocument(brokenDocument);
    expect(diagnostics.some((item) => item.code === 'root-missing')).toBe(true);
  });

  it('returns no diagnostics when inserting mask input with default props', () => {
    const initial = createInitialDesignerState();
    const withMaskInput = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'form.mask-input',
      parentId: initial.document.rootNodeId,
    });

    const diagnostics = validateDesignerDocument(withMaskInput.document);
    expect(diagnostics.filter((item) => item.level === 'error')).toHaveLength(0);
  });

  it('returns required-prop diagnostic when a required prop is missing', () => {
    const initial = createInitialDesignerState();
    const withSection = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: initial.document.rootNodeId,
    });

    const sectionId = withSection.document.nodes[withSection.document.rootNodeId].children[0];
    const sectionNode = withSection.document.nodes[sectionId];
    const documentWithMissingProp = {
      ...withSection.document,
      nodes: {
        ...withSection.document.nodes,
        [sectionId]: {
          ...sectionNode,
          props: { ...sectionNode.props, text: '' },
        },
      },
    };

    const diagnostics = validateDesignerDocument(documentWithMissingProp);
    expect(diagnostics.some((item) => item.code === 'required-prop' && item.nodeId === sectionId)).toBe(true);
  });

  it('returns document-large diagnostic warning when document has more than 500 nodes', () => {
    const initial = createInitialDesignerState();
    const document = initial.document;
    const nodes = { ...document.nodes };

    for (let i = 0; i < 505; i++) {
      const nodeId = `mock-node-${i}`;
      nodes[nodeId] = {
        id: nodeId,
        type: 'text',
        parentId: document.rootNodeId,
        order: i,
        props: { text: `text ${i}` },
        layout: {},
        binding: {},
        children: [],
      };
      nodes[document.rootNodeId].children.push(nodeId);
    }

    const largeDocument = {
      ...document,
      nodes,
    };

    const diagnostics = validateDesignerDocument(largeDocument);
    expect(diagnostics.some((item) => item.code === 'document-large')).toBe(true);
  });
});

describe('component designer catalog endpoints — catalog module', () => {
  it('exposes the rebuilt full toolbox catalog', () => {
    const categories = new Set(DESIGNER_PALETTE.map((item) => item.category));
    expect(categories).toEqual(
      new Set([
        'html-primitives',
        'layout',
        'tailwind-ui-blocks',
        'heroui-general',
        'heroui-data-display',
        'heroui-forms-inputs',
        'heroui-navigation-overlays',
        'logic',
        'data-visualization',
        'content-media',
        'marketing',
        'feedback-status',
        'platform-workspace',
      ]),
    );

    expect(DESIGNER_PALETTE.length).toBeGreaterThanOrEqual(75);
  });

  it('catalog items have required shape fields', () => {
    for (const item of DESIGNER_PALETTE) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.label).toBe('string');
      expect(typeof item.nodeType).toBe('string');
      expect(Array.isArray(item.allowedParentTypes)).toBe(true);
    }
  });

  it('uses fixed grid defaults for layout.grid-3', () => {
    const grid3 = getPaletteItemById('layout.grid-3');

    expect(grid3).toBeDefined();
    expect(grid3?.defaultProps.className).toContain('grid-cols-3');
    expect(isCompoundPaletteItemId('layout.grid-3')).toBe(true);
  });

  it('rejects invalid parent-child insert combinations', () => {
    const listItem = getPaletteItemById('html.list-item');
    const root = {
      id: 'root',
      type: 'root',
      parentId: null,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    };

    expect(listItem).toBeDefined();
    expect(canInsertPaletteItem(listItem!, root as any)).toBe(false);
  });

  it('rejects moving unknown node types to any parent', () => {
    const unknownNode = {
      id: 'custom-1',
      type: 'custom-unknown',
      parentId: 'root',
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    };
    const parent = {
      id: 'container-1',
      type: 'container',
      parentId: 'root',
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    };

    expect(canMoveNodeToParent(unknownNode as any, parent as any)).toBe(false);
  });

  it('rejects inserting text directly into list parent', () => {
    const textItem = getPaletteItemById('html.text');
    const listParent = {
      id: 'list-1',
      type: 'list',
      parentId: 'root',
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    };

    expect(textItem).toBeDefined();
    expect(canInsertPaletteItem(textItem!, listParent as any)).toBe(false);
  });

  it('allows inserting list-item into list parent', () => {
    const listItem = getPaletteItemById('html.list-item');
    const listParent = {
      id: 'list-2',
      type: 'list',
      parentId: 'root',
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    };

    expect(listItem).toBeDefined();
    expect(canInsertPaletteItem(listItem!, listParent as any)).toBe(true);
  });

  it('allows auto-wrapping list-item when parent is root or container', () => {
    const listItem = getPaletteItemById('html.list-item');
    const rootParent = {
      id: 'root',
      type: 'root',
      parentId: null,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    };

    expect(listItem).toBeDefined();
    expect(canInsertPaletteItemWithAutoWrap(listItem!, rootParent as any)).toBe(true);
  });

  it('rejects moving text node into list parent', () => {
    const textNode = {
      id: 'text-1',
      type: 'text',
      parentId: 'root',
      order: 0,
      props: { text: 'hello' },
      layout: {},
      binding: {},
      children: [],
    };
    const listParent = {
      id: 'list-3',
      type: 'list',
      parentId: 'root',
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    };

    expect(canMoveNodeToParent(textNode as any, listParent as any)).toBe(false);
  });
});
