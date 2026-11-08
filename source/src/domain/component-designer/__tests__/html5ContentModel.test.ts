import { describe, expect, it } from 'vitest';
import {
  canInsertPaletteItem,
  canMoveNodeToParent,
  getPaletteItemById,
} from '../catalog';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  describeHtml5ContentModelViolation,
  satisfiesHtml5ContentModel,
  validateHtml5ContentPlacement,
} from '../html5ContentModel';
import type { DesignerNode } from '../types';
import { validateDesignerDocument } from '../validation';

const buildNode = (overrides: Partial<DesignerNode> & Pick<DesignerNode, 'id' | 'type'>): DesignerNode => ({
  parentId: null,
  order: 0,
  props: {},
  layout: {},
  binding: {},
  children: [],
  ...overrides,
});

describe('html5 content model', () => {
  it('rejects placing form controls inside select-like components', () => {
    const selectParent = buildNode({
      id: 'select-1',
      type: 'container',
      props: { _designerPaletteItemId: 'heroui.select' },
    });
    const inputChild = buildNode({
      id: 'input-1',
      type: 'container',
      props: { _designerPaletteItemId: 'heroui.input-text' },
    });

    expect(satisfiesHtml5ContentModel(inputChild, selectParent)).toBe(false);
    expect(validateHtml5ContentPlacement(inputChild, selectParent)?.code).toBe('html5-content-model');
    expect(canInsertPaletteItem(getPaletteItemById('heroui.input-text')!, selectParent)).toBe(false);
  });

  it('rejects direct non-list-item children inside lists', () => {
    const listParent = buildNode({
      id: 'list-1',
      type: 'list',
      props: { _designerPaletteItemId: 'html.list' },
    });
    const textChild = buildNode({
      id: 'text-1',
      type: 'text',
      props: { _designerPaletteItemId: 'html.text', text: 'Item' },
    });

    expect(satisfiesHtml5ContentModel(textChild, listParent)).toBe(false);
    expect(describeHtml5ContentModelViolation(textChild, listParent)).toContain('list item');
  });

  it('allows list items inside lists', () => {
    const listParent = buildNode({
      id: 'list-1',
      type: 'list',
      props: { _designerPaletteItemId: 'html.list' },
    });
    const listItemChild = buildNode({
      id: 'li-1',
      type: 'list-item',
      props: { _designerPaletteItemId: 'html.list-item' },
    });

    expect(satisfiesHtml5ContentModel(listItemChild, listParent)).toBe(true);
  });

  it('rejects nested forms', () => {
    const outerForm = buildNode({
      id: 'form-outer',
      type: 'container',
      props: { _designerPaletteItemId: 'html.form', htmlTag: 'form' },
    });
    const innerForm = buildNode({
      id: 'form-inner',
      type: 'container',
      props: { _designerPaletteItemId: 'html.form', htmlTag: 'form' },
    });

    expect(satisfiesHtml5ContentModel(innerForm, outerForm)).toBe(false);
    expect(describeHtml5ContentModelViolation(innerForm, outerForm)).toContain('nested');
  });

  it('rejects block content inside phrasing-only parents', () => {
    const textParent = buildNode({
      id: 'text-parent',
      type: 'text',
      props: { _designerPaletteItemId: 'html.text', text: 'Hello' },
    });
    const containerChild = buildNode({
      id: 'container-child',
      type: 'container',
      props: { _designerPaletteItemId: 'html.container' },
    });

    expect(satisfiesHtml5ContentModel(containerChild, textParent)).toBe(false);
  });

  it('rejects inserting children into media elements', () => {
    const imageParent = buildNode({
      id: 'image-1',
      type: 'image',
      props: { _designerPaletteItemId: 'html.image' },
    });
    const textChild = buildNode({
      id: 'text-1',
      type: 'text',
      props: { _designerPaletteItemId: 'html.text', text: 'Alt' },
    });

    expect(satisfiesHtml5ContentModel(textChild, imageParent)).toBe(false);
  });

  it('blocks invalid parent-child pairs in document validation', () => {
    const initial = createInitialDesignerState();
    const withSelect = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.select',
      parentId: initial.document.rootNodeId,
    });

    const selectId = withSelect.document.nodes[withSelect.document.rootNodeId].children[0];
    const selectNode = withSelect.document.nodes[selectId];
    const inputId = 'forced-input-child';
    const inputNode = buildNode({
      id: inputId,
      type: 'container',
      parentId: selectId,
      order: 0,
      props: { _designerPaletteItemId: 'heroui.input-text' },
    });

    const brokenDocument = {
      ...withSelect.document,
      nodes: {
        ...withSelect.document.nodes,
        [selectId]: {
          ...selectNode,
          children: [inputId],
        },
        [inputId]: inputNode,
      },
    };

    const diagnostics = validateDesignerDocument(brokenDocument);
    expect(diagnostics.some((item) => item.code === 'html5-content-model' && item.nodeId === inputId)).toBe(true);
  });

  it('uses html5 rules when moving nodes in catalog checks', () => {
    const initial = createInitialDesignerState();
    const withContainer = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });
    const containerId = withContainer.document.nodes[withContainer.document.rootNodeId].children[0];
    const containerNode = withContainer.document.nodes[containerId];

    const withSelect = designerReducer(withContainer, {
      type: 'insert-palette-item',
      itemId: 'heroui.select',
      parentId: containerId,
    });
    const selectId = withSelect.document.nodes[containerId].children[0];
    const selectNode = withSelect.document.nodes[selectId];
    const inputNode = buildNode({
      id: 'input-move',
      type: 'container',
      props: { _designerPaletteItemId: 'heroui.input-text' },
    });

    expect(canMoveNodeToParent(inputNode, selectNode)).toBe(false);
    expect(canMoveNodeToParent(inputNode, containerNode)).toBe(true);
  });
});
